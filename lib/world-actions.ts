"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLevelForXp } from "@/lib/xp-config";

export interface PassionIsland {
  id: string;
  passionId: string;
  name: string;
  category: string;
  icon: string | null;
  color: string | null;
  level: string; // EXPLORING, DEVELOPING, ADVANCING, MASTERING
  xpPoints: number;
  currentLevel: number;
  isPrimary: boolean;
  startedAt: Date;
  lastActiveAt: Date;
  // Enrichment
  badgeCount: number;
  courseCount: number;
  challengeCount: number;
  projectCount: number;
  certificateCount: number;
}

export interface WorldData {
  // Player
  playerName: string;
  avatarUrl: string | null;

  // XP & Level
  totalXP: number;
  level: number;
  levelTitle: string;
  xpProgress: number; // 0-1
  xpIntoLevel: number;
  xpForNextLevel: number;
  nextLevelTitle: string | null;

  // Passion Islands
  islands: PassionIsland[];

  // Aggregate stats for HUD
  totalBadges: number;
  totalCertificates: number;
  totalChallenges: number;
  totalProjects: number;

  // Recent activity (last 10 XP transactions)
  recentActivity: {
    id: string;
    amount: number;
    reason: string;
    passionId: string | null;
    createdAt: Date;
  }[];

  // Mentor info (for tower placeholder)
  hasMentor: boolean;
  mentorName: string | null;

  // Chapter info (for town placeholder)
  chapterName: string | null;
  chapterMemberCount: number;

  // Active challenges (for seasonal events placeholder)
  activeChallenges: number;

  // Upcoming events
  upcomingEventCount: number;
}

export async function getWorldData(): Promise<WorldData> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;

  const [
    user,
    interests,
    xpProfile,
    badges,
    certificates,
    challengeCompletions,
    projects,
    recentXP,
    mentorship,
    activeChallenges,
    upcomingEvents,
  ] = await Promise.all([
    // User with profile and chapter
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        xp: true,
        level: true,
        profile: { select: { avatarUrl: true } },
        chapter: {
          select: {
            name: true,
            _count: { select: { members: true } },
          },
        },
      },
    }),

    // Passion interests with enrichment counts
    prisma.studentInterest.findMany({
      where: { studentId: userId },
      include: {
        passion: {
          select: {
            id: true,
            name: true,
            category: true,
            icon: true,
            color: true,
          },
        },
      },
      orderBy: { xpPoints: "desc" },
    }),

    // XP profile
    prisma.studentXP
      .findUnique({ where: { studentId: userId } })
      .catch(() => null),

    // Badges
    prisma.studentBadge.findMany({
      where: { studentId: userId },
      select: { badgeId: true, badge: { select: { passionId: true } } },
    }),

    // Certificates
    prisma.certificate.findMany({
      where: { recipientId: userId },
      select: { id: true },
    }),

    // Challenge completions
    prisma.challengeCompletion.findMany({
      where: { studentId: userId },
      select: {
        id: true,
        challenge: { select: { passionIds: true } },
      },
    }),

    // Projects
    prisma.incubatorProject
      .findMany({
        where: { studentId: userId },
        select: { id: true, passionArea: true },
      })
      .catch(() => []),

    // Recent XP transactions
    prisma.xPTransaction
      .findMany({
        where: { studentId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          reason: true,
          passionId: true,
          createdAt: true,
        },
      })
      .catch(() => []),

    // Mentor
    prisma.mentorship
      .findFirst({
        where: { menteeId: userId, status: "ACTIVE" },
        select: { mentor: { select: { name: true } } },
      })
      .catch(() => null),

    // Active challenges
    prisma.challenge
      .count({
        where: {
          status: "ACTIVE",
          endDate: { gte: new Date() },
        },
      })
      .catch(() => 0),

    // Upcoming events
    prisma.event
      .count({
        where: { startDate: { gte: new Date() } },
      })
      .catch(() => 0),
  ]);

  const totalXP = xpProfile?.totalXP ?? user?.xp ?? 0;
  const levelInfo = getLevelForXp(totalXP);

  // Build per-passion enrichment
  const badgesByPassion = new Map<string, number>();
  for (const b of badges) {
    const pid = b.badge.passionId;
    if (pid) badgesByPassion.set(pid, (badgesByPassion.get(pid) ?? 0) + 1);
  }

  const challengesByPassion = new Map<string, number>();
  for (const c of challengeCompletions) {
    for (const pid of c.challenge.passionIds) {
      challengesByPassion.set(pid, (challengesByPassion.get(pid) ?? 0) + 1);
    }
  }

  const projectsByPassion = new Map<string, number>();
  for (const p of projects) {
    projectsByPassion.set(
      p.passionArea,
      (projectsByPassion.get(p.passionArea) ?? 0) + 1,
    );
  }

  // Count courses per passion (by matching interest area name)
  const courseCountsByPassion = new Map<string, number>();
  if (interests.length > 0) {
    const passionNames = interests.map((i) => i.passion.name);
    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId,
        course: { interestArea: { in: passionNames } },
      },
      select: { course: { select: { interestArea: true } } },
    });
    for (const e of enrollments) {
      const area = e.course.interestArea;
      courseCountsByPassion.set(area, (courseCountsByPassion.get(area) ?? 0) + 1);
    }
  }

  const islands: PassionIsland[] = interests.map((i) => ({
    id: i.id,
    passionId: i.passion.id,
    name: i.passion.name,
    category: i.passion.category,
    icon: i.passion.icon,
    color: i.passion.color,
    level: i.level,
    xpPoints: i.xpPoints,
    currentLevel: i.currentLevel,
    isPrimary: i.isPrimary,
    startedAt: i.startedAt,
    lastActiveAt: i.lastActiveAt,
    badgeCount: badgesByPassion.get(i.passion.id) ?? 0,
    courseCount: courseCountsByPassion.get(i.passion.name) ?? 0,
    challengeCount: challengesByPassion.get(i.passion.id) ?? 0,
    projectCount: projectsByPassion.get(i.passion.name) ?? 0,
    certificateCount: 0,
  }));

  return {
    playerName: user?.name ?? "Explorer",
    avatarUrl: user?.profile?.avatarUrl ?? null,
    totalXP,
    level: levelInfo.level,
    levelTitle: levelInfo.title,
    xpProgress: levelInfo.progress,
    xpIntoLevel: levelInfo.xpIntoLevel,
    xpForNextLevel: levelInfo.xpForNextLevel,
    nextLevelTitle: levelInfo.nextLevel?.title ?? null,
    islands,
    totalBadges: badges.length,
    totalCertificates: certificates.length,
    totalChallenges: challengeCompletions.length,
    totalProjects: projects.length,
    recentActivity: recentXP,
    hasMentor: !!mentorship,
    mentorName: mentorship?.mentor?.name ?? null,
    chapterName: user?.chapter?.name ?? null,
    chapterMemberCount: user?.chapter?._count?.members ?? 0,
    activeChallenges,
    upcomingEventCount: upcomingEvents,
  };
}
