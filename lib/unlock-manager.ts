"use server";

import { getSession } from "@/lib/auth-supabase";
import {
  getMentorshipAccessibleMenteeIds,
  hasMentorshipMenteeAccess,
} from "@/lib/mentorship-access";
import { prisma } from "@/lib/prisma";
import { withPrismaFallback } from "@/lib/prisma-guard";
import type { NavGroup } from "@/lib/navigation/types";
import {
  SECTION_NAV_GROUP_MAP,
  SECTION_REQUIREMENTS,
} from "@/lib/unlock-nav-groups";

const UNLOCK_SUPPORT_ROLES = new Set([
  "MENTOR",
  "INSTRUCTOR",
  "CHAPTER_PRESIDENT",
  "ADMIN",
  "STAFF",
]);

async function requireUnlockAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

function canManageUnlocks(roles: string[]) {
  return roles.some((role) => UNLOCK_SUPPORT_ROLES.has(role));
}

async function requireSupportUnlockAccess(studentId: string) {
  const session = await requireUnlockAuth();
  const roles = session.user.roles ?? [];
  if (!canManageUnlocks(roles)) {
    throw new Error("Unauthorized");
  }
  if (!(await hasMentorshipMenteeAccess(session.user.id, roles, studentId))) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireUnlockAdmin() {
  const session = await requireUnlockAuth();
  if (!(session.user.roles ?? []).includes("ADMIN")) {
    throw new Error("Unauthorized");
  }
  return session;
}

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
        const count = await prisma.pathwayStepUnlock.count({
          where: { userId },
        });
        return count >= 4;
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

async function unlockPendingSections(
  userId: string,
  existing: Set<string>
): Promise<string[]> {
  const pendingSections = Object.keys(SECTION_UNLOCK_MAP).filter(
    (sectionKey) => !existing.has(sectionKey)
  );

  if (pendingSections.length === 0) {
    return [];
  }

  const needsPathwayUnlockCount = pendingSections.some((sectionKey) =>
    ["challenges", "opportunities", "people_support"].includes(sectionKey)
  );
  const needsBadgeCount = pendingSections.includes("projects");

  const [pathwayStepUnlockCount, studentBadgeCount] = await Promise.all([
    needsPathwayUnlockCount
      ? prisma.pathwayStepUnlock.count({
          where: { userId },
        })
      : Promise.resolve(0),
    needsBadgeCount
      ? prisma.studentBadge.count({
          where: { studentId: userId },
        })
      : Promise.resolve(0),
  ]);

  const newlyUnlocked = pendingSections.filter((sectionKey) => {
    switch (sectionKey) {
      case "challenges":
        return pathwayStepUnlockCount > 0;
      case "projects":
        return studentBadgeCount > 0;
      case "opportunities":
        return pathwayStepUnlockCount >= 4;
      case "people_support":
        return pathwayStepUnlockCount >= 2;
      default:
        return false;
    }
  });

  await Promise.all(
    newlyUnlocked.map((sectionKey) =>
      unlockSection(userId, sectionKey, "ACHIEVEMENT")
    )
  );

  return newlyUnlocked;
}

export async function checkAndAutoUnlock(userId: string): Promise<string[]> {
  const existing = await getUnlockedSections(userId);
  return unlockPendingSections(userId, existing);
}

export async function checkAndAutoUnlockAndGetSections(
  userId: string
): Promise<{ unlockedSections: Set<string>; newlyUnlocked: string[] }> {
  const existing = await getUnlockedSections(userId);
  const newlyUnlocked = await unlockPendingSections(userId, existing);
  const unlockedSections = new Set(existing);

  for (const sectionKey of newlyUnlocked) {
    unlockedSections.add(sectionKey);
  }

  return { unlockedSections, newlyUnlocked };
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
  sectionKey: string,
  reason?: string
) {
  const session = await requireSupportUnlockAccess(studentId);

  return prisma.unlockRecommendation.create({
    data: {
      studentId,
      mentorId: session.user.id,
      sectionKey,
      reason: reason ?? null,
    },
  });
}

export async function approveUnlockRecommendation(recommendationId: string) {
  const session = await requireUnlockAdmin();
  const rec = await prisma.unlockRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: "APPROVED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });

  await unlockSection(rec.studentId, rec.sectionKey, "MENTOR", rec.mentorId);
  return rec;
}

export async function denyUnlockRecommendation(recommendationId: string) {
  const session = await requireUnlockAdmin();
  return prisma.unlockRecommendation.update({
    where: { id: recommendationId },
    data: {
      status: "DENIED",
      reviewedById: session.user.id,
      reviewedAt: new Date(),
    },
  });
}

export async function mentorDirectUnlock(studentId: string, sectionKey: string) {
  const session = await requireSupportUnlockAccess(studentId);
  // Only basic sections can be directly unlocked by mentors
  const basicSections = new Set(["challenges", "projects", "people_support"]);
  if (!basicSections.has(sectionKey)) {
    throw new Error(
      "This section requires a recommendation for admin approval"
    );
  }
  await unlockSection(studentId, sectionKey, "MENTOR", session.user.id);
}

export async function getPendingRecommendations() {
  await requireUnlockAdmin();

  return prisma.unlockRecommendation.findMany({
    where: { status: "PENDING" },
    include: {
      student: { select: { id: true, name: true, email: true } },
      mentor: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

export async function getMenteeUnlockStatus() {
  const session = await requireUnlockAuth();
  const roles = session.user.roles ?? [];
  if (!canManageUnlocks(roles)) {
    throw new Error("Unauthorized");
  }

  const accessibleMenteeIds = await getMentorshipAccessibleMenteeIds(
    session.user.id,
    roles
  );

  const mentorships = await prisma.mentorship.findMany({
    where: {
      status: "ACTIVE",
      ...(accessibleMenteeIds == null
        ? {}
        : {
            menteeId: {
              in: accessibleMenteeIds.length === 0 ? ["__none__"] : accessibleMenteeIds,
            },
          }),
    },
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
