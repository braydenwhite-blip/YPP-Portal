/**
 * Pure helpers for the Decision Readiness Meter.
 *
 * The meter displays four signals — interviews submitted, materials complete,
 * lead-reviewer recommendation, and no open info request. Below 100% the dock
 * still allows decisions but the primary action shows a warning state.
 */

export interface ReadinessSignals {
  hasSubmittedInterviewReviews: boolean;
  hasMaterialsComplete: boolean;
  hasReviewerRecommendation: boolean;
  hasNoOpenInfoRequest: boolean;
}

export interface ReadinessInput {
  interviewReviews: Array<{ id: string; status?: string | null } | { id: string }>;
  applicationReviews: Array<{ summary?: string | null; nextStep?: string | null }>;
  materialsReadyAt: Date | string | null;
  infoRequest?: string | null;
}

export function computeReadinessSignals(input: ReadinessInput): ReadinessSignals {
  const hasSubmittedInterviewReviews = (input.interviewReviews ?? []).length > 0;
  const hasMaterialsComplete = Boolean(input.materialsReadyAt);
  const hasReviewerRecommendation = (input.applicationReviews ?? []).some(
    (review) => Boolean(review.summary?.trim() || review.nextStep?.trim())
  );
  const hasNoOpenInfoRequest = !input.infoRequest?.trim();

  return {
    hasSubmittedInterviewReviews,
    hasMaterialsComplete,
    hasReviewerRecommendation,
    hasNoOpenInfoRequest,
  };
}

export function readinessPercentage(signals: ReadinessSignals): number {
  const total = 4;
  const met =
    Number(signals.hasSubmittedInterviewReviews) +
    Number(signals.hasMaterialsComplete) +
    Number(signals.hasReviewerRecommendation) +
    Number(signals.hasNoOpenInfoRequest);
  return Math.round((met / total) * 100);
}

export function readinessSignalLabel(
  key: keyof ReadinessSignals
): { title: string; complete: string; gap: string } {
  switch (key) {
    case "hasSubmittedInterviewReviews":
      return {
        title: "Interview reviews",
        complete: "All interview reviews submitted",
        gap: "Interview review pending",
      };
    case "hasMaterialsComplete":
      return {
        title: "Materials",
        complete: "Course outline and first-class plan ready",
        gap: "Materials still missing",
      };
    case "hasReviewerRecommendation":
      return {
        title: "Lead recommendation",
        complete: "Lead reviewer note submitted",
        gap: "Lead reviewer recommendation pending",
      };
    case "hasNoOpenInfoRequest":
      return {
        title: "Info request",
        complete: "No outstanding info request",
        gap: "Open info request awaiting response",
      };
  }
}
