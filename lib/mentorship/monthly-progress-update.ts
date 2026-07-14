import "server-only";

import type { GoalRatingColor } from "@prisma/client";

import { TIER_THRESHOLDS } from "@/lib/achievement-tier-utils";
import {
  MONTHLY_UPDATE_RATINGS,
  packGoalProgressText,
  packProgressNarrative,
  parseCollaborateWith,
  unpackProgressNarrative,
  ratingLabel,
  ratingPoints,
} from "@/lib/mentorship/monthly-progress-update-shared";
import { getCurrentCycleMonth } from "@/lib/mentorship-cycle";
import { prisma } from "@/lib/prisma";
import { getUserTitle } from "@/lib/user-title";

export {
  MONTHLY_UPDATE_RATINGS,
  packGoalProgressText,
  packProgressNarrative,
  parseCollaborateWith,
  unpackProgressNarrative,
  ratingLabel,
  ratingPoints,
};

export type MonthlyProgressGoalBlock = {
  title: string;
  collaborateWith: string | null;
  rating: GoalRatingColor | null;
  objective: string;
  actionItems: string[];
};

export type MonthlyProgressUpdateDoc = {
  leaderName: string;
  position: string;
  classOf: string | null;
  mentorName: string;
  startMonthLabel: string;
  thisMonthLabel: string;
  overallRating: GoalRatingColor | null;
  achievementPoints: { earned: number; of: number } | null;
  overallComments: string | null;
  strengths: string | null;
  areasForDevelopment: string | null;
  goals: MonthlyProgressGoalBlock[];
  reviewId: string | null;
  personId: string;
  mentorshipId: string | null;
  /** YYYY-MM for PDF / share deep links. */
  monthKey: string;
};

function formatMonthLabel(value: Date | null | undefined): string {
  if (!value) return "—";
  return value.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function cycleKeyFromDate(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function resolveGraduationYear(userId: string): Promise<string | null> {
  const [instructorApp, cpApp, alumni] = await Promise.all([
    prisma.instructorApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      select: { graduationYear: true },
    }),
    prisma.chapterPresidentApplication.findFirst({
      where: { applicantId: userId },
      select: { graduationYear: true },
    }),
    prisma.alumniProfile.findUnique({
      where: { userId },
      select: { graduationYear: true },
    }),
  ]);
  const year =
    instructorApp?.graduationYear ??
    cpApp?.graduationYear ??
    alumni?.graduationYear ??
    null;
  return year != null ? String(year) : null;
}

/**
 * Load a printable Monthly Progress Update for a mentee.
 * Prefers a specific reviewId; otherwise the latest released review, else latest
 * draft/pending for the mentor, else a shell from G&R goals.
 */
export async function loadMonthlyProgressUpdate(input: {
  personId: string;
  viewerId: string;
  viewerRoles: string[];
  reviewId?: string | null;
  monthKey?: string | null;
}): Promise<MonthlyProgressUpdateDoc | null> {
  const mentorship = await prisma.mentorship.findFirst({
    where: {
      menteeId: input.personId,
      status: "ACTIVE",
    },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      startDate: true,
      mentorId: true,
      mentor: {
        select: { id: true, name: true },
      },
      mentee: {
        select: {
          id: true,
          name: true,
          title: true,
          canonicalTitle: true,
          primaryRole: true,
          adminSubtypes: true,
          internalLevel: true,
          ladder: true,
        },
      },
    },
  });

  if (!mentorship) return null;

  const isParty =
    mentorship.mentorId === input.viewerId || mentorship.menteeId === input.viewerId;
  const isOfficer = input.viewerRoles.some((r) =>
    ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"].includes(r)
  );
  if (!isParty && !isOfficer) return null;

  let review =
    input.reviewId
      ? await prisma.mentorGoalReview.findFirst({
          where: {
            id: input.reviewId,
            menteeId: input.personId,
            mentorshipId: mentorship.id,
          },
          include: {
            goalRatings: {
              include: {
                grDocumentGoal: {
                  select: { id: true, title: true, description: true },
                },
                goal: { select: { id: true, title: true, description: true } },
              },
            },
            goalSnapshots: true,
            followUpActionItems: {
              select: { title: true, grDocumentGoalId: true },
              orderBy: { createdAt: "asc" },
            },
          },
        })
      : null;

  if (!review) {
    review = await prisma.mentorGoalReview.findFirst({
      where: {
        mentorshipId: mentorship.id,
        ...(input.monthKey
          ? {
              cycleMonth: {
                gte: new Date(`${input.monthKey}-01T00:00:00.000Z`),
                lt: (() => {
                  const [y, m] = input.monthKey.split("-").map(Number);
                  return new Date(Date.UTC(y, m, 1));
                })(),
              },
            }
          : {}),
      },
      orderBy: [{ releasedToMenteeAt: "desc" }, { createdAt: "desc" }],
      include: {
        goalRatings: {
          include: {
            grDocumentGoal: {
              select: { id: true, title: true, description: true },
            },
            goal: { select: { id: true, title: true, description: true } },
          },
        },
        goalSnapshots: true,
        followUpActionItems: {
          select: { title: true, grDocumentGoalId: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });
  }

  // If mentee is viewing, only allow released reviews.
  if (
    review &&
    mentorship.menteeId === input.viewerId &&
    mentorship.mentorId !== input.viewerId &&
    !isOfficer &&
    !review.releasedToMenteeAt
  ) {
    review = null;
  }

  const cycleMonth = review?.cycleMonth ?? getCurrentCycleMonth().cycleMonth;
  const thisMonthLabel = formatMonthLabel(cycleMonth);
  const monthKey = cycleKeyFromDate(cycleMonth);

  const points = await prisma.achievementPointSummary.findUnique({
    where: { userId: input.personId },
    select: { totalPoints: true },
  });
  const earned = points?.totalPoints ?? 0;
  const nextTier =
    [...TIER_THRESHOLDS].sort((a, b) => a.min - b.min).find((t) => earned < t.min) ??
    null;

  const classOf = await resolveGraduationYear(input.personId);

  const goals: MonthlyProgressGoalBlock[] = [];
  if (review) {
    for (const rating of review.goalRatings) {
      const snapshot = review.goalSnapshots.find(
        (s) => s.grDocumentGoalId && s.grDocumentGoalId === rating.grDocumentGoalId
      );
      const title =
        snapshot?.title ??
        rating.grDocumentGoal?.title ??
        rating.goal?.title ??
        "Goal";
      const description =
        snapshot?.description ??
        rating.grDocumentGoal?.description ??
        rating.goal?.description ??
        rating.comments ??
        "";
      const { collaborateWith, objective } = parseCollaborateWith(description);
      const actionItems = review.followUpActionItems
        .filter(
          (a) =>
            !rating.grDocumentGoalId || a.grDocumentGoalId === rating.grDocumentGoalId
        )
        .map((a) => a.title);
      // If no goal-linked actions, don't dump all actions onto every goal —
      // only attach unlinked ones to the first goal below.
      goals.push({
        title,
        collaborateWith,
        rating: rating.rating,
        objective: objective || rating.comments || "",
        actionItems,
      });
    }

    if (goals.length === 0 && review.planOfAction.trim()) {
      goals.push({
        title: "Goals for next month",
        collaborateWith: null,
        rating: review.overallRating,
        objective: review.planOfAction,
        actionItems: review.followUpActionItems.map((a) => a.title),
      });
    } else if (goals.length > 0) {
      const unlinked = review.followUpActionItems
        .filter((a) => !a.grDocumentGoalId)
        .map((a) => a.title);
      if (unlinked.length > 0) {
        goals[0] = {
          ...goals[0],
          actionItems: [...goals[0].actionItems, ...unlinked],
        };
      }
    }
  } else {
    // No formal review yet — pull live G&R goals as the plan skeleton.
    const gr = await prisma.gRDocument.findFirst({
      where: { userId: input.personId, status: "ACTIVE" },
      select: {
        goals: {
          where: { lifecycleStatus: "ACTIVE", kind: "GOAL" },
          orderBy: { sortOrder: "asc" },
          take: 6,
          select: { title: true, description: true },
        },
      },
    });
    for (const g of gr?.goals ?? []) {
      const { collaborateWith, objective } = parseCollaborateWith(g.description);
      goals.push({
        title: g.title,
        collaborateWith,
        rating: null,
        objective,
        actionItems: [],
      });
    }
  }

  const narrative = unpackProgressNarrative(review?.overallComments);

  return {
    leaderName: mentorship.mentee.name,
    position: getUserTitle(mentorship.mentee),
    classOf,
    mentorName: mentorship.mentor.name,
    startMonthLabel: formatMonthLabel(mentorship.startDate),
    thisMonthLabel,
    overallRating: review?.overallRating ?? null,
    achievementPoints: nextTier
      ? { earned, of: nextTier.min }
      : earned > 0
        ? { earned, of: earned }
        : null,
    overallComments: narrative.overallComments,
    strengths: narrative.strengths,
    areasForDevelopment: narrative.areasForDevelopment,
    goals,
    reviewId: review?.id ?? null,
    personId: input.personId,
    mentorshipId: mentorship.id,
    monthKey,
  };
}
