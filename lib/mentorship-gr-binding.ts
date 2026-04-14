/**
 * G&R binding layer (Phase 0.9).
 *
 * Surfaces the correct MentorshipProgramGoal set for a mentee based on their
 * role, and keeps GoalReviewRating rows in sync with the active goals at the
 * time a review is opened for writing.
 *
 * The UI (current review form) stays unchanged; this module tightens the seams
 * so Phase 1.0's G&R-backed form can load a review with complete, well-formed
 * data every time.
 */
import { prisma } from "@/lib/prisma";
import type {
  GoalRatingColor,
  MenteeRoleType,
  MentorGoalReview,
  MentorshipProgramGoal,
} from "@prisma/client";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { logger } from "@/lib/logger";

/**
 * Active goals for a mentee's role, ordered by sortOrder.
 *
 * `cycleNumber` is accepted for future quarterly/track overrides but is not
 * yet used — Phase 1.0 can layer in track-specific overrides without changing
 * the call signature.
 */
export async function getGoalsForMentee(
  menteeId: string,
  _cycleNumber?: number
): Promise<MentorshipProgramGoal[]> {
  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    select: { primaryRole: true },
  });
  if (!mentee) return [];

  const roleType = toMenteeRoleType(mentee.primaryRole ?? "");
  if (!roleType) return [];

  return prisma.mentorshipProgramGoal.findMany({
    where: { roleType, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

/**
 * Idempotently ensure GoalReviewRating rows exist for every active goal
 * applicable to this review's mentee. Existing ratings are preserved.
 *
 * New placeholder rows default to GETTING_STARTED so the form can render them
 * without null checks; the mentor overwrites these during review writing.
 */
export async function ensureReviewGoalRatings(
  review: Pick<MentorGoalReview, "id" | "menteeId" | "cycleNumber">
): Promise<void> {
  const [goals, existing] = await Promise.all([
    getGoalsForMentee(review.menteeId, review.cycleNumber),
    prisma.goalReviewRating.findMany({
      where: { reviewId: review.id },
      select: { goalId: true },
    }),
  ]);

  const existingGoalIds = new Set(existing.map((r) => r.goalId));
  const missing = goals.filter((g) => !existingGoalIds.has(g.id));

  if (missing.length === 0) return;

  const defaultRating: GoalRatingColor = "GETTING_STARTED";

  await prisma.goalReviewRating.createMany({
    data: missing.map((goal) => ({
      reviewId: review.id,
      goalId: goal.id,
      rating: defaultRating,
      comments: null,
    })),
    skipDuplicates: true,
  });

  logger.info(
    { reviewId: review.id, addedRatings: missing.length },
    "ensureReviewGoalRatings: backfilled missing goal ratings"
  );
}

export function goalsByRoleType(
  goals: MentorshipProgramGoal[]
): Record<MenteeRoleType, MentorshipProgramGoal[]> {
  const out = {} as Record<MenteeRoleType, MentorshipProgramGoal[]>;
  for (const goal of goals) {
    (out[goal.roleType] ??= []).push(goal);
  }
  return out;
}
