import type { GoalRatingColor } from "@prisma/client";

/**
 * People Strategy — Performance x Potential succession matrix (behind
 * ENABLE_QUARTERLY_REVIEWS).
 *
 * Both axes REUSE the live `GoalRatingColor` enum rather than introducing a
 * second rating concept. The kickoff's four levels map onto `GoalRatingColor`
 * exactly as the monthly check-in rating does (see
 * `lib/people-strategy/check-in-rating.ts`):
 *
 *   At Risk          -> BEHIND_SCHEDULE
 *   Needs Attention  -> GETTING_STARTED
 *   On Track         -> ACHIEVED
 *   Above & Beyond   -> ABOVE_AND_BEYOND
 *
 * Everything here is pure (no I/O, no clock, no Prisma runtime) so it is
 * deterministic and unit-testable. The matrix label is DERIVED, never
 * persisted — `QuarterlyReview` stores only the two ratings + `successionFlag`.
 */

/**
 * Matrix labels keyed by `[performanceRating][potentialRating]`.
 * Performance is the first axis, potential the second.
 */
const MATRIX_LABELS: Record<
  GoalRatingColor,
  Record<GoalRatingColor, string>
> = {
  // Above & Beyond performance
  ABOVE_AND_BEYOND: {
    BEHIND_SCHEDULE: "Peaked Performer",
    GETTING_STARTED: "Strong Contributor",
    ACHIEVED: "Accelerate",
    ABOVE_AND_BEYOND: "Clear Successor",
  },
  // On Track performance
  ACHIEVED: {
    BEHIND_SCHEDULE: "Steady Performer",
    GETTING_STARTED: "Solid Contributor",
    ACHIEVED: "Strong Candidate",
    ABOVE_AND_BEYOND: "Rising Talent",
  },
  // Needs Attention performance
  GETTING_STARTED: {
    BEHIND_SCHEDULE: "Blocked Performer",
    GETTING_STARTED: "Inconsistent Performer",
    ACHIEVED: "Developing Performer",
    ABOVE_AND_BEYOND: "Untapped Talent",
  },
  // At Risk performance
  BEHIND_SCHEDULE: {
    BEHIND_SCHEDULE: "Critical Risk",
    GETTING_STARTED: "Disengaged Performer",
    ACHIEVED: "Struggling Performer",
    ABOVE_AND_BEYOND: "Misaligned Talent",
  },
};

/**
 * Resolve the matrix label for a `(performance, potential)` placement.
 * Pure lookup — never persisted, always derived from the two ratings.
 */
export function getMatrixLabel(
  performanceRating: GoalRatingColor,
  potentialRating: GoalRatingColor
): string {
  return MATRIX_LABELS[performanceRating][potentialRating];
}

/** Ratings that count as "On Track or above" for succession. */
const SUCCESSION_RATINGS: ReadonlySet<GoalRatingColor> = new Set<GoalRatingColor>([
  "ACHIEVED", // On Track
  "ABOVE_AND_BEYOND", // Above & Beyond
]);

/**
 * Whether a `(performance, potential)` placement is a succession candidate:
 * performance is On Track / Above & Beyond AND potential is On Track / Above &
 * Beyond. This is the canonical source for `QuarterlyReview.successionFlag`.
 */
export function isSuccessionCandidate(
  performanceRating: GoalRatingColor,
  potentialRating: GoalRatingColor
): boolean {
  return (
    SUCCESSION_RATINGS.has(performanceRating) &&
    SUCCESSION_RATINGS.has(potentialRating)
  );
}
