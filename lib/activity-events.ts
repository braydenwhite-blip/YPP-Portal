"use server";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";

// ============================================
// TYPES
// ============================================

export type ActivityEventType =
  | "PATHWAY_STEP"
  | "COURSE_ENROLL"
  | "COURSE_COMPLETE"
  | "BADGE_EARNED"
  | "CHALLENGE_JOIN"
  | "CHALLENGE_COMPLETE"
  | "GOAL_UPDATE"
  | "GOAL_SET"
  | "REFLECTION_SUBMIT"
  | "MENTORSHIP_CHECKIN"
  | "SECTION_UNLOCKED"
  | "MILESTONE_REACHED"
  | "XP_GAINED"
  | "STREAK_ACHIEVED"
  | "TRAINING_COMPLETE"
  | "SHOWCASE_SUBMIT"
  | "CERTIFICATE_EARNED";

export type ActivityEventData = {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  link: string | null;
  icon: string | null;
  createdAt: Date;
};

// Default icons for each event type
const EVENT_ICONS: Record<string, string> = {
  PATHWAY_STEP: "📚",
  COURSE_ENROLL: "📖",
  COURSE_COMPLETE: "🎓",
  BADGE_EARNED: "🏅",
  CHALLENGE_JOIN: "⚡",
  CHALLENGE_COMPLETE: "🏆",
  GOAL_UPDATE: "🎯",
  GOAL_SET: "🎯",
  REFLECTION_SUBMIT: "📝",
  MENTORSHIP_CHECKIN: "🤝",
  SECTION_UNLOCKED: "🔓",
  MILESTONE_REACHED: "⭐",
  XP_GAINED: "✨",
  STREAK_ACHIEVED: "🔥",
  TRAINING_COMPLETE: "📋",
  SHOWCASE_SUBMIT: "🎨",
  CERTIFICATE_EARNED: "📜",
};

// Category mapping for filtering
export const EVENT_CATEGORIES: Record<string, string> = {
  PATHWAY_STEP: "learning",
  COURSE_ENROLL: "learning",
  COURSE_COMPLETE: "learning",
  TRAINING_COMPLETE: "learning",
  BADGE_EARNED: "achievement",
  CHALLENGE_JOIN: "achievement",
  CHALLENGE_COMPLETE: "achievement",
  MILESTONE_REACHED: "achievement",
  XP_GAINED: "achievement",
  STREAK_ACHIEVED: "achievement",
  CERTIFICATE_EARNED: "achievement",
  SHOWCASE_SUBMIT: "achievement",
  GOAL_UPDATE: "social",
  GOAL_SET: "social",
  REFLECTION_SUBMIT: "social",
  MENTORSHIP_CHECKIN: "social",
  SECTION_UNLOCKED: "social",
};

// ============================================
// CORE FUNCTIONS
// ============================================

export async function logActivityEvent(
  userId: string,
  type: ActivityEventType,
  title: string,
  detail?: string,
  link?: string,
  icon?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.activityEvent.create({
      data: {
        userId,
        type,
        title,
        detail: detail ?? null,
        link: link ?? null,
        icon: icon ?? EVENT_ICONS[type] ?? null,
        metadata: metadata ?? null,
      },
    });
  } catch (error) {
    // Best-effort — don't let activity logging break flows
    console.error("[logActivityEvent] Error:", error);
  }
}

export async function getActivityFeed(
  userId: string,
  limit = 20,
  offset = 0
): Promise<ActivityEventData[]> {
  return withPrismaFallback(
    "getActivityFeed",
    async () => {
      const events = await prisma.activityEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          detail: true,
          link: true,
          icon: true,
          createdAt: true,
        },
      });
      return events;
    },
    () => []
  );
}

export async function getActivityFeedByCategory(
  userId: string,
  category: "learning" | "achievement" | "social",
  limit = 20
): Promise<ActivityEventData[]> {
  const types = Object.entries(EVENT_CATEGORIES)
    .filter(([, cat]) => cat === category)
    .map(([type]) => type);

  return withPrismaFallback(
    "getActivityFeedByCategory",
    async () => {
      return prisma.activityEvent.findMany({
        where: { userId, type: { in: types } },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          title: true,
          detail: true,
          link: true,
          icon: true,
          createdAt: true,
        },
      });
    },
    () => []
  );
}

export async function getRecentActivitySummary(
  userId: string
): Promise<{
  totalThisWeek: number;
  totalThisMonth: number;
  byCategory: Record<string, number>;
  mostActiveArea: string | null;
}> {
  return withPrismaFallback(
    "getRecentActivitySummary",
    async () => {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [weekEvents, monthEvents] = await Promise.all([
        prisma.activityEvent.findMany({
          where: { userId, createdAt: { gte: weekAgo } },
          select: { type: true },
        }),
        prisma.activityEvent.findMany({
          where: { userId, createdAt: { gte: monthAgo } },
          select: { type: true },
        }),
      ]);

      const byCategory: Record<string, number> = { learning: 0, achievement: 0, social: 0 };
      for (const e of monthEvents) {
        const cat = EVENT_CATEGORIES[e.type] ?? "social";
        byCategory[cat] = (byCategory[cat] ?? 0) + 1;
      }

      const mostActiveArea: string | null =
        Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        totalThisWeek: weekEvents.length,
        totalThisMonth: monthEvents.length,
        byCategory,
        mostActiveArea,
      };
    },
    () => ({
      totalThisWeek: 0,
      totalThisMonth: 0,
      byCategory: { learning: 0, achievement: 0, social: 0 } as Record<string, number>,
      mostActiveArea: null as string | null,
    })
  );
}
