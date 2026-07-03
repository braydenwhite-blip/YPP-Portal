import "server-only";

/**
 * Per-person enrichments for the development record inside the hub — the
 * current coaching plan (a MentorGoalReview's plan-of-action), leadership-
 * and mentee-scoped. Open actions/follow-ups already ride on the record
 * loader (lib/development/record.ts).
 */

import type { GoalRatingColor } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { requireMentorshipCommandAccess } from "./command-access";

export type CoachingPlan = {
  planOfAction: string;
  overallRating: GoalRatingColor;
  cycleMonth: Date;
  mentorName: string;
  releasedToMenteeAt: Date | null;
};

/**
 * The person's current coaching plan — the latest APPROVED monthly review's
 * plan-of-action. Leadership-only (this can include not-yet-released plans).
 */
export async function getLatestCoachingPlan(
  userId: string
): Promise<CoachingPlan | null> {
  await requireMentorshipCommandAccess();

  const review = await prisma.mentorGoalReview.findFirst({
    where: { menteeId: userId, status: "APPROVED" },
    orderBy: { cycleMonth: "desc" },
    select: {
      planOfAction: true,
      overallRating: true,
      cycleMonth: true,
      releasedToMenteeAt: true,
      mentor: { select: { name: true, email: true } },
    },
  });
  if (!review) return null;
  return {
    planOfAction: review.planOfAction,
    overallRating: review.overallRating,
    cycleMonth: review.cycleMonth,
    mentorName: review.mentor.name || review.mentor.email,
    releasedToMenteeAt: review.releasedToMenteeAt,
  };
}

/**
 * A person's RELEASED coaching plan — released reviews only (an unreleased
 * plan-of-action is never returned). Safe for the relationship tier and for the
 * mentee's own view because it filters on `releasedToMenteeAt`. NOT self-scoped:
 * callers pass the subject's id, so the released-only filter is the guard —
 * never widen this to include unreleased plans.
 */
export async function getMyReleasedCoachingPlan(
  menteeId: string
): Promise<CoachingPlan | null> {
  const review = await prisma.mentorGoalReview.findFirst({
    where: { menteeId, releasedToMenteeAt: { not: null } },
    orderBy: { releasedToMenteeAt: "desc" },
    select: {
      planOfAction: true,
      overallRating: true,
      cycleMonth: true,
      releasedToMenteeAt: true,
      mentor: { select: { name: true, email: true } },
    },
  });
  if (!review) return null;
  return {
    planOfAction: review.planOfAction,
    overallRating: review.overallRating,
    cycleMonth: review.cycleMonth,
    mentorName: review.mentor.name || review.mentor.email,
    releasedToMenteeAt: review.releasedToMenteeAt,
  };
}

