/**
 * Pure helpers for the Decision Readiness Meter.
 *
 * Four signals — interview feedback, course materials, initial review, and
 * no open info request. Below 100% the decision dock still allows commits but
 * surfaces a warning state.
 */

export interface ReadinessSignals {
  hasSubmittedInterviewReviews: boolean;
  hasMaterialsComplete: boolean;
  hasReviewerRecommendation: boolean;
  hasNoOpenInfoRequest: boolean;
}

export interface ReadinessInput {
  status?: string;
  interviewReviews: Array<{ id?: string; status?: string | null }>;
  applicationReviews: Array<{
    summary?: string | null;
    nextStep?: string | null;
    status?: string | null;
    isLeadReview?: boolean;
  }>;
  interviewerAssignmentCount?: number;
  materialsReadyAt: Date | string | null;
  materials?: { courseOutline: boolean; firstClassPlan: boolean };
  infoRequest?: string | null;
}

function isSubmittedReview(review: { status?: string | null }): boolean {
  return review.status === undefined || review.status === "SUBMITTED";
}

function hasSubmittedRecommendation(
  reviews: ReadinessInput["applicationReviews"]
): boolean {
  const lead = reviews.find((r) => r.isLeadReview);
  if (lead) {
    return isSubmittedReview(lead) && Boolean(lead.summary?.trim() || lead.nextStep);
  }
  return reviews.some(
    (review) =>
      isSubmittedReview(review) &&
      Boolean(review.summary?.trim() || review.nextStep?.trim())
  );
}

export function computeReadinessSignals(input: ReadinessInput): ReadinessSignals {
  const submittedInterviews = (input.interviewReviews ?? []).filter(isSubmittedReview);
  const assigned = input.interviewerAssignmentCount ?? 0;
  const hasSubmittedInterviewReviews =
    assigned > 0 ? submittedInterviews.length >= assigned : submittedInterviews.length > 0;

  const hasMaterialsComplete =
    Boolean(input.materialsReadyAt) ||
    Boolean(input.materials?.courseOutline && input.materials?.firstClassPlan);

  const hasReviewerRecommendation = hasSubmittedRecommendation(
    input.applicationReviews ?? []
  );

  const hasNoOpenInfoRequest =
    input.status !== "INFO_REQUESTED" && !input.infoRequest?.trim();

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
        title: "Interview feedback",
        complete: "All interviewer reviews submitted",
        gap: "Interview feedback pending",
      };
    case "hasMaterialsComplete":
      return {
        title: "Course materials",
        complete: "Course outline and first-class plan on file",
        gap: "Course materials still missing",
      };
    case "hasReviewerRecommendation":
      return {
        title: "Initial review",
        complete: "Reviewer recommendation submitted",
        gap: "Initial review pending",
      };
    case "hasNoOpenInfoRequest":
      return {
        title: "Info request",
        complete: "No outstanding info request",
        gap: "Open info request awaiting response",
      };
  }
}
