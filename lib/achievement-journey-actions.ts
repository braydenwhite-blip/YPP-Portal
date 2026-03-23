"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { TIER_THRESHOLDS } from "@/lib/achievement-journey-config";
import type { AchievementJourneyData } from "@/lib/achievement-journey-config";


export async function getAchievementJourneyData(): Promise<AchievementJourneyData | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const userId = session.user.id as string;

  // Fetch summary + logs + recent reviews
  const summary = await prisma.achievementPointSummary.findUnique({
    where: { userId },
    include: {
      pointLogs: {
        include: {
          review: {
            select: {
              cycleNumber: true,
              overallRating: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const recentReviews = await prisma.mentorGoalReview.findMany({
    where: {
      menteeId: userId,
      releasedToMenteeAt: { not: null },
    },
    orderBy: { cycleNumber: "desc" },
    take: 3,
    select: {
      id: true,
      cycleNumber: true,
      cycleMonth: true,
      overallRating: true,
      pointsAwarded: true,
      bonusPoints: true,
      bonusReason: true,
      releasedToMenteeAt: true,
    },
  });

  const totalPoints = summary?.totalPoints ?? 0;
  const currentTier = summary?.currentTier ?? null;

  // Compute next tier
  const nextTierEntry = TIER_THRESHOLDS.slice().reverse().find((t) => totalPoints < t.min) ?? null;

  // Determine previous tier threshold (lower bound of current band)
  const currentTierIdx = TIER_THRESHOLDS.findIndex((t) => t.tier === currentTier);
  const prevTierMin =
    currentTierIdx === -1
      ? 0
      : currentTierIdx + 1 < TIER_THRESHOLDS.length
      ? TIER_THRESHOLDS[currentTierIdx + 1].min
      : 0;

  const nextTierThreshold = nextTierEntry?.min ?? TIER_THRESHOLDS[0].min;
  const bandSize = nextTierThreshold - prevTierMin;
  const pointsSinceLastTier = totalPoints - prevTierMin;
  const progressPercent = bandSize > 0 ? Math.min(100, Math.round((pointsSinceLastTier / bandSize) * 100)) : 100;
  const pointsToNextTier = Math.max(0, nextTierThreshold - totalPoints);

  // Velocity: avg points per month over last 6 logs
  let monthsToNextTier: number | null = null;
  if (summary?.pointLogs && summary.pointLogs.length >= 2) {
    const recentLogs = summary.pointLogs.slice(0, 6);
    const totalRecentPts = recentLogs.reduce((s, l) => s + l.points, 0);
    const avgPtsPerCycle = totalRecentPts / recentLogs.length;
    if (avgPtsPerCycle > 0 && pointsToNextTier > 0) {
      monthsToNextTier = Math.ceil(pointsToNextTier / avgPtsPerCycle);
    }
  }

  // Milestone messages
  let milestoneMessage: string | null = null;
  if (progressPercent >= 75 && progressPercent < 100) {
    milestoneMessage = `You're 75% of the way to ${nextTierEntry?.label ?? "the next tier"} — keep pushing!`;
  } else if (progressPercent >= 50 && progressPercent < 75) {
    milestoneMessage = `Halfway there! You've crossed the 50% mark toward ${nextTierEntry?.label ?? "the next tier"}.`;
  } else if (progressPercent >= 25 && progressPercent < 50) {
    milestoneMessage = `Great start — you've earned 25% of the points needed for ${nextTierEntry?.label ?? "the next tier"}.`;
  }

  // Points earned this cycle (most recent log)
  const earnedThisCycle = summary?.pointLogs?.[0]?.points ?? 0;

  return {
    totalPoints,
    currentTier,
    nextTier: nextTierEntry ?? null,
    nextTierThreshold,
    progressPercent,
    pointsSinceLastTier,
    pointsToNextTier,
    pointLogs: (summary?.pointLogs ?? []).map((log) => ({
      id: log.id,
      points: log.points,
      reason: log.reason,
      cycleMonth: log.cycleMonth.toISOString(),
      cycleNumber: log.review.cycleNumber,
      overallRating: log.review.overallRating,
    })),
    recentReviews: recentReviews.map((r) => ({
      id: r.id,
      cycleNumber: r.cycleNumber,
      cycleMonth: r.cycleMonth.toISOString(),
      overallRating: r.overallRating,
      pointsAwarded: r.pointsAwarded,
      bonusPoints: r.bonusPoints,
      bonusReason: r.bonusReason,
      releasedToMenteeAt: r.releasedToMenteeAt?.toISOString() ?? null,
    })),
    monthsToNextTier,
    milestoneMessage,
    earnedThisCycle,
  };
}
