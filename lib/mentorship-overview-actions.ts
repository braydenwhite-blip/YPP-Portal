"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";

// ============================================
// MENTOR OVERVIEW — per-mentee status cards
// ============================================

export async function getMentorOverview() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("ADMIN");
  const isMentor = roles.includes("MENTOR") || roles.includes("CHAPTER_PRESIDENT");
  if (!isAdmin && !isMentor) return null;

  const userId = session.user.id as string;

  const pairs = await prisma.mentorship.findMany({
    where: isAdmin
      ? { status: "ACTIVE" }
      : { mentorId: userId, status: "ACTIVE" },
    include: {
      mentee: {
        select: {
          id: true,
          name: true,
          email: true,
          primaryRole: true,
          achievementPointSummary: {
            select: { totalPoints: true, currentTier: true },
          },
        },
      },
      mentor: { select: { id: true, name: true } },
      selfReflections: {
        orderBy: { cycleNumber: "desc" },
        take: 1,
        include: {
          goalReview: {
            select: {
              id: true,
              status: true,
              overallRating: true,
              releasedToMenteeAt: true,
              pointsAwarded: true,
            },
          },
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  // Pending review counts for KPI bar (only reviews where this mentor should act)
  const [pendingReflections, pendingChair, pendingBoard] = await Promise.all([
    // Reflections without a review for this mentor's mentees
    prisma.monthlySelfReflection.count({
      where: {
        mentorship: isAdmin ? { status: "ACTIVE" } : { mentorId: userId, status: "ACTIVE" },
        goalReview: null,
      },
    }),
    prisma.mentorGoalReview.count({
      where: {
        ...(isAdmin ? {} : { mentorId: userId }),
        status: "PENDING_CHAIR_APPROVAL",
      },
    }),
    prisma.awardNomination.count({
      where: { status: "PENDING_BOARD" },
    }),
  ]);

  return {
    pairs: pairs.map((pair) => {
      const latestReflection = pair.selfReflections[0] ?? null;
      const summary = pair.mentee.achievementPointSummary;

      return {
        mentorshipId: pair.id,
        menteeId: pair.mentee.id,
        menteeName: pair.mentee.name,
        menteeEmail: pair.mentee.email,
        menteeRole: pair.mentee.primaryRole,
        mentorId: pair.mentor.id,
        mentorName: pair.mentor.name,
        startDate: pair.startDate.toISOString(),
        totalPoints: summary?.totalPoints ?? 0,
        currentTier: summary?.currentTier ?? null,
        latestCycle: latestReflection
          ? {
              cycleNumber: latestReflection.cycleNumber,
              reflectionId: latestReflection.id,
              submittedAt: latestReflection.submittedAt.toISOString(),
              isQuarterly: latestReflection.cycleNumber % 3 === 0,
              reviewStatus: latestReflection.goalReview?.status ?? null,
              reviewId: latestReflection.goalReview?.id ?? null,
              overallRating: latestReflection.goalReview?.overallRating ?? null,
              released: latestReflection.goalReview?.releasedToMenteeAt != null,
              pointsAwarded: latestReflection.goalReview?.pointsAwarded ?? null,
            }
          : null,
      };
    }),
    kpi: {
      activePairs: pairs.length,
      pendingReflections,
      pendingChair,
      pendingBoard,
    },
    isAdmin,
  };
}

// ============================================
// ADMIN ANALYTICS — program-wide stats
// ============================================

export async function getProgramAnalytics() {
  const session = await getSession();
  if (!session?.user?.id) return null;
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) return null;

  const [
    activePairs,
    totalReflections,
    reviewsByStatus,
    totalPointsResult,
    tierDistribution,
    nominationsByTier,
    recentApprovals,
    reflectionsByCycle,
  ] = await Promise.all([
    prisma.mentorship.count({ where: { status: "ACTIVE" } }),

    prisma.monthlySelfReflection.count(),

    // Reviews grouped by status
    prisma.mentorGoalReview.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // Total points awarded across all mentees
    prisma.achievementPointSummary.aggregate({
      _sum: { totalPoints: true },
    }),

    // How many mentees at each tier
    prisma.achievementPointSummary.groupBy({
      by: ["currentTier"],
      _count: { userId: true },
    }),

    // Award nominations by tier
    prisma.awardNomination.groupBy({
      by: ["tier", "status"],
      _count: { id: true },
    }),

    // Last 5 approved reviews
    prisma.mentorGoalReview.findMany({
      where: { status: "APPROVED" },
      orderBy: { chairApprovedAt: "desc" },
      take: 5,
      select: {
        id: true,
        cycleNumber: true,
        overallRating: true,
        pointsAwarded: true,
        chairApprovedAt: true,
        mentee: { select: { name: true, primaryRole: true } },
        mentor: { select: { name: true } },
      },
    }),

    // Reflections per cycle (last 6 cycles)
    prisma.monthlySelfReflection.groupBy({
      by: ["cycleNumber"],
      _count: { id: true },
      orderBy: { cycleNumber: "desc" },
      take: 6,
    }),
  ]);

  const reviewStatusMap = Object.fromEntries(
    reviewsByStatus.map((r) => [r.status, r._count.id])
  );

  const tierMap = Object.fromEntries(
    tierDistribution.map((t) => [t.currentTier ?? "NONE", t._count.userId])
  );

  return {
    activePairs,
    totalReflections,
    reviews: {
      draft: reviewStatusMap["DRAFT"] ?? 0,
      pendingChair: reviewStatusMap["PENDING_CHAIR_APPROVAL"] ?? 0,
      changesRequested: reviewStatusMap["CHANGES_REQUESTED"] ?? 0,
      approved: reviewStatusMap["APPROVED"] ?? 0,
    },
    totalPointsAwarded: totalPointsResult._sum.totalPoints ?? 0,
    tierDistribution: {
      NONE: tierMap["NONE"] ?? 0,
      BRONZE: tierMap["BRONZE"] ?? 0,
      SILVER: tierMap["SILVER"] ?? 0,
      GOLD: tierMap["GOLD"] ?? 0,
      LIFETIME: tierMap["LIFETIME"] ?? 0,
    },
    nominationsByTier: nominationsByTier.map((n) => ({
      tier: n.tier,
      status: n.status,
      count: n._count.id,
    })),
    recentApprovals: recentApprovals.map((r) => ({
      id: r.id,
      cycleNumber: r.cycleNumber,
      overallRating: r.overallRating,
      pointsAwarded: r.pointsAwarded,
      chairApprovedAt: r.chairApprovedAt?.toISOString() ?? null,
      menteeName: r.mentee.name,
      menteeRole: r.mentee.primaryRole,
      mentorName: r.mentor.name,
    })),
    reflectionsByCycle: reflectionsByCycle.map((r) => ({
      cycleNumber: r.cycleNumber,
      count: r._count.id,
    })),
  };
}
