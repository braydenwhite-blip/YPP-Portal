"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { getLevelForXp } from "@/lib/xp-config";
import { revalidatePath } from "next/cache";

// Cast for models not yet in generated Prisma client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// ============================================
// CHAPTER XP LEADERBOARD
// ============================================

/**
 * Get the chapter member XP leaderboard.
 */
export async function getChapterXpLeaderboard() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true },
  });

  if (!user?.chapterId) throw new Error("Not in a chapter");

  const members = await prisma.user.findMany({
    where: { chapterId: user.chapterId },
    select: {
      id: true,
      name: true,
      primaryRole: true,
      xp: true,
      level: true,
      createdAt: true,
    },
    orderBy: { xp: "desc" },
  });

  return members.map((m, index) => {
    const levelInfo = getLevelForXp(m.xp);
    return {
      id: m.id,
      name: m.name,
      primaryRole: m.primaryRole,
      xp: m.xp,
      level: m.level,
      title: levelInfo.title,
      progress: levelInfo.progress,
      xpForNextLevel: levelInfo.xpForNextLevel,
      xpIntoLevel: levelInfo.xpIntoLevel,
      rank: index + 1,
      isCurrentUser: m.id === user.id,
      joinedAt: m.createdAt,
    };
  });
}

// ============================================
// CHAPTER MILESTONES
// ============================================

const DEFAULT_MILESTONES = [
  { type: "MEMBER_COUNT", title: "First Five", description: "Reach 5 chapter members", icon: "👥", threshold: 5 },
  { type: "MEMBER_COUNT", title: "Growing Strong", description: "Reach 10 chapter members", icon: "🌱", threshold: 10 },
  { type: "MEMBER_COUNT", title: "Full House", description: "Reach 20 chapter members", icon: "🏠", threshold: 20 },
  { type: "EVENT_COUNT", title: "First Gathering", description: "Host your first event", icon: "🎉", threshold: 1 },
  { type: "EVENT_COUNT", title: "Event Machine", description: "Host 10 events", icon: "🔥", threshold: 10 },
  { type: "COURSE_COUNT", title: "Open for Learning", description: "Offer your first course", icon: "📚", threshold: 1 },
  { type: "COURSE_COUNT", title: "Knowledge Hub", description: "Offer 5 courses", icon: "🎓", threshold: 5 },
];

/**
 * Get chapter milestones with current progress.
 */
export async function getChapterMilestones() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true },
  });

  if (!user?.chapterId) throw new Error("Not in a chapter");

  // Get or create default milestones
  let milestones = await db.chapterAchievementMilestone.findMany({
    where: { chapterId: user.chapterId },
    orderBy: [{ isUnlocked: "desc" }, { threshold: "asc" }],
  });

  if (milestones.length === 0) {
    await db.chapterAchievementMilestone.createMany({
      data: DEFAULT_MILESTONES.map((m) => ({ ...m, chapterId: user.chapterId })),
    });
    milestones = await db.chapterAchievementMilestone.findMany({
      where: { chapterId: user.chapterId },
      orderBy: [{ isUnlocked: "desc" }, { threshold: "asc" }],
    });
  }

  // Get current chapter stats for progress
  const chapter = await prisma.chapter.findUnique({
    where: { id: user.chapterId },
    select: {
      _count: {
        select: {
          users: true,
          courses: true,
          events: true,
        },
      },
    },
  });

  const stats = {
    MEMBER_COUNT: chapter?._count.users ?? 0,
    EVENT_COUNT: chapter?._count.events ?? 0,
    COURSE_COUNT: chapter?._count.courses ?? 0,
    PATHWAY_COMPLETE: 0,
    STREAK: 0,
    CUSTOM: 0,
  };

  // Update current values and check for newly unlocked milestones
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updated = milestones.map((m: any) => {
    const currentValue = stats[m.type as keyof typeof stats] ?? 0;
    const wasUnlocked = m.isUnlocked;
    const isNowUnlocked = currentValue >= m.threshold;

    return {
      id: m.id,
      type: m.type,
      title: m.title,
      description: m.description,
      icon: m.icon,
      threshold: m.threshold,
      currentValue,
      isUnlocked: wasUnlocked || isNowUnlocked,
      isNewlyUnlocked: !wasUnlocked && isNowUnlocked,
      unlockedAt: m.unlockedAt,
      xpReward: m.xpReward,
      progress: Math.min(1, currentValue / m.threshold),
    };
  });

  // Persist any newly unlocked milestones
  for (const m of updated) {
    if (m.isNewlyUnlocked) {
      await db.chapterAchievementMilestone.update({
        where: { id: m.id },
        data: {
          isUnlocked: true,
          unlockedAt: new Date(),
          currentValue: m.currentValue,
        },
      });
    }
  }

  const unlockedCount = updated.filter((m: { isUnlocked: boolean }) => m.isUnlocked).length;
  const totalCount = updated.length;

  return { milestones: updated, unlockedCount, totalCount, stats };
}

/**
 * Get a compact gamification summary for the chapter home page.
 */
export async function getChapterGamificationSummary() {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, chapterId: true, xp: true, level: true, name: true },
  });

  if (!user?.chapterId) return null;

  // Current user's level info
  const levelInfo = getLevelForXp(user.xp);

  // Top 5 members by XP
  const topMembers = await prisma.user.findMany({
    where: { chapterId: user.chapterId },
    select: { id: true, name: true, xp: true, level: true },
    orderBy: { xp: "desc" },
    take: 5,
  });

  // User's rank
  const rank = topMembers.findIndex((m) => m.id === user.id) + 1;
  const totalMembers = await prisma.user.count({ where: { chapterId: user.chapterId } });
  const userRank = rank > 0 ? rank : totalMembers; // If not in top 5, show total

  // Recently unlocked milestones
  const recentMilestones = await db.chapterAchievementMilestone.findMany({
    where: { chapterId: user.chapterId, isUnlocked: true },
    orderBy: { unlockedAt: "desc" },
    take: 3,
  });

  // Total chapter XP
  const chapterXpResult = await prisma.user.aggregate({
    where: { chapterId: user.chapterId },
    _sum: { xp: true },
  });

  return {
    user: {
      xp: user.xp,
      level: levelInfo.level,
      title: levelInfo.title,
      progress: levelInfo.progress,
      rank: userRank,
      totalMembers,
    },
    topMembers: topMembers.map((m) => ({
      id: m.id,
      name: m.name,
      xp: m.xp,
      level: m.level,
      title: getLevelForXp(m.xp).title,
    })),
    recentMilestones: recentMilestones.map((m: { icon: string; title: string; unlockedAt: Date }) => ({
      icon: m.icon,
      title: m.title,
      unlockedAt: m.unlockedAt,
    })),
    chapterTotalXp: chapterXpResult._sum.xp ?? 0,
  };
}

/**
 * Create a custom milestone (chapter president only).
 */
export async function createCustomMilestone(formData: FormData) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { roles: true },
  });

  const isLead = user?.roles.some((r) => r.role === "CHAPTER_PRESIDENT" || r.role === "ADMIN");
  if (!isLead || !user?.chapterId) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const description = (formData.get("description") as string) || null;
  const threshold = parseInt(formData.get("threshold") as string, 10);
  const icon = (formData.get("icon") as string) || "⭐";

  if (!title || !threshold) throw new Error("Title and target are required");

  await db.chapterAchievementMilestone.create({
    data: {
      chapterId: user.chapterId,
      type: "CUSTOM",
      title,
      description,
      icon,
      threshold,
    },
  });

  revalidatePath("/chapter/achievements");
  return { success: true };
}
