"use server";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

// ============================================
// TYPES
// ============================================

export type NudgeType =
  | "BADGE_CLOSE"
  | "PATHWAY_PROGRESS"
  | "MENTEE_UPDATE"
  | "GOAL_REMINDER"
  | "UNLOCK_NEW"
  | "SECTION_UNLOCKED"
  | "ENCOURAGEMENT"
  | "MILESTONE";

export type NudgeData = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  context: unknown;
  createdAt: Date;
};

// ============================================
// CORE CRUD
// ============================================

export async function createNudge(
  userId: string,
  type: NudgeType,
  title: string,
  body: string,
  link?: string,
  context?: Record<string, unknown>,
  expiresInDays = 7
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  // Prevent exact duplicate nudges (same user + type + title within last hour)
  const recentDuplicate = await prisma.nudge.findFirst({
    where: {
      userId,
      type,
      title,
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });

  if (recentDuplicate) return recentDuplicate;

  return prisma.nudge.create({
    data: {
      userId,
      type,
      title,
      body,
      link: link ?? null,
      context: (context ?? undefined) as any,
      expiresAt,
    },
  });
}

export async function getActiveNudges(
  userId: string,
  limit = 5
): Promise<NudgeData[]> {
  return withPrismaFallback(
    "getActiveNudges",
    async () => {
      const now = new Date();
      return prisma.nudge.findMany({
        where: {
          userId,
          isDismissed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          context: true,
          createdAt: true,
        },
      });
    },
    () => []
  );
}

export async function dismissNudge(nudgeId: string, userId: string) {
  return prisma.nudge.updateMany({
    where: { id: nudgeId, userId },
    data: { isDismissed: true },
  });
}

export async function getNudgeCountForUser(userId: string): Promise<number> {
  return withPrismaFallback(
    "getNudgeCount",
    async () => {
      const now = new Date();
      return prisma.nudge.count({
        where: {
          userId,
          isDismissed: false,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      });
    },
    () => 0
  );
}

// ============================================
// PAGE-SPECIFIC NUDGES
// ============================================

/**
 * Get nudges relevant to a specific page/route.
 * Filters by nudge type based on which page the user is on.
 */
export async function getNudgesForRoute(
  userId: string,
  route: string
): Promise<NudgeData[]> {
  const typeMap: Record<string, string[]> = {
    "/pathways": ["PATHWAY_PROGRESS", "BADGE_CLOSE", "ENCOURAGEMENT"],
    "/goals": ["GOAL_REMINDER", "BADGE_CLOSE", "MILESTONE"],
    "/badges": ["BADGE_CLOSE", "MILESTONE"],
    "/challenges": ["BADGE_CLOSE", "ENCOURAGEMENT"],
    "/mentorship": ["MENTEE_UPDATE", "GOAL_REMINDER"],
    "/": ["BADGE_CLOSE", "PATHWAY_PROGRESS", "SECTION_UNLOCKED", "MILESTONE"],
  };

  // Find the most specific matching route
  const matchingRoute = Object.keys(typeMap)
    .filter((r) => route.startsWith(r))
    .sort((a, b) => b.length - a.length)[0];

  if (!matchingRoute) return [];

  const relevantTypes = typeMap[matchingRoute];

  return withPrismaFallback(
    "getNudgesForRoute",
    async () => {
      const now = new Date();
      return prisma.nudge.findMany({
        where: {
          userId,
          isDismissed: false,
          type: { in: relevantTypes },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          link: true,
          context: true,
          createdAt: true,
        },
      });
    },
    () => []
  );
}

// ============================================
// SMART NUDGE GENERATORS
// ============================================

/**
 * Generate contextual nudges based on current user state.
 * Called periodically (e.g., on dashboard load) to create nudges.
 */
export async function generateContextualNudges(
  userId: string,
  role: string
): Promise<void> {
  if (role === "STUDENT" || role === "APPLICANT") {
    await generateStudentNudges(userId);
  } else if (role === "MENTOR") {
    await generateMentorNudges(userId);
  } else if (role === "INSTRUCTOR") {
    await generateInstructorNudges(userId);
  }
}

async function generateStudentNudges(userId: string) {
  // Check for badges close to being earned
  const badges = await prisma.badge.findMany({
    where: { isActive: true },
    select: { id: true, name: true, criteria: true, icon: true },
  });

  const earnedBadgeIds = new Set(
    (
      await prisma.studentBadge.findMany({
        where: { studentId: userId },
        select: { badgeId: true },
      })
    ).map((b) => b.badgeId)
  );

  // Simple nudge: encourage if they have no badges yet but have progress
  const stepCount = await prisma.pathwayStepUnlock.count({
    where: { userId },
  });

  if (earnedBadgeIds.size === 0 && stepCount > 0) {
    await createNudge(
      userId,
      "ENCOURAGEMENT",
      "You're making progress!",
      "Keep completing pathway steps to earn your first badge!",
      "/badges"
    );
  }

  // Nudge: encourage next pathway step
  if (stepCount > 0 && stepCount < 5) {
    await createNudge(
      userId,
      "PATHWAY_PROGRESS",
      "Keep it going!",
      `You've completed ${stepCount} pathway step${stepCount === 1 ? "" : "s"}. What's next?`,
      "/pathways"
    );
  }

  // Check for active goals that might need reflection
  const activeGoals = await prisma.goal.count({
    where: { userId },
  });

  if (activeGoals > 0) {
    const recentReflection = await prisma.reflectionSubmission.findFirst({
      where: {
        userId,
        submittedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    if (!recentReflection) {
      await createNudge(
        userId,
        "GOAL_REMINDER",
        "Time to reflect!",
        "It's been a while since you checked in on your goals. How's it going?",
        "/goals"
      );
    }
  }
}

async function generateMentorNudges(userId: string) {
  // Check for mentees with recent progress
  const mentorships = await prisma.mentorship.findMany({
    where: { mentorId: userId, status: "ACTIVE" },
    select: {
      mentee: {
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              pathwayStepUnlocks: true,
              earnedBadges: true,
            },
          },
        },
      },
    },
  });

  for (const m of mentorships) {
    // Check for recent mentee activity
    const recentSteps = await prisma.pathwayStepUnlock.count({
      where: {
        userId: m.mentee.id,
        unlockedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    if (recentSteps > 0) {
      await createNudge(
        userId,
        "MENTEE_UPDATE",
        `${m.mentee.name} is making progress!`,
        `${m.mentee.name} completed ${recentSteps} pathway step${recentSteps === 1 ? "" : "s"} this week.`,
        "/mentorship"
      );
    }
  }

  // Check for pending goal reviews
  const pendingReviews = await prisma.monthlyGoalReview.count({
    where: { mentorId: userId, status: "DRAFT" },
  });

  if (pendingReviews > 0) {
    await createNudge(
      userId,
      "GOAL_REMINDER",
      `${pendingReviews} goal review${pendingReviews === 1 ? "" : "s"} waiting`,
      "Your mentees have submitted goal updates for you to review.",
      "/goals"
    );
  }
}

async function generateInstructorNudges(userId: string) {
  // Check for pending training tasks
  const pendingTraining = await prisma.trainingAssignment.count({
    where: {
      userId,
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
    },
  });

  if (pendingTraining > 0) {
    await createNudge(
      userId,
      "ENCOURAGEMENT",
      "Training in progress",
      `You have ${pendingTraining} training module${pendingTraining === 1 ? "" : "s"} to complete.`,
      "/instructor-training"
    );
  }
}

// ============================================
// CLEANUP
// ============================================

export async function cleanupExpiredNudges(): Promise<number> {
  const result = await prisma.nudge.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date() } },
        {
          isDismissed: true,
          createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      ],
    },
  });

  return result.count;
}

/**
 * Enforce max nudges per user (keep most recent, dismiss old ones).
 */
export async function enforceNudgeLimit(
  userId: string,
  maxActive = 10
): Promise<void> {
  const activeNudges = await prisma.nudge.findMany({
    where: {
      userId,
      isDismissed: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (activeNudges.length > maxActive) {
    const toExpire = activeNudges.slice(maxActive).map((n) => n.id);
    await prisma.nudge.updateMany({
      where: { id: { in: toExpire } },
      data: { isDismissed: true },
    });
  }
}
