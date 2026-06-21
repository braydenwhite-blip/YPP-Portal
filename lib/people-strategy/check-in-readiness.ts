/**
 * Pure helpers for the check-ins drawer — what is on file vs still missing
 * before leadership compiles a month.
 */

export type CheckInReadinessInput = {
  state: "rated" | "completed" | "missing" | "not_due";
  hasSelfReflection: boolean;
  hasMentorReview: boolean;
  goalRatingCount: number;
  feedbackRequested: number;
  feedbackReceived: number;
  newFeedbackSinceCompile: boolean;
};

export type CheckInReadiness = {
  /** Plain-English gaps — empty when compiled and up to date. */
  missingLabels: string[];
  /** One-line guidance for the primary action. */
  actionHint: string;
  /** True when collaborator feedback arrived after the last compile. */
  suggestRecompile: boolean;
};

export function buildCheckInReadiness(input: CheckInReadinessInput): CheckInReadiness {
  const feedbackPending = Math.max(0, input.feedbackRequested - input.feedbackReceived);

  if (input.state === "not_due") {
    return {
      missingLabels: [],
      actionHint: "This month has not started yet.",
      suggestRecompile: false,
    };
  }

  if (input.state === "missing") {
    const missingLabels: string[] = [];
    if (!input.hasSelfReflection) missingLabels.push("Self-reflection not submitted");
    if (!input.hasMentorReview) missingLabels.push("Mentor goal review not on file");
    if (input.feedbackRequested === 0) {
      missingLabels.push("No collaborator feedback requested");
    } else if (feedbackPending > 0) {
      missingLabels.push(
        `${feedbackPending} of ${input.feedbackRequested} feedback ${feedbackPending === 1 ? "response" : "responses"} still waiting`
      );
    }
    if (input.goalRatingCount === 0 && !input.hasMentorReview) {
      missingLabels.push("No goal ratings to derive performance from");
    }
    missingLabels.push("Check-in not compiled");

    let actionHint = "Compile when ready — partial data is OK.";
    if (input.feedbackReceived > 0) {
      actionHint = `${input.feedbackReceived} feedback ${input.feedbackReceived === 1 ? "response" : "responses"} ready — compile now`;
    } else if (input.feedbackRequested === 0) {
      actionHint = "Request feedback first, or compile from mentor review when available";
    } else if (feedbackPending > 0 && input.feedbackReceived === 0) {
      actionHint = "Waiting on feedback — compile anyway or nudge collaborators";
    }

    return { missingLabels, actionHint, suggestRecompile: false };
  }

  // Compiled (with or without performance rating).
  const missingLabels: string[] = [];
  if (!input.hasSelfReflection) missingLabels.push("Self-reflection still missing");
  if (!input.hasMentorReview) missingLabels.push("Mentor review still missing");
  if (input.feedbackRequested === 0) missingLabels.push("No feedback was requested");
  if (feedbackPending > 0) {
    missingLabels.push(`${feedbackPending} feedback ${feedbackPending === 1 ? "reply" : "replies"} still pending`);
  }

  if (input.newFeedbackSinceCompile) {
    return {
      missingLabels,
      actionHint: "New feedback since compile — recompile to refresh",
      suggestRecompile: true,
    };
  }

  if (feedbackPending > 0) {
    return {
      missingLabels,
      actionHint: `${input.feedbackReceived} in, ${feedbackPending} waiting — recompile when ready`,
      suggestRecompile: false,
    };
  }

  return {
    missingLabels,
    actionHint:
      input.state === "rated"
        ? "Up to date for this month"
        : "Compiled — add mentor ratings or recompile to refresh",
    suggestRecompile: false,
  };
}

export function summarizeCheckInGaps(
  months: Array<{ state: CheckInReadinessInput["state"]; readiness: CheckInReadiness }>
): string | null {
  const missing = months.filter((m) => m.state === "missing");
  const recompile = months.filter((m) => m.readiness.suggestRecompile);
  if (missing.length === 0 && recompile.length === 0) return null;

  const parts: string[] = [];
  if (missing.length > 0) {
    parts.push(
      `${missing.length} month${missing.length === 1 ? "" : "s"} not compiled`
    );
  }
  if (recompile.length > 0) {
    parts.push(
      `${recompile.length} with new feedback to fold in`
    );
  }
  return parts.join(" · ");
}
