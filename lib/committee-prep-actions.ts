"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";

// ============================================
// COMMITTEE MEETING PREP PACKET
// ============================================

async function requireAdminOrChair() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_PRESIDENT")) {
    throw new Error("Unauthorized");
  }
  return session as typeof session & { user: { id: string } };
}

export interface CommitteePrepPacket {
  generatedAt: string;
  mentee: {
    id: string;
    name: string;
    email: string;
    role: string;
    chapter: string | null;
    tenureMonths: number;
  };
  mentor: {
    name: string;
    email: string;
  };
  last3Reviews: Array<{
    cycleNumber: number;
    cycleMonth: string;
    overallRating: string;
    pointsAwarded: number | null;
    overallComments: string;
    planOfAction: string;
    bonusPoints: number;
    bonusReason: string | null;
    isQuarterly: boolean;
    projectedFuturePath: string | null;
    promotionReadiness: string | null;
    chairComments: string | null;
    goalRatings: Array<{ goalTitle: string; rating: string; comments: string | null }>;
  }>;
  achievement: {
    totalPoints: number;
    currentTier: string | null;
    nextTierThreshold: number;
    progressPercent: number;
    recentPointLogs: Array<{ cycleNumber: number; points: number; reason: string | null }>;
  };
  stakeholderFeedback: {
    totalResponses: number;
    avgRating: number | null;
    strengthsHighlights: string[];
    growthHighlights: string[];
  };
  openActionItems: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
  }>;
  suggestedDiscussionTopics: string[];
}

const TIER_THRESHOLDS = [
  { tier: "LIFETIME", min: 1800 },
  { tier: "GOLD", min: 700 },
  { tier: "SILVER", min: 350 },
  { tier: "BRONZE", min: 175 },
];

export async function generateCommitteePrepPacket(mentorshipId: string): Promise<CommitteePrepPacket> {
  await requireAdminOrChair();

  const mentorship = await prisma.mentorship.findUniqueOrThrow({
    where: { id: mentorshipId },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          createdAt: true,
          chapter: { select: { name: true } },
        },
      },
      mentor: { select: { name: true, email: true } },
      goalReviews: {
        where: { status: "APPROVED" },
        orderBy: { cycleNumber: "desc" },
        take: 3,
        include: {
          goalRatings: {
            include: { goal: { select: { title: true } } },
          },
        },
      },
      actionItems: {
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        select: {
          id: true,
          title: true,
          status: true,
          dueAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      feedbackRequests: {
        include: {
          responses: {
            select: {
              overallRating: true,
              strengths: true,
              areasForGrowth: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  // Achievement data
  const achievementSummary = await prisma.achievementPointSummary.findUnique({
    where: { userId: mentorship.menteeId },
    include: {
      pointLogs: {
        include: { review: { select: { cycleNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  const totalPoints = achievementSummary?.totalPoints ?? 0;
  const nextTierEntry = TIER_THRESHOLDS.slice().reverse().find((t) => totalPoints < t.min);
  const nextTierThreshold = nextTierEntry?.min ?? 1800;
  const currentTierIdx = TIER_THRESHOLDS.findIndex((t) => t.tier === achievementSummary?.currentTier);
  const prevTierMin =
    currentTierIdx === -1
      ? 0
      : currentTierIdx + 1 < TIER_THRESHOLDS.length
      ? TIER_THRESHOLDS[currentTierIdx + 1].min
      : 0;
  const bandSize = nextTierThreshold - prevTierMin;
  const progressPercent =
    bandSize > 0 ? Math.min(100, Math.round(((totalPoints - prevTierMin) / bandSize) * 100)) : 100;

  // Tenure in months
  const startDate = mentorship.startDate;
  const now = new Date();
  const tenureMonths = Math.floor(
    (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  // Stakeholder feedback aggregation
  const allResponses = mentorship.feedbackRequests.flatMap((fr) => fr.responses);
  const avgRating =
    allResponses.length > 0
      ? allResponses.reduce((sum, r) => sum + r.overallRating, 0) / allResponses.length
      : null;
  const strengthsHighlights = allResponses
    .map((r) => r.strengths)
    .filter(Boolean)
    .slice(0, 3);
  const growthHighlights = allResponses
    .map((r) => r.areasForGrowth)
    .filter(Boolean)
    .slice(0, 3);

  // Generate discussion topics based on data
  const suggestedTopics: string[] = [];
  const latestReview = mentorship.goalReviews[0];
  if (latestReview) {
    if (latestReview.overallRating === "BEHIND_SCHEDULE") {
      suggestedTopics.push("Discuss root causes of current performance gap and recovery plan");
    }
    if (latestReview.isQuarterly && latestReview.projectedFuturePath) {
      suggestedTopics.push(`Review projected pathway: "${latestReview.projectedFuturePath.slice(0, 80)}..."`);
    }
    if (latestReview.promotionReadiness) {
      suggestedTopics.push("Evaluate promotion readiness and next-step decision");
    }
  }
  if (mentorship.actionItems.length > 0) {
    suggestedTopics.push(`Review ${mentorship.actionItems.length} open action item(s) from last quarter`);
  }
  if (avgRating !== null && avgRating < 3) {
    suggestedTopics.push("Address stakeholder feedback concerns — overall rating below average");
  }
  if (progressPercent >= 75) {
    suggestedTopics.push(`Mentee is ${progressPercent}% toward next tier — consider award nomination`);
  }
  if (suggestedTopics.length === 0) {
    suggestedTopics.push("Review overall progress and celebrate wins this quarter");
    suggestedTopics.push("Align on goals and priorities for the coming quarter");
  }

  return {
    generatedAt: new Date().toISOString(),
    mentee: {
      id: mentorship.mentee.id,
      name: mentorship.mentee.name ?? "Unknown",
      email: mentorship.mentee.email ?? "",
      role: mentorship.mentee.primaryRole ?? "",
      chapter: (mentorship.mentee as any).chapter?.name ?? null,
      tenureMonths,
    },
    mentor: {
      name: mentorship.mentor.name ?? "Unknown",
      email: mentorship.mentor.email ?? "",
    },
    last3Reviews: mentorship.goalReviews.map((r) => ({
      cycleNumber: r.cycleNumber,
      cycleMonth: r.cycleMonth.toISOString(),
      overallRating: r.overallRating,
      pointsAwarded: r.pointsAwarded,
      overallComments: r.overallComments,
      planOfAction: r.planOfAction,
      bonusPoints: r.bonusPoints,
      bonusReason: r.bonusReason,
      isQuarterly: r.isQuarterly,
      projectedFuturePath: r.projectedFuturePath,
      promotionReadiness: r.promotionReadiness,
      chairComments: r.chairComments,
      goalRatings: r.goalRatings.map((gr) => ({
        goalTitle: gr.goal.title,
        rating: gr.rating,
        comments: gr.comments,
      })),
    })),
    achievement: {
      totalPoints,
      currentTier: achievementSummary?.currentTier ?? null,
      nextTierThreshold,
      progressPercent,
      recentPointLogs: (achievementSummary?.pointLogs ?? []).map((log) => ({
        cycleNumber: log.review.cycleNumber,
        points: log.points,
        reason: log.reason,
      })),
    },
    stakeholderFeedback: {
      totalResponses: allResponses.length,
      avgRating: avgRating !== null ? Math.round(avgRating * 10) / 10 : null,
      strengthsHighlights,
      growthHighlights,
    },
    openActionItems: mentorship.actionItems.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      dueDate: (a as any).dueAt?.toISOString() ?? null,
    })),
    suggestedDiscussionTopics: suggestedTopics,
  };
}
