/**
 * Soft-warning engine for the Final Review Cockpit.
 *
 * Per §12 of `FINAL_REVIEW_REDESIGN_PLAN.md`, warnings are deterministic and
 * pure: given the same `FinalReviewSnapshot` + pending action, the same
 * warnings emerge. The engine runs server-side as part of the page hydration
 * and again client-side whenever the chair picks a different action — so the
 * readiness panel updates live as they explore options.
 *
 * Twenty-two warnings are catalogued in §12.4. This file ships the keys
 * that can be detected from data already available today; the rest become
 * follow-ups when the underlying signal lands (per-question RED_FLAG tags,
 * reviewer-disagreement variance with full rubric coverage, conditions,
 * etc.).
 */

import type {
  ChairDecisionAction,
  InstructorApplicationStatus,
  InstructorInterviewRecommendation,
  ProgressStatus,
} from "@prisma/client";

export type WarningSeverity = "INFO" | "CAUTION" | "HIGH_RISK";

export type WarningKey =
  | "approve_with_low_interview_score"
  | "reject_with_high_interview_score"
  | "approve_without_interview_comments"
  | "final_decision_conflicts_with_consensus"
  | "approve_without_interviews"
  | "thin_evidence_for_rejection"
  | "thin_evidence_for_approval"
  | "high_reviewer_disagreement"
  | "rubric_scores_incomplete"
  | "no_recent_reviewer_activity"
  | "missing_required_materials"
  | "open_info_request"
  | "cross_chapter_chair_decision"
  | "prior_rescinded_decision"
  | "unusual_fast_decision";

export interface FinalReviewWarning {
  key: WarningKey;
  severity: WarningSeverity;
  message: string;
  detail?: string;
  evidenceTargetId?: string;
}

export interface InterviewSignal {
  reviewerName: string | null;
  recommendation: InstructorInterviewRecommendation | null;
  overallRating: ProgressStatus | null;
  hasNarrative: boolean;
  unscoredCategoryCount: number;
}

export interface FinalReviewWarningInput {
  pendingAction: ChairDecisionAction | null;
  status: InstructorApplicationStatus;
  interviews: InterviewSignal[];
  rationaleLength: number;
  rejectReasonCode: string | null;
  hasMaterialsComplete: boolean;
  hasOpenInfoRequest: boolean;
  hasRecentTimelineActivity: boolean;
  hasPriorSupersededDecision: boolean;
  isCrossChapter: boolean;
  timeOnPageMs: number;
}

const APPROVE_LIKE: ReadonlySet<ChairDecisionAction> = new Set(["APPROVE"]);
const REJECT_LIKE: ReadonlySet<ChairDecisionAction> = new Set(["REJECT"]);

function majorityRecommendation(
  interviews: InterviewSignal[]
): InstructorInterviewRecommendation | null {
  const counts: Record<InstructorInterviewRecommendation, number> = {
    ACCEPT: 0,
    ACCEPT_WITH_SUPPORT: 0,
    HOLD: 0,
    REJECT: 0,
  };
  let total = 0;
  for (const i of interviews) {
    if (!i.recommendation) continue;
    counts[i.recommendation] += 1;
    total += 1;
  }
  if (total < 2) return null;
  const acceptLike = counts.ACCEPT + counts.ACCEPT_WITH_SUPPORT;
  if (acceptLike > total / 2) return "ACCEPT";
  if (counts.REJECT > total / 2) return "REJECT";
  if (counts.HOLD > total / 2) return "HOLD";
  return null;
}

function disagreementSpread(interviews: InterviewSignal[]): number {
  // Map ratings to 0–3 indexes; return max – min spread.
  const scaleIndex: Record<ProgressStatus, number> = {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 1,
    ON_TRACK: 2,
    ABOVE_AND_BEYOND: 3,
  };
  const idxs = interviews
    .map((i) => (i.overallRating ? scaleIndex[i.overallRating] : null))
    .filter((n): n is number => typeof n === "number");
  if (idxs.length < 2) return 0;
  return Math.max(...idxs) - Math.min(...idxs);
}

function actionContradicts(
  action: ChairDecisionAction,
  majority: InstructorInterviewRecommendation | null
): boolean {
  if (!majority) return false;
  if (APPROVE_LIKE.has(action)) {
    return majority === "REJECT" || majority === "HOLD";
  }
  if (REJECT_LIKE.has(action)) {
    return majority === "ACCEPT";
  }
  return false;
}

export function computeFinalReviewWarnings(
  input: FinalReviewWarningInput
): FinalReviewWarning[] {
  const out: FinalReviewWarning[] = [];
  const action = input.pendingAction;
  const submittedInterviews = input.interviews.length;
  const totalRecs = input.interviews.filter((i) => i.recommendation).length;

  if (!input.hasRecentTimelineActivity) {
    out.push({
      key: "no_recent_reviewer_activity",
      severity: "INFO",
      message: "No activity on this applicant in the past 14 days.",
      detail: "Verify the applicant isn't stalled waiting on someone before deciding.",
    });
  }

  if (input.hasOpenInfoRequest) {
    out.push({
      key: "open_info_request",
      severity: "CAUTION",
      message: "Open info request awaiting the applicant's response.",
      detail: "Resolve the request — or acknowledge it — before recording a decision.",
    });
  }

  if (!input.hasMaterialsComplete) {
    out.push({
      key: "missing_required_materials",
      severity: "CAUTION",
      message: "Course outline or first-class plan is missing.",
      detail: "Ask the applicant to upload missing materials, or accept the gap intentionally.",
    });
  }

  if (input.hasPriorSupersededDecision) {
    out.push({
      key: "prior_rescinded_decision",
      severity: "INFO",
      message: "This applicant has a prior rescinded decision in their history.",
      detail: "Glance at the audit trail before committing.",
    });
  }

  if (input.isCrossChapter) {
    out.push({
      key: "cross_chapter_chair_decision",
      severity: "CAUTION",
      message: "You're deciding on an applicant from a chapter you don't lead.",
      detail: "Confirm cross-chapter chair scope is intentional for this case.",
    });
  }

  // Action-specific warnings (only fire when the chair has picked an action).
  if (action) {
    if (
      APPROVE_LIKE.has(action) &&
      input.interviews.some((i) => i.overallRating === "BEHIND_SCHEDULE")
    ) {
      const reviewer = input.interviews.find((i) => i.overallRating === "BEHIND_SCHEDULE");
      out.push({
        key: "approve_with_low_interview_score",
        severity: "HIGH_RISK",
        message: "An interviewer rated this applicant Below expectations overall.",
        detail: reviewer?.reviewerName
          ? `Lowest score from ${reviewer.reviewerName}.`
          : undefined,
      });
    }

    if (
      REJECT_LIKE.has(action) &&
      input.interviews.some((i) => i.overallRating === "ABOVE_AND_BEYOND")
    ) {
      const reviewer = input.interviews.find(
        (i) => i.overallRating === "ABOVE_AND_BEYOND"
      );
      out.push({
        key: "reject_with_high_interview_score",
        severity: "HIGH_RISK",
        message: "Rejecting despite an interviewer rating this applicant Above and beyond.",
        detail: reviewer?.reviewerName
          ? `Highest score from ${reviewer.reviewerName} — make sure your rationale addresses it.`
          : undefined,
      });
    }

    if (APPROVE_LIKE.has(action) && submittedInterviews === 0) {
      out.push({
        key: "approve_without_interviews",
        severity: "HIGH_RISK",
        message: "No submitted interview reviews on file.",
        detail:
          "You're approving without recorded interview signal. Confirm this is intentional.",
      });
    }

    if (
      APPROVE_LIKE.has(action) &&
      submittedInterviews > 0 &&
      input.interviews.every((i) => !i.hasNarrative)
    ) {
      out.push({
        key: "approve_without_interview_comments",
        severity: "CAUTION",
        message: "No interviewer left narrative notes on this applicant.",
      });
    }

    const majority = majorityRecommendation(input.interviews);
    if (totalRecs >= 2 && actionContradicts(action, majority)) {
      out.push({
        key: "final_decision_conflicts_with_consensus",
        severity: "HIGH_RISK",
        message: `Your decision doesn't match the majority of interviewer recommendations.`,
        detail:
          majority === "ACCEPT"
            ? "Most interviewers recommended Accept."
            : majority === "REJECT"
              ? "Most interviewers recommended Reject."
              : majority === "HOLD"
                ? "Most interviewers recommended Hold."
                : undefined,
      });
    }

    if (REJECT_LIKE.has(action) && input.rationaleLength < 80 && input.rejectReasonCode === "OTHER") {
      out.push({
        key: "thin_evidence_for_rejection",
        severity: "HIGH_RISK",
        message: "Rejecting with a short free-text reason and reason code 'Other'.",
        detail: "Add a specific reason code or expand the rationale to at least one paragraph.",
      });
    }

    if (APPROVE_LIKE.has(action) && input.rationaleLength < 30) {
      out.push({
        key: "thin_evidence_for_approval",
        severity: "CAUTION",
        message: "Approval rationale is very brief.",
        detail:
          "Even one sentence helps future chairs and auditors understand this decision.",
      });
    }

    const spread = disagreementSpread(input.interviews);
    if (spread >= 2) {
      out.push({
        key: "high_reviewer_disagreement",
        severity: "CAUTION",
        message: "Interviewers disagreed significantly on this applicant.",
        detail:
          "Read the most divergent reviewers' notes before settling on a final action.",
      });
    }

    const incomplete = input.interviews.find((i) => i.unscoredCategoryCount >= 3);
    if (incomplete) {
      out.push({
        key: "rubric_scores_incomplete",
        severity: "CAUTION",
        message: incomplete.reviewerName
          ? `${incomplete.reviewerName} left ${incomplete.unscoredCategoryCount} rubric categories unscored.`
          : "An interviewer left several rubric categories unscored.",
      });
    }

    if (input.timeOnPageMs > 0 && input.timeOnPageMs < 60_000 && submittedInterviews >= 3) {
      out.push({
        key: "unusual_fast_decision",
        severity: "INFO",
        message: "Deciding in under a minute with several interviews on file.",
        detail: "Take another pass through the consensus and risk flags before confirming.",
      });
    }
  }

  return out;
}

export function groupBySeverity(
  warnings: FinalReviewWarning[]
): Record<WarningSeverity, FinalReviewWarning[]> {
  return {
    HIGH_RISK: warnings.filter((w) => w.severity === "HIGH_RISK"),
    CAUTION: warnings.filter((w) => w.severity === "CAUTION"),
    INFO: warnings.filter((w) => w.severity === "INFO"),
  };
}
