/**
 * Pure, dependency-free aggregation of an applicant's review evidence for the
 * Chair's decision workspace. Every number here is grounded in stored review
 * and interview data — no AI-generated or speculative claims. Kept free of
 * Prisma so it is shareable by server queries, the client workspace, and tests.
 */

export type ProgressRating =
  | "BEHIND_SCHEDULE"
  | "GETTING_STARTED"
  | "ON_TRACK"
  | "ABOVE_AND_BEYOND";

const RATING_SCORE: Record<ProgressRating, number> = {
  BEHIND_SCHEDULE: 0,
  GETTING_STARTED: 1,
  ON_TRACK: 2,
  ABOVE_AND_BEYOND: 3,
};

export const RATING_SCALE_MAX = 3;

export type EvidenceCategory = {
  category: string;
  rating: string | null;
  notes: string | null;
};

export type EvidenceInitialReview = {
  reviewerId: string;
  reviewerName: string | null;
  reviewDate: string | null;
  isLead: boolean;
  nextStep: string | null;
  overallRating: string | null;
  summary: string | null;
  notes: string | null;
  concerns: string | null;
  categories: EvidenceCategory[];
};

export type EvidenceInterviewReview = {
  reviewerId: string;
  reviewerName: string | null;
  round: number | null;
  recommendation: string | null;
  overallRating: string | null;
  revisionRequirements: string | null;
  applicantMessage: string | null;
  categories: EvidenceCategory[];
};

export type RecommendationCounts = {
  ACCEPT: number;
  ACCEPT_WITH_SUPPORT: number;
  HOLD: number;
  REJECT: number;
};

export type ApplicantOverview = {
  initialReviewCount: number;
  completedInterviewCount: number;
  /** Average of every category rating across all initial reviews, 0–3, or null. */
  initialAverage: number | null;
  /** Average of every category rating across all interview reviews, 0–3, or null. */
  interviewAverage: number | null;
  /** interviewAverage − initialAverage, when both exist. */
  averageDelta: number | null;
  recommendationCounts: RecommendationCounts;
  majorityRecommendation: keyof RecommendationCounts | null;
  /** Assigned interviewers for the current round who have not submitted yet. */
  missingInterviewCount: number;
  /** Concrete, evidence-backed sentences for the overview panel. */
  consensusStatements: string[];
  /** True when reviewers materially disagree (rating spread ≥ 2 or split rec). */
  hasDisagreement: boolean;
  disagreementStatement: string | null;
  missingInformation: string[];
};

function scoreOf(rating: string | null | undefined): number | null {
  if (!rating) return null;
  const score = RATING_SCORE[rating as ProgressRating];
  return typeof score === "number" ? score : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Mean of all category ratings (0–3) across a set of reviews, or null. */
export function averageCategoryScore(
  reviews: Array<{ overallRating?: string | null; categories: EvidenceCategory[] }>
): number | null {
  const scores: number[] = [];
  for (const review of reviews) {
    for (const category of review.categories) {
      const score = scoreOf(category.rating);
      if (score !== null) scores.push(score);
    }
    // Fall back to the overall rating when a review has no category ratings.
    if (review.categories.length === 0) {
      const overall = scoreOf(review.overallRating ?? null);
      if (overall !== null) scores.push(overall);
    }
  }
  if (scores.length === 0) return null;
  return round1(scores.reduce((sum, n) => sum + n, 0) / scores.length);
}

function countRecommendations(reviews: EvidenceInterviewReview[]): RecommendationCounts {
  const counts: RecommendationCounts = {
    ACCEPT: 0,
    ACCEPT_WITH_SUPPORT: 0,
    HOLD: 0,
    REJECT: 0,
  };
  for (const review of reviews) {
    if (review.recommendation && review.recommendation in counts) {
      counts[review.recommendation as keyof RecommendationCounts] += 1;
    }
  }
  return counts;
}

function majorityRecommendation(
  counts: RecommendationCounts
): keyof RecommendationCounts | null {
  const total =
    counts.ACCEPT + counts.ACCEPT_WITH_SUPPORT + counts.HOLD + counts.REJECT;
  if (total === 0) return null;
  const approve = counts.ACCEPT + counts.ACCEPT_WITH_SUPPORT;
  if (approve > total / 2) return "ACCEPT";
  if (counts.REJECT > total / 2) return "REJECT";
  if (counts.HOLD > total / 2) return "HOLD";
  return null;
}

function overallRatingSpread(reviews: EvidenceInterviewReview[]): number {
  const scores = reviews
    .map((r) => scoreOf(r.overallRating))
    .filter((n): n is number => n !== null);
  if (scores.length < 2) return 0;
  return Math.max(...scores) - Math.min(...scores);
}

export type ComputeOverviewInput = {
  initialReviews: EvidenceInitialReview[];
  interviewReviews: EvidenceInterviewReview[];
  /** Number of assigned (non-removed) interviewers for the current round. */
  assignedInterviewerCount: number;
  /** Whether a required field is missing on the application. */
  missingInformation?: string[];
};

export function computeApplicantOverview(
  input: ComputeOverviewInput
): ApplicantOverview {
  const { initialReviews, interviewReviews, assignedInterviewerCount } = input;

  const completedInterviewCount = interviewReviews.length;
  const initialAverage = averageCategoryScore(initialReviews);
  const interviewAverage = averageCategoryScore(interviewReviews);
  const averageDelta =
    initialAverage !== null && interviewAverage !== null
      ? round1(interviewAverage - initialAverage)
      : null;

  const recommendationCounts = countRecommendations(interviewReviews);
  const majority = majorityRecommendation(recommendationCounts);

  const missingInterviewCount = Math.max(
    0,
    assignedInterviewerCount - completedInterviewCount
  );

  const consensusStatements: string[] = [];
  const approveCount =
    recommendationCounts.ACCEPT + recommendationCounts.ACCEPT_WITH_SUPPORT;
  if (approveCount > 0) {
    consensusStatements.push(
      `${approveCount} interviewer${approveCount === 1 ? "" : "s"} recommended approval`
    );
  }
  if (recommendationCounts.HOLD > 0) {
    consensusStatements.push(
      `${recommendationCounts.HOLD} interviewer${
        recommendationCounts.HOLD === 1 ? "" : "s"
      } recommended hold`
    );
  }
  if (recommendationCounts.REJECT > 0) {
    consensusStatements.push(
      `${recommendationCounts.REJECT} interviewer${
        recommendationCounts.REJECT === 1 ? "" : "s"
      } recommended reject`
    );
  }
  if (initialAverage !== null) {
    consensusStatements.push(
      `Initial review average is ${initialAverage.toFixed(1)} of ${RATING_SCALE_MAX}`
    );
  }
  if (interviewAverage !== null) {
    consensusStatements.push(
      `Interview average is ${interviewAverage.toFixed(1)} of ${RATING_SCALE_MAX}`
    );
  }
  if (averageDelta !== null && Math.abs(averageDelta) >= 0.1) {
    const direction = averageDelta > 0 ? "higher" : "lower";
    consensusStatements.push(
      `Interview average is ${Math.abs(averageDelta).toFixed(1)} point${
        Math.abs(averageDelta) === 1 ? "" : "s"
      } ${direction} than the initial review average`
    );
  }

  // Disagreement: a wide spread of interview overall ratings OR a split between
  // an approve recommendation and a reject recommendation.
  const ratingSpread = overallRatingSpread(interviewReviews);
  const hasSplitRecommendation =
    approveCount > 0 && recommendationCounts.REJECT > 0;
  const hasDisagreement = ratingSpread >= 2 || hasSplitRecommendation;
  let disagreementStatement: string | null = null;
  if (hasSplitRecommendation) {
    disagreementStatement = `Reviewers are split: ${approveCount} recommended approval and ${recommendationCounts.REJECT} recommended reject`;
  } else if (ratingSpread >= 2) {
    disagreementStatement = `Interview overall ratings span ${ratingSpread} points on a ${RATING_SCALE_MAX}-point scale`;
  }

  const missingInformation = [...(input.missingInformation ?? [])];
  if (missingInterviewCount > 0) {
    missingInformation.push(
      `${missingInterviewCount} assigned interviewer${
        missingInterviewCount === 1 ? "" : "s"
      } ${missingInterviewCount === 1 ? "has" : "have"} not submitted live interview notes`
    );
  }
  if (initialReviews.length === 0) {
    missingInformation.push("No initial reviews on file");
  }

  return {
    initialReviewCount: initialReviews.length,
    completedInterviewCount,
    initialAverage,
    interviewAverage,
    averageDelta,
    recommendationCounts,
    majorityRecommendation: majority,
    missingInterviewCount,
    consensusStatements,
    hasDisagreement,
    disagreementStatement,
    missingInformation,
  };
}
