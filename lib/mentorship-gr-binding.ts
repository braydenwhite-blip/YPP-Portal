/**
 * G&R binding layer (Phase 1.0).
 *
 * Sources the correct goals for a mentee's monthly review from their active
 * GRDocument, falling back to MentorshipProgramGoal only when no active G&R
 * document exists. Keeps GoalReviewRating rows in sync with the active goals
 * at the time a review is opened for writing.
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
 * Normalized goal representation for the review form.
 * The `source` field indicates where the goal came from so that
 * ensureReviewGoalRatings can write the correct FK.
 */
export type ReviewableGoal = {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  grDocumentGoalId: string | null;
  legacyGoalId: string | null;
};

/**
 * Returns all active goals for a mentee's current review cycle.
 *
 * Priority order:
 *   1. GRDocumentGoal rows from the mentee's ACTIVE GRDocument (lifecycleStatus=ACTIVE)
 *      Ordered: priority DESC, dueDate ASC NULLS LAST, sortOrder ASC
 *   2. MentorshipProgramGoal fallback when no ACTIVE GRDocument exists.
 */
export async function getGoalsForMentee(
  menteeId: string,
  _cycleNumber?: number
): Promise<ReviewableGoal[]> {
  // Try the G&R document first
  const grDoc = await prisma.gRDocument.findFirst({
    where: { userId: menteeId, status: "ACTIVE" },
    include: {
      goals: {
        where: { lifecycleStatus: "ACTIVE" },
        orderBy: [
          { priority: "desc" },
          { dueDate: "asc" },
          { sortOrder: "asc" },
        ],
      },
    },
  });

  if (grDoc) {
    // Doc exists — never fall back to legacy even if there are 0 active goals.
    // Treat "all goals completed/archived" as a real state; return empty and let
    // the review form render the "All goals completed; awaiting next-cycle goals" state.
    return grDoc.goals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      sortOrder: g.sortOrder,
      grDocumentGoalId: g.id,
      legacyGoalId: null,
    }));
  }

  // Fallback: legacy MentorshipProgramGoal list (only when no G&R doc exists at all)
  const mentee = await prisma.user.findUnique({
    where: { id: menteeId },
    select: { primaryRole: true },
  });
  if (!mentee) return [];

  const roleType = toMenteeRoleType(mentee.primaryRole ?? "");
  if (!roleType) return [];

  const legacyGoals = await prisma.mentorshipProgramGoal.findMany({
    where: { roleType, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return legacyGoals.map((g) => ({
    id: g.id,
    title: g.title,
    description: g.description ?? "",
    sortOrder: g.sortOrder,
    grDocumentGoalId: null,
    legacyGoalId: g.id,
  }));
}

/**
 * Idempotently ensure GoalReviewRating rows exist for every active goal
 * applicable to this review's mentee. Existing ratings are preserved.
 *
 * Ratings now point at grDocumentGoalId (G&R path) or goalId (legacy path)
 * depending on which source the goals came from.
 */
export async function ensureReviewGoalRatings(
  review: Pick<MentorGoalReview, "id" | "menteeId" | "cycleNumber">
): Promise<void> {
  const goals = await getGoalsForMentee(review.menteeId, review.cycleNumber);
  if (goals.length === 0) return;

  const existing = await prisma.goalReviewRating.findMany({
    where: { reviewId: review.id },
    select: { goalId: true, grDocumentGoalId: true },
  });

  const existingGrIds = new Set(
    existing.map((r) => r.grDocumentGoalId).filter(Boolean)
  );
  const existingLegacyIds = new Set(
    existing.map((r) => r.goalId).filter(Boolean)
  );

  const defaultRating: GoalRatingColor = "GETTING_STARTED";

  const toCreate = goals.filter((g) => {
    if (g.grDocumentGoalId) return !existingGrIds.has(g.grDocumentGoalId);
    return !existingLegacyIds.has(g.legacyGoalId!);
  });

  if (toCreate.length === 0) return;

  await prisma.goalReviewRating.createMany({
    data: toCreate.map((goal) => ({
      reviewId: review.id,
      grDocumentGoalId: goal.grDocumentGoalId,
      goalId: goal.legacyGoalId,
      rating: defaultRating,
      comments: null,
    })),
    skipDuplicates: true,
  });

  logger.info(
    { reviewId: review.id, addedRatings: toCreate.length },
    "ensureReviewGoalRatings: backfilled missing goal ratings"
  );
}

/** @deprecated Use getGoalsForMentee instead — kept for any callers that need the legacy type. */
export async function getLegacyGoalsForMentee(
  menteeId: string
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

export function goalsByRoleType(
  goals: MentorshipProgramGoal[]
): Record<MenteeRoleType, MentorshipProgramGoal[]> {
  const out = {} as Record<MenteeRoleType, MentorshipProgramGoal[]>;
  for (const goal of goals) {
    (out[goal.roleType] ??= []).push(goal);
  }
  return out;
}
