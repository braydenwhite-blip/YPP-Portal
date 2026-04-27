import { describe, expect, it } from "vitest";
import {
  computeFinalReviewWarnings,
  groupBySeverity,
  type FinalReviewWarningInput,
  type InterviewSignal,
} from "@/lib/final-review-warnings";

function input(overrides: Partial<FinalReviewWarningInput> = {}): FinalReviewWarningInput {
  return {
    pendingAction: null,
    status: "CHAIR_REVIEW",
    interviews: [],
    rationaleLength: 200,
    rejectReasonCode: null,
    hasMaterialsComplete: true,
    hasOpenInfoRequest: false,
    hasRecentTimelineActivity: true,
    hasPriorSupersededDecision: false,
    isCrossChapter: false,
    timeOnPageMs: 5 * 60 * 1000,
    ...overrides,
  };
}

const STRONG_INTERVIEW: InterviewSignal = {
  reviewerName: "Alex",
  recommendation: "ACCEPT",
  overallRating: "ON_TRACK",
  hasNarrative: true,
  unscoredCategoryCount: 0,
};

const WEAK_INTERVIEW: InterviewSignal = {
  reviewerName: "Pat",
  recommendation: "REJECT",
  overallRating: "BEHIND_SCHEDULE",
  hasNarrative: true,
  unscoredCategoryCount: 0,
};

const ABOVE_INTERVIEW: InterviewSignal = {
  reviewerName: "Jordan",
  recommendation: "ACCEPT",
  overallRating: "ABOVE_AND_BEYOND",
  hasNarrative: true,
  unscoredCategoryCount: 0,
};

describe("computeFinalReviewWarnings — environment warnings (no pending action)", () => {
  it("flags no_recent_reviewer_activity when timeline is quiet", () => {
    const warnings = computeFinalReviewWarnings(
      input({ hasRecentTimelineActivity: false })
    );
    expect(warnings.map((w) => w.key)).toContain("no_recent_reviewer_activity");
  });

  it("flags open_info_request as CAUTION", () => {
    const warnings = computeFinalReviewWarnings(input({ hasOpenInfoRequest: true }));
    const target = warnings.find((w) => w.key === "open_info_request");
    expect(target?.severity).toBe("CAUTION");
  });

  it("flags missing_required_materials when materials aren't ready", () => {
    const warnings = computeFinalReviewWarnings(
      input({ hasMaterialsComplete: false })
    );
    expect(warnings.map((w) => w.key)).toContain("missing_required_materials");
  });

  it("flags prior_rescinded_decision as INFO", () => {
    const warnings = computeFinalReviewWarnings(
      input({ hasPriorSupersededDecision: true })
    );
    const target = warnings.find((w) => w.key === "prior_rescinded_decision");
    expect(target?.severity).toBe("INFO");
  });

  it("flags cross_chapter_chair_decision as CAUTION", () => {
    const warnings = computeFinalReviewWarnings(input({ isCrossChapter: true }));
    expect(warnings.find((w) => w.key === "cross_chapter_chair_decision")?.severity).toBe(
      "CAUTION"
    );
  });
});

describe("computeFinalReviewWarnings — approve-side warnings", () => {
  it("flags approve_with_low_interview_score as HIGH_RISK on a single Below-rating", () => {
    const warnings = computeFinalReviewWarnings(
      input({ pendingAction: "APPROVE", interviews: [WEAK_INTERVIEW, STRONG_INTERVIEW] })
    );
    const target = warnings.find((w) => w.key === "approve_with_low_interview_score");
    expect(target?.severity).toBe("HIGH_RISK");
    expect(target?.detail).toContain("Pat");
  });

  it("flags approve_without_interviews when zero submitted reviews", () => {
    const warnings = computeFinalReviewWarnings(
      input({ pendingAction: "APPROVE", interviews: [] })
    );
    expect(warnings.find((w) => w.key === "approve_without_interviews")?.severity).toBe(
      "HIGH_RISK"
    );
  });

  it("flags approve_without_interview_comments when narratives are empty", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "APPROVE",
        interviews: [{ ...STRONG_INTERVIEW, hasNarrative: false }],
      })
    );
    expect(warnings.find((w) => w.key === "approve_without_interview_comments")?.severity).toBe(
      "CAUTION"
    );
  });

  it("flags thin_evidence_for_approval when rationale < 30 chars", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "APPROVE",
        interviews: [STRONG_INTERVIEW],
        rationaleLength: 10,
      })
    );
    expect(warnings.find((w) => w.key === "thin_evidence_for_approval")?.severity).toBe(
      "CAUTION"
    );
  });
});

describe("computeFinalReviewWarnings — reject-side warnings", () => {
  it("flags reject_with_high_interview_score on any Above rating", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "REJECT",
        interviews: [ABOVE_INTERVIEW],
        rationaleLength: 200,
      })
    );
    const target = warnings.find((w) => w.key === "reject_with_high_interview_score");
    expect(target?.severity).toBe("HIGH_RISK");
    expect(target?.detail).toContain("Jordan");
  });

  it("flags thin_evidence_for_rejection only with reason code OTHER + short rationale", () => {
    expect(
      computeFinalReviewWarnings(
        input({
          pendingAction: "REJECT",
          rationaleLength: 30,
          rejectReasonCode: "OTHER",
        })
      ).map((w) => w.key)
    ).toContain("thin_evidence_for_rejection");
    expect(
      computeFinalReviewWarnings(
        input({
          pendingAction: "REJECT",
          rationaleLength: 30,
          rejectReasonCode: "TEACHING_FIT",
        })
      ).map((w) => w.key)
    ).not.toContain("thin_evidence_for_rejection");
  });
});

describe("computeFinalReviewWarnings — consensus-conflict warnings", () => {
  it("flags final_decision_conflicts_with_consensus when chair contradicts the majority", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "REJECT",
        interviews: [STRONG_INTERVIEW, STRONG_INTERVIEW, STRONG_INTERVIEW],
        rationaleLength: 200,
      })
    );
    expect(
      warnings.find((w) => w.key === "final_decision_conflicts_with_consensus")?.severity
    ).toBe("HIGH_RISK");
  });

  it("does not flag when the chair's pick aligns with the majority", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "APPROVE",
        interviews: [STRONG_INTERVIEW, STRONG_INTERVIEW],
      })
    );
    expect(warnings.map((w) => w.key)).not.toContain(
      "final_decision_conflicts_with_consensus"
    );
  });
});

describe("computeFinalReviewWarnings — disagreement and incomplete rubrics", () => {
  it("flags high_reviewer_disagreement when overall ratings span ≥ 2 scale points", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "APPROVE",
        interviews: [WEAK_INTERVIEW, ABOVE_INTERVIEW],
      })
    );
    expect(warnings.find((w) => w.key === "high_reviewer_disagreement")?.severity).toBe(
      "CAUTION"
    );
  });

  it("flags rubric_scores_incomplete when ≥ 3 categories unscored", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "APPROVE",
        interviews: [{ ...STRONG_INTERVIEW, unscoredCategoryCount: 4 }],
      })
    );
    expect(warnings.find((w) => w.key === "rubric_scores_incomplete")?.severity).toBe(
      "CAUTION"
    );
  });

  it("flags unusual_fast_decision under 60s with 3+ interviews", () => {
    const warnings = computeFinalReviewWarnings(
      input({
        pendingAction: "APPROVE",
        interviews: [STRONG_INTERVIEW, STRONG_INTERVIEW, STRONG_INTERVIEW],
        timeOnPageMs: 30_000,
      })
    );
    expect(warnings.find((w) => w.key === "unusual_fast_decision")?.severity).toBe("INFO");
  });
});

describe("groupBySeverity", () => {
  it("partitions warnings by severity preserving order within each bucket", () => {
    const grouped = groupBySeverity([
      { key: "approve_without_interviews", severity: "HIGH_RISK", message: "" },
      { key: "thin_evidence_for_approval", severity: "CAUTION", message: "" },
      { key: "no_recent_reviewer_activity", severity: "INFO", message: "" },
      { key: "approve_with_low_interview_score", severity: "HIGH_RISK", message: "" },
    ]);
    expect(grouped.HIGH_RISK.map((w) => w.key)).toEqual([
      "approve_without_interviews",
      "approve_with_low_interview_score",
    ]);
    expect(grouped.CAUTION).toHaveLength(1);
    expect(grouped.INFO).toHaveLength(1);
  });
});
