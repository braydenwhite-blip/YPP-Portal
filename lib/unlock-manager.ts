"use server";

import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import type { NavGroup } from "@/lib/navigation/types";
import {
  SECTION_NAV_GROUP_MAP,
  SECTION_REQUIREMENTS,
} from "@/lib/unlock-nav-groups";

// Re-export the pure utility so callers don't need to know about the split.
export { getVisibleNavGroups } from "@/lib/unlock-nav-groups";

// ============================================
// SECTION UNLOCK MAP
// ============================================

export type UnlockCriteria = {
  type: "ACHIEVEMENT";
  check: (userId: string) => Promise<boolean>;
  requirement: string;
};

type SectionDef = {
  navGroups: NavGroup[];
  unlockCriteria: UnlockCriteria;
};

const SECTION_UNLOCK_MAP: Record<string, SectionDef> = {
  challenges: {
    navGroups: SECTION_NAV_GROUP_MAP.challenges,
    unlockCriteria: {
      type: "ACHIEVEMENT",
      requirement: SECTION_REQUIREMENTS.challenges,
      check: async (userId: string) => {
        const count = await prisma.pathwayStepUnlock.count({
          where: { userId },
        });
        return count > 0;
      },
    },
  },
  projects: {
    navGroups: SECTION_NAV_GROUP_MAP.projects,
    unlockCriteria: {
      type: "ACHIEVEMENT",
      requirement: SECTION_REQUIREMENTS.projects,
      check: async (userId: string) => {
        const count = await prisma.studentBadge.count({
          where: { studentId: userId },
        });
        return count > 0;
      },
    },
  },
  opportunities: {
    navGroups: SECTION_NAV_GROUP_MAP.opportunities,
    unlockCriteria: {
      type: "ACHIEVEMENT",
      requirement: SECTION_REQUIREMENTS.opportunities,
      check: async (userId: string) => {
        // If they have more than 4 step unlocks, consider them ready for opportunities
        const completedPathways = await prisma.pathwayStepUnlock.findMany({
          where: { userId },
          select: { step: { select: { pathway: { select: { name: true } } } } },
        });
        return completedPathways.length >= 4;
      },
    },
  },
  people_support: {
    navGroups: SECTION_NAV_GROUP_MAP.people_support,
    unlockCriteria: {
      type: "ACHIEVEMENT",
      requirement: SECTION_REQUIREMENTS.people_support,
      check: async (userId: string) => {
        const count = await prisma.pathwayStepUnlock.count({
          where: { userId },
        });
        return count >= 2;
      },
    },
  },
};

// ============================================
// CORE FUNCTIONS
// ============================================

export async function getUnlockedSections(
  userId: string
): Promise<Set<string>> {
  return withPrismaFallback(
    "getUnlockedSections",
    async () => {
      const unlocks = await prisma.portalUnlock.findMany({
        where: { userId },
        select: { sectionKey: true },
      });
      return new Set(unlocks.map((u) => u.sectionKey));
    },
    () => new Set<string>()
  );
}

export async function unlockSection(
  userId: string,
  sectionKey: string,
  method: string,
  unlockerId?: string
): Promise<void> {
  await prisma.portalUnlock.upsert({
    where: { userId_sectionKey: { userId, sectionKey } },
    create: {
      userId,
      sectionKey,
      unlockedBy: method,
      unlockerUserId: unlockerId ?? null,
    },
    update: {},
  });
}

export async function checkAndAutoUnlock(userId: string): Promise<string[]> {
  const existing = await getUnlockedSections(userId);
  const newlyUnlocked: string[] = [];

  for (const [sectionKey, def] of Object.entries(SECTION_UNLOCK_MAP)) {
    if (existing.has(sectionKey)) continue;

    const met = await def.unlockCriteria.check(userId);
    if (met) {
      await unlockSection(userId, sectionKey, "ACHIEVEMENT");
      newlyUnlocked.push(sectionKey);
    }
  }

  return newlyUnlocked;
}

export type UnlockProgressItem = {
  sectionKey: string;
  navGroups: NavGroup[];
  isUnlocked: boolean;
  requirement: string;
};

export async function getUnlockProgress(
  userId: string
): Promise<UnlockProgressItem[]> {
  const unlocked = await getUnlockedSections(userId);

  return Object.entries(SECTION_UNLOCK_MAP).map(([key, def]) => ({
    sectionKey: key,
    navGroups: def.navGroups,
    isUnlocked: unlocked.has(key),
    requirement: def.unlockCriteria.requirement,
  }));
}

// ============================================
// MENTOR / ADMIN UNLOCK ACTIONS
// ============================================

export async function createUnlockRecommendation(
  studentId: string,
  mentorId: string,
  sectionKey: string,
  reason?: string
) {
  return prisma.unlockRecommendation.create({
    data: {
      studentId,
      mentorId,
      sectionKey,
      reason: reason ?? null,
    },
  });
}

export async function approveUnlockRecommendation(
  recommendationId: string,
  reviewerId: string
) {
  const rec = await prisma.unlockRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: "APPROVED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });

  await unlockSection(rec.studentId, rec.sectionKey, "MENTOR", rec.mentorId);
  return rec;
}

export async function denyUnlockRecommendation(
  recommendationId: string,
  reviewerId: string
) {
  return prisma.unlockRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: "DENIED",
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  });
}

export async function mentorDirectUnlock(
  studentId: string,
  mentorId: string,
  sectionKey: string
) {
  // Only basic sections can be directly unlocked by mentors
  const basicSections = new Set(["challenges", "projects", "people_support"]);
  if (!basicSections.has(sectionKey)) {
    throw new Error(
      "This section requires a recommendation for admin approval"
    );
  }
  await unlockSection(studentId, sectionKey, "MENTOR", mentorId);
}

export async function getPendingRecommendations() {
  return prisma.unlockRecommendation.findMany({
    where: { status: "PENDING" },
    include: {
      student: { select: { id: true, name: true, email: true } },
      mentor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getMenteeUnlockStatus(mentorId: string) {
  const mentorships = await prisma.mentorship.findMany({
    where: { mentorId, status: "ACTIVE" },
    select: {
      mentee: {
        select: {
          id: true,
          name: true,
          portalUnlocks: { select: { sectionKey: true, unlockedAt: true } },
        },
      },
    },
  });

  return mentorships.map((m) => ({
    menteeId: m.mentee.id,
    menteeName: m.mentee.name,
    unlocked: m.mentee.portalUnlocks.map((u) => u.sectionKey),
    allSections: Object.keys(SECTION_UNLOCK_MAP),
  }));
}
