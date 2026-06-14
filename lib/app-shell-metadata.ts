import { cache } from "react";
import { redirect } from "next/navigation";

import { verifyPreviewToken } from "@/lib/public-gate";
import { getChairQueueBadgeCount } from "@/lib/hiring-chair-badge";
import {
  getEnabledFeatureKeysForUserCached,
  rolesToSortedCsv,
} from "@/lib/feature-gates-request-cache";
import { prisma } from "@/lib/prisma";
import {
  getUnreadDirectMessageCountCached,
  getUnreadNotificationCountCached,
} from "@/lib/server-request-cache";
import { ensureAutoUnlockAndGetSections } from "@/lib/unlock-request-cache";
import { getVisibleNavGroups } from "@/lib/unlock-nav-groups";
import { withPrismaFallback } from "@/lib/prisma-guard";
import type { SessionUser } from "@/lib/auth-supabase";

const OFFICER_ROLES_SKIP_ONBOARDING = new Set([
  "ADMIN",
  "STAFF",
  "HIRING_CHAIR",
]);

export function shouldCheckPortalOnboarding(params: {
  userId: string | undefined;
  primaryRole: string | null;
  hiringDemoMode: boolean;
  onLaunchpad: boolean;
}): boolean {
  const { userId, primaryRole, hiringDemoMode, onLaunchpad } = params;
  if (!userId || hiringDemoMode || onLaunchpad || primaryRole === "APPLICANT") {
    return false;
  }
  if (primaryRole && OFFICER_ROLES_SKIP_ONBOARDING.has(primaryRole)) {
    return false;
  }
  return true;
}

export function shouldLoadInstructorSubtype(roles: string[], primaryRole: string | null): boolean {
  return (
    primaryRole === "INSTRUCTOR" ||
    primaryRole === "APPLICANT" ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("APPLICANT")
  );
}

export const loadInstructorSubtype = cache(async (userId: string) => {
  try {
    const row = await prisma.instructorApplication.findFirst({
      where: { applicantId: userId },
      orderBy: { createdAt: "desc" },
      select: { instructorSubtype: true },
    });
    return row?.instructorSubtype ?? null;
  } catch {
    return null;
  }
});

export type AppShellMetadata = {
  badges: {
    notifications?: number;
    messages?: number;
    approvals?: number;
    chairQueueCount?: number;
  };
  enabledFeatureKeysArray: string[] | undefined;
  unlockedSectionsArray: string[] | undefined;
  recentlyUnlockedGroupsArray: string[] | undefined;
};

/** Badge counts, feature gates, and unlock state — parallelized for the app shell. */
export async function loadAppShellMetadata(
  session: { user: SessionUser },
  shouldLoadShellMetadata: boolean
): Promise<AppShellMetadata> {
  if (!shouldLoadShellMetadata || !session.user.id) {
    return {
      badges: {},
      enabledFeatureKeysArray: undefined,
      unlockedSectionsArray: undefined,
      recentlyUnlockedGroupsArray: undefined,
    };
  }

  const userId = session.user.id;
  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole ?? null;

  const [unreadNotifications, unreadMessages, chairQueueCount, enabledFeatureKeys] =
    await Promise.all([
      getUnreadNotificationCountCached(userId),
      getUnreadDirectMessageCountCached(userId),
      getChairQueueBadgeCount(roles),
      getEnabledFeatureKeysForUserCached(
        userId,
        session.user.chapterId ?? null,
        rolesToSortedCsv(roles),
        primaryRole
      ).catch(() => [] as string[]),
    ]);

  const badges = {
    notifications: unreadNotifications || undefined,
    messages: unreadMessages || undefined,
    approvals: undefined,
    chairQueueCount: chairQueueCount || undefined,
  };

  if (primaryRole !== "STUDENT" && primaryRole !== "PARENT") {
    return {
      badges,
      enabledFeatureKeysArray: enabledFeatureKeys,
      unlockedSectionsArray: undefined,
      recentlyUnlockedGroupsArray: undefined,
    };
  }

  try {
    const unlockedSections = await ensureAutoUnlockAndGetSections(userId);
    const recentlyUnlockedSections = await withPrismaFallback(
      "recentUnlocks",
      async () => {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = await prisma.portalUnlock.findMany({
          where: {
            userId,
            unlockedAt: { gte: sevenDaysAgo },
          },
          select: { sectionKey: true },
        });
        return recent.map((r) => r.sectionKey);
      },
      () => [] as string[]
    );

    let recentlyUnlockedGroupsArray: string[] | undefined;
    if (recentlyUnlockedSections.length > 0) {
      const { visibleGroups } = getVisibleNavGroups(
        primaryRole,
        new Set(recentlyUnlockedSections)
      );
      recentlyUnlockedGroupsArray = Array.from(visibleGroups).filter(
        (g) =>
          ![
            "Start Here",
            "Learning",
            "Progress",
            "Profile & Settings",
            "Family",
          ].includes(g)
      );
    }

    return {
      badges,
      enabledFeatureKeysArray: enabledFeatureKeys,
      unlockedSectionsArray: Array.from(unlockedSections),
      recentlyUnlockedGroupsArray,
    };
  } catch {
    return {
      badges,
      enabledFeatureKeysArray: enabledFeatureKeys,
      unlockedSectionsArray: undefined,
      recentlyUnlockedGroupsArray: undefined,
    };
  }
}

export async function ensurePortalOnboardingComplete(params: {
  userId: string;
  roles: string[];
  primaryRole: string | null;
}): Promise<void> {
  const handleMissingTable = (e: unknown) => {
    const isPrismaError = e !== null && typeof e === "object" && "code" in e;
    if (isPrismaError && (e as { code: string }).code === "P2021") {
      return null;
    }
    throw e;
  };

  const { userId, roles, primaryRole } = params;
  const isInstructor = primaryRole === "INSTRUCTOR" || roles.includes("INSTRUCTOR");

  if (isInstructor) {
    const [journeyRow, legacyRow] = await Promise.all([
      prisma.instructorJourney
        .findUnique({ where: { userId }, select: { completedAt: true } })
        .catch(handleMissingTable),
      prisma.onboardingProgress
        .findUnique({ where: { userId }, select: { completedAt: true } })
        .catch(handleMissingTable),
    ]);
    const onboarded = Boolean(journeyRow?.completedAt || legacyRow?.completedAt);
    if (!onboarded) {
      redirect("/instructor-onboarding");
    }
    return;
  }

  const onboardingRow = await prisma.onboardingProgress
    .findUnique({ where: { userId }, select: { completedAt: true } })
    .catch(handleMissingTable);
  if (onboardingRow === null || !onboardingRow.completedAt) {
    redirect("/onboarding");
  }
}
