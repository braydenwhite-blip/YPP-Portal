import type { GoalRatingColor } from "@prisma/client";

/**
 * People Strategy — derive a single monthly performance rating from EXISTING
 * goal-progress data. Behind ENABLE_QUARTERLY_REVIEWS.
 *
 * This is the only place that turns goal data into a check-in performance
 * rating. It deliberately reuses the live `GoalRatingColor` enum (the same one
 * `GoalReviewRating` / `MentorGoalReview.overallRating` already use) instead of
 * introducing a second monthly rating concept.
 *
 * The kickoff's four levels map onto `GoalRatingColor` as documented in
 * INTEGRATION_MAP.md:
 *   At Risk          -> BEHIND_SCHEDULE  (Red,    0 pts)
 *   Needs Attention  -> GETTING_STARTED  (Yellow, 1 pt)
 *   On Track         -> ACHIEVED         (Green,  2 pts)
 *   Above & Beyond   -> ABOVE_AND_BEYOND (Purple, 3 pts)
 *
 * Everything here is pure (no I/O, no clock) so it is deterministic and
 * testable.
 */

/** Points per rating level — also the canonical level ordering. */
export const RATING_POINTS: Record<GoalRatingColor, number> = {
  BEHIND_SCHEDULE: 0,
  GETTING_STARTED: 1,
  ACHIEVED: 2,
  ABOVE_AND_BEYOND: 3,
};

/** Display label for each rating, matching the kickoff Performance axis. */
export const RATING_LABELS: Record<GoalRatingColor, string> = {
  BEHIND_SCHEDULE: "At Risk",
  GETTING_STARTED: "Needs Attention",
  ACHIEVED: "On Track",
  ABOVE_AND_BEYOND: "Above & Beyond",
};

const POINTS_TO_RATING: GoalRatingColor[] = [
  "BEHIND_SCHEDULE",
  "GETTING_STARTED",
  "ACHIEVED",
  "ABOVE_AND_BEYOND",
];

/**
 * Average a set of per-goal `GoalRatingColor` ratings into a single rating by
 * mapping each to points, averaging, and rounding to the nearest level.
 * Returns `null` when there are no ratings to average.
 */
export function deriveRatingFromGoalRatings(
  ratings: GoalRatingColor[]
): GoalRatingColor | null {
  if (ratings.length === 0) return null;
  const total = ratings.reduce((sum, r) => sum + RATING_POINTS[r], 0);
  const avg = total / ratings.length;
  const rounded = Math.round(avg);
  const index = Math.min(POINTS_TO_RATING.length - 1, Math.max(0, rounded));
  return POINTS_TO_RATING[index];
}

/**
 * The shape of an existing mentor goal review, reduced to just the goal-progress
 * fields needed to derive a performance rating.
 */
export interface GoalReviewForRating {
  overallRating: GoalRatingColor | null | undefined;
  goalRatings: Array<{ rating: GoalRatingColor }>;
}

/**
 * Derive the monthly performance rating from an existing mentor goal review.
 * Prefers the mentor's explicit `overallRating`; otherwise averages the
 * per-goal ratings. Returns `null` when there is no goal data to derive from.
 */
export function derivePerformanceRating(
  review: GoalReviewForRating | null | undefined
): GoalRatingColor | null {
  if (!review) return null;
  if (review.overallRating) return review.overallRating;
  return deriveRatingFromGoalRatings(review.goalRatings.map((g) => g.rating));
}
