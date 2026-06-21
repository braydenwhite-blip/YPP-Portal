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

/** Short coaching copy for each matrix cell (handoff reference). */
export const MATRIX_CELL_ADVICE: Record<
  GoalRatingColor,
  Record<GoalRatingColor, string>
> = {
  ABOVE_AND_BEYOND: {
    BEHIND_SCHEDULE: "Strong delivery, low ceiling",
    GETTING_STARTED: "Stretch assignments",
    ACHIEVED: "Mentor others · prep next role",
    ABOVE_AND_BEYOND: "Fast-track · succession pipeline",
  },
  ACHIEVED: {
    BEHIND_SCHEDULE: "Maintain clear expectations",
    GETTING_STARTED: "Targeted development plan",
    ACHIEVED: "Stretch with new challenges",
    ABOVE_AND_BEYOND: "Accelerated growth path",
  },
  GETTING_STARTED: {
    BEHIND_SCHEDULE: "Clarify role · check blockers",
    GETTING_STARTED: "Coaching needed",
    ACHIEVED: "Set clear targets",
    ABOVE_AND_BEYOND: "Urgent support · engagement gap",
  },
  BEHIND_SCHEDULE: {
    BEHIND_SCHEDULE: "PIP or role change",
    GETTING_STARTED: "Understand root cause",
    ACHIEVED: "Structured improvement",
    ABOVE_AND_BEYOND: "Investigate barriers",
  },
};

export type MatrixCellZone = "succession" | "strong" | "developing" | "risk";

/** Background zone for the 4×4 succession grid (handoff palette). */
export function matrixCellZone(
  performanceRating: GoalRatingColor,
  potentialRating: GoalRatingColor
): MatrixCellZone {
  const perf = RATING_LEVEL[performanceRating];
  const pot = RATING_LEVEL[potentialRating];
  const sum = perf + pot;
  if (perf >= 3 && pot >= 3) return "succession";
  if (sum >= 6) return "strong";
  if (sum >= 4) return "developing";
  return "risk";
}

const RATING_LEVEL: Record<GoalRatingColor, number> = {
  BEHIND_SCHEDULE: 1,
  GETTING_STARTED: 2,
  ACHIEVED: 3,
  ABOVE_AND_BEYOND: 4,
};
