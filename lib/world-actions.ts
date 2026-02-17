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
  badgeCount: number;
  courseCount: number;
  challengeCount: number;
  projectCount: number;
  certificateCount: number;
}

export interface WorldData {
  playerName: string;
  avatarUrl: string | null;
  totalXP: number;
  level: number;
  levelTitle: string;
  xpProgress: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  nextLevelTitle: string | null;
  islands: PassionIsland[];
  totalBadges: number;
  totalCertificates: number;
  totalChallenges: number;
  totalProjects: number;
  recentActivity: {
    id: string;
    amount: number;
    reason: string;
    passionId: string | null;
    createdAt: Date;
  }[];
  hasMentor: boolean;
  mentorName: string | null;
  chapterName: string | null;
  chapterMemberCount: number;
  activeChallenges: number;
  upcomingEventCount: number;
}

function normalizeToken(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export async function getWorldData(): Promise<WorldData> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const userId = session.user.id;
  const now = new Date();

  const [
    user,
    interests,
    passions,
    xpProfile,
    badges,
    certificates,
    portalChallengeParticipation,
    talentChallengeCompletions,
    incubatorProjects,
    projectTrackers,
    recentXP,
    recentChallengeSubmissions,
    recentIncubatorUpdates,
    recentTryItHistory,
    mentorship,
    availableActiveChallenges,
    upcomingEvents,
  ] = await Promise.all([
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
            _count: { select: { users: true } },
          },
        },
      },
    }).catch(() => null),
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
    }).catch(() => []),
    prisma.passionArea.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    }).catch(() => []),
    prisma.studentXP.findUnique({ where: { studentId: userId } }).catch(() => null),
    prisma.studentBadge.findMany({
      where: { studentId: userId },
      select: { badgeId: true, badge: { select: { passionId: true } } },
    }).catch(() => []),
    prisma.certificate.findMany({
      where: { recipientId: userId },
      select: { id: true },
    }).catch(() => []),
    prisma.challengeParticipant.findMany({
      where: { studentId: userId },
      select: {
        status: true,
        challenge: {
          select: {
            id: true,
            title: true,
            passionArea: true,
            status: true,
            endDate: true,
          },
        },
      },
    }).catch(() => []),
    prisma.challengeCompletion.findMany({
      where: { studentId: userId },
      select: {
        id: true,
        challenge: { select: { title: true, passionIds: true } },
        completedAt: true,
      },
    }).catch(() => []),
    prisma.incubatorProject.findMany({
      where: { studentId: userId },
      select: {
        id: true,
        title: true,
        passionArea: true,
        updatedAt: true,
      },
    }).catch(() => []),
    prisma.projectTracker.findMany({
      where: { studentId: userId },
      select: {
        id: true,
        title: true,
        passionId: true,
        status: true,
        updatedAt: true,
      },
    }).catch(() => []),
    prisma.xPTransaction.findMany({
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
    }).catch(() => []),
    prisma.challengeSubmission.findMany({
      where: { studentId: userId },
      orderBy: { submittedAt: "desc" },
      take: 5,
      select: {
        id: true,
        submittedAt: true,
        challenge: { select: { title: true, passionArea: true } },
      },
    }).catch(() => []),
    prisma.incubatorUpdate.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        createdAt: true,
        project: {
          select: {
            title: true,
            passionArea: true,
          },
        },
      },
    }).catch(() => []),
    prisma.sessionWatchHistory.findMany({
      where: { studentId: userId, completed: true },
      orderBy: { watchedAt: "desc" },
      take: 5,
      select: {
        id: true,
        watchedAt: true,
        session: {
          select: {
            title: true,
            passionId: true,
          },
        },
      },
    }).catch(() => []),
    prisma.mentorship.findFirst({
      where: { menteeId: userId, status: "ACTIVE" },
      select: { mentor: { select: { name: true } } },
    }).catch(() => null),
    prisma.challenge.count({
      where: {
        status: "ACTIVE",
        endDate: { gte: now },
      },
    }).catch(() => 0),
    prisma.event.count({
      where: { startDate: { gte: now } },
    }).catch(() => 0),
  ]);

  const totalXP = xpProfile?.totalXP ?? user?.xp ?? 0;
  const levelInfo = getLevelForXp(totalXP);

  const passionIdByToken = new Map<string, string>();
  for (const passion of passions) {
    passionIdByToken.set(normalizeToken(passion.id), passion.id);
    passionIdByToken.set(normalizeToken(passion.name), passion.id);
  }
  for (const interest of interests) {
    passionIdByToken.set(normalizeToken(interest.passion.id), interest.passion.id);
    passionIdByToken.set(normalizeToken(interest.passion.name), interest.passion.id);
  }

  const resolvePassionId = (value: string | null | undefined): string | null =>
    passionIdByToken.get(normalizeToken(value)) ?? null;

  const badgesByPassion = new Map<string, number>();
  for (const badge of badges) {
    const pid = resolvePassionId(badge.badge.passionId);
    if (pid) badgesByPassion.set(pid, (badgesByPassion.get(pid) ?? 0) + 1);
  }

  const challengesByPassion = new Map<string, number>();
  for (const participation of portalChallengeParticipation) {
    const pid = resolvePassionId(participation.challenge.passionArea);
    if (pid) {
      challengesByPassion.set(pid, (challengesByPassion.get(pid) ?? 0) + 1);
    }
  }
  for (const completion of talentChallengeCompletions) {
    for (const rawPassionId of completion.challenge.passionIds) {
      const pid = resolvePassionId(rawPassionId);
      if (pid) {
        challengesByPassion.set(pid, (challengesByPassion.get(pid) ?? 0) + 1);
      }
    }
  }

  const projectsByPassion = new Map<string, number>();
  for (const project of incubatorProjects) {
    const pid = resolvePassionId(project.passionArea);
    if (pid) projectsByPassion.set(pid, (projectsByPassion.get(pid) ?? 0) + 1);
  }
  for (const project of projectTrackers) {
    const pid = resolvePassionId(project.passionId);
    if (pid) projectsByPassion.set(pid, (projectsByPassion.get(pid) ?? 0) + 1);
  }

  const courseCountsByPassion = new Map<string, number>();
  if (interests.length > 0) {
    try {
      const passionNames = interests.map((entry) => entry.passion.name);
      const enrollments = await prisma.enrollment.findMany({
        where: {
          userId,
          course: { interestArea: { in: passionNames } },
        },
        select: { course: { select: { interestArea: true } } },
      });
      for (const enrollment of enrollments) {
        const matchedPassion = passions.find(
          (passion) => passion.name.toLowerCase() === enrollment.course.interestArea.toLowerCase()
        );
        if (matchedPassion) {
          courseCountsByPassion.set(
            matchedPassion.id,
            (courseCountsByPassion.get(matchedPassion.id) ?? 0) + 1
          );
        }
      }
    } catch {
      // Enrollment data can be absent in partial envs.
    }
  }

  const islands: PassionIsland[] = interests.map((interest) => ({
    id: interest.id,
    passionId: interest.passion.id,
    name: interest.passion.name,
    category: interest.passion.category,
    icon: interest.passion.icon,
    color: interest.passion.color,
    level: interest.level,
    xpPoints: interest.xpPoints,
    currentLevel: interest.currentLevel,
    isPrimary: interest.isPrimary,
    startedAt: interest.startedAt,
    lastActiveAt: interest.lastActiveAt,
    badgeCount: badgesByPassion.get(interest.passion.id) ?? 0,
    courseCount: courseCountsByPassion.get(interest.passion.id) ?? 0,
    challengeCount: challengesByPassion.get(interest.passion.id) ?? 0,
    projectCount: projectsByPassion.get(interest.passion.id) ?? 0,
    certificateCount: 0,
  }));

  const activityFromXp = recentXP.map((entry) => ({
    id: `xp-${entry.id}`,
    amount: entry.amount,
    reason: entry.reason,
    passionId: resolvePassionId(entry.passionId),
    createdAt: entry.createdAt,
  }));
  const activityFromChallengeSubmissions = recentChallengeSubmissions.map((entry) => ({
    id: `challenge-${entry.id}`,
    amount: 12,
    reason: `Challenge check-in: ${entry.challenge.title}`,
    passionId: resolvePassionId(entry.challenge.passionArea),
    createdAt: entry.submittedAt,
  }));
  const activityFromIncubatorUpdates = recentIncubatorUpdates.map((entry) => ({
    id: `incubator-${entry.id}`,
    amount: 15,
    reason: `Incubator update: ${entry.title || entry.project.title}`,
    passionId: resolvePassionId(entry.project.passionArea),
    createdAt: entry.createdAt,
  }));
  const activityFromTryIt = recentTryItHistory.map((entry) => ({
    id: `tryit-${entry.id}`,
    amount: 10,
    reason: `Completed Try-It: ${entry.session.title}`,
    passionId: resolvePassionId(entry.session.passionId),
    createdAt: entry.watchedAt,
  }));

  const recentActivity = [
    ...activityFromXp,
    ...activityFromChallengeSubmissions,
    ...activityFromIncubatorUpdates,
    ...activityFromTryIt,
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);

  const userActiveChallengeParticipation = portalChallengeParticipation.filter(
    (entry) =>
      entry.status === "ACTIVE" &&
      entry.challenge.status === "ACTIVE" &&
      entry.challenge.endDate >= now
  ).length;
  const completedPortalChallenges = portalChallengeParticipation.filter(
    (entry) => entry.status === "COMPLETED"
  ).length;
  const totalChallenges = completedPortalChallenges + talentChallengeCompletions.length;
  const totalProjects = incubatorProjects.length + projectTrackers.length;

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
    totalChallenges,
    totalProjects,
    recentActivity,
    hasMentor: !!mentorship,
    mentorName: mentorship?.mentor?.name ?? null,
    chapterName: user?.chapter?.name ?? null,
    chapterMemberCount: user?.chapter?._count?.users ?? 0,
    activeChallenges: userActiveChallengeParticipation || availableActiveChallenges,
    upcomingEventCount: upcomingEvents,
  };
}
