/**
 * Detects when a chair's chosen decision conflicts with reviewer signals.
 * Phase 2C surfaces these via a pre-confirm warning modal.
 */

import type { ChairDecisionAction, InstructorInterviewRecommendation } from "@prisma/client";

export type ContrarianSignalKind =
  | "APPROVE_WITH_RED_FLAG"
  | "APPROVE_WITH_MAJORITY_REJECT"
  | "APPROVE_WITHOUT_INTERVIEWS"
  | "REJECT_WITH_MAJORITY_ACCEPT"
  | "REJECT_REVERSING_PRIOR_APPROVAL";

export interface ContrarianSignal {
  kind: ContrarianSignalKind;
  message: string;
  detail?: string;
}

export interface ContrarianInput {
  action: ChairDecisionAction;
  hasSubmittedInterviewReviews: boolean;
  recommendations: InstructorInterviewRecommendation[];
  redFlagCount: number;
  redFlagSources?: string[];
  rejectingReviewerNames?: string[];
  acceptingReviewerNames?: string[];
  priorDecisionAction?: ChairDecisionAction | null;
}

export function detectContrarianSignals(input: ContrarianInput): ContrarianSignal[] {
  const signals: ContrarianSignal[] = [];
  const acceptCount =
    input.recommendations.filter(
      (r) => r === "ACCEPT" || r === "ACCEPT_WITH_SUPPORT"
    ).length;
  const rejectCount = input.recommendations.filter((r) => r === "REJECT").length;
  const total = input.recommendations.length;
  const isApproveLike = input.action === "APPROVE";
  const isReject = input.action === "REJECT";

  if (isApproveLike && input.redFlagCount > 0) {
    signals.push({
      kind: "APPROVE_WITH_RED_FLAG",
      message: `${input.redFlagCount} red-flag tag${input.redFlagCount > 1 ? "s" : ""} raised by interviewers`,
      detail:
        input.redFlagSources && input.redFlagSources.length > 0
          ? `From ${input.redFlagSources.join(", ")}`
          : undefined,
    });
  }

  if (isApproveLike && total > 0 && rejectCount > total / 2) {
    signals.push({
      kind: "APPROVE_WITH_MAJORITY_REJECT",
      message: `${rejectCount} of ${total} interview reviews recommend Reject`,
      detail:
        input.rejectingReviewerNames && input.rejectingReviewerNames.length > 0
          ? `Including ${input.rejectingReviewerNames.join(", ")}`
          : undefined,
    });
  }

  if (isApproveLike && !input.hasSubmittedInterviewReviews) {
    signals.push({
      kind: "APPROVE_WITHOUT_INTERVIEWS",
      message: "No submitted interview reviews on file",
      detail:
        "You're approving without recorded interview signal. Confirm this is intentional.",
    });
  }

  if (isReject && total > 0 && acceptCount > total / 2) {
    signals.push({
      kind: "REJECT_WITH_MAJORITY_ACCEPT",
      message: `${acceptCount} of ${total} interview reviews recommend Accept`,
      detail:
        input.acceptingReviewerNames && input.acceptingReviewerNames.length > 0
          ? `Including ${input.acceptingReviewerNames.join(", ")}`
          : undefined,
    });
  }

  if (isReject && input.priorDecisionAction === "APPROVE") {
    signals.push({
      kind: "REJECT_REVERSING_PRIOR_APPROVAL",
      message: "Reverses an earlier Approve decision",
      detail: "Use the rescind flow if you need to undo a prior approval cleanly.",
    });
  }

  return signals;
}
