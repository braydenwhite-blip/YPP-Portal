import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getSession } from "@/lib/auth-supabase";
import {
  getEnabledFeatureKeysForUserCached,
  rolesToSortedCsv,
} from "@/lib/feature-gates-request-cache";
import { resolveNavModel } from "@/lib/navigation/resolve-nav";
import type { NavGroup } from "@/lib/navigation/types";
import { prisma } from "@/lib/prisma";
import {
  getUnreadDirectMessageCountCached,
  getUnreadNotificationCountCached,
} from "@/lib/server-request-cache";
import { ensureAutoUnlockAndGetSections } from "@/lib/unlock-request-cache";
import { getVisibleNavGroups } from "@/lib/unlock-nav-groups";
import { withPrismaFallback } from "@/lib/prisma-guard";

export const dynamic = "force-dynamic";

function getHighestAwardTier(awards: { type: string | null }[]): string | undefined {
  const tiers = awards.map((award) => award.type).filter(Boolean);
  if (tiers.some((tier) => tier?.includes("GOLD"))) return "GOLD";
  if (tiers.some((tier) => tier?.includes("SILVER"))) return "SILVER";
  if (tiers.some((tier) => tier?.includes("BRONZE"))) return "BRONZE";
  return undefined;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  const primaryRole = session?.user?.primaryRole ?? null;
  const userId = session?.user?.id;
  const shouldCheckOnboarding = Boolean(userId && primaryRole !== "APPLICANT");

  const onboardingPromise: Promise<{ completedAt: Date | null } | null> = shouldCheckOnboarding
    ? prisma.onboardingProgress
        .findUnique({
          where: { userId: userId! },
          select: { completedAt: true },
        })
        .catch((error: unknown) => {
          const isPrismaError = error !== null && typeof error === "object" && "code" in error;
          if (isPrismaError && (error as { code: string }).code === "P2021") {
            return null;
          }
          throw error;
        })
    : Promise.resolve({ completedAt: new Date() });

  const badgePromise: Promise<[number, number, number, string[]]> = userId
    ? Promise.all([
        getUnreadNotificationCountCached(userId),
        getUnreadDirectMessageCountCached(userId),
        Promise.resolve(0),
        getEnabledFeatureKeysForUserCached(
          userId,
          session.user.chapterId ?? null,
          rolesToSortedCsv(roles),
          primaryRole,
        ).catch(() => []),
      ])
    : Promise.resolve([0, 0, 0, []]);

  const [onboardingRow, badgeTuple] = await Promise.all([
    onboardingPromise,
    badgePromise,
  ]);

  if (shouldCheckOnboarding) {
    if (onboardingRow === null) {
      redirect("/onboarding");
    }
    if (!onboardingRow.completedAt) {
      redirect("/onboarding");
    }
  }

  const awardTier = getHighestAwardTier(session?.user?.awards ?? []);

  let badges: { notifications?: number; messages?: number; approvals?: number } = {};
  let enabledFeatureKeysArray: string[] | undefined;
  let unlockedSectionsArray: string[] | undefined;
  let recentlyUnlockedGroupsArray: NavGroup[] | undefined;

  if (userId) {
    const [
      unreadNotifications,
      unreadMessages,
      pendingApprovals,
      enabledFeatureKeys,
    ] = badgeTuple;

    badges = {
      notifications: unreadNotifications || undefined,
      messages: unreadMessages || undefined,
      approvals: pendingApprovals || undefined,
    };
    enabledFeatureKeysArray = enabledFeatureKeys;

    if (primaryRole === "STUDENT" || primaryRole === "PARENT") {
      try {
        const [unlockedSections, recentlyUnlockedSections] = await Promise.all([
          ensureAutoUnlockAndGetSections(userId),
          withPrismaFallback(
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
              return recent.map((row) => row.sectionKey);
            },
            () => [] as string[],
          ),
        ]);

        unlockedSectionsArray = Array.from(unlockedSections);

        if (recentlyUnlockedSections.length > 0) {
          const { visibleGroups } = getVisibleNavGroups(
            primaryRole,
            new Set(recentlyUnlockedSections),
          );
          recentlyUnlockedGroupsArray = Array.from(visibleGroups).filter(
            (group) =>
              ![
                "Start Here",
                "Learning",
                "Progress",
                "Profile & Settings",
                "Family",
              ].includes(group),
          );
        }
      } catch {
        unlockedSectionsArray = undefined;
        recentlyUnlockedGroupsArray = undefined;
      }
    }
  }

  const studentFullPortalExplorer = process.env.STUDENT_FULL_PORTAL_EXPLORER === "true";
  const studentHasChapter = Boolean(session?.user?.chapterId);

  const navModelWithLocks = resolveNavModel({
    roles,
    adminSubtypes: (session?.user as { adminSubtypes?: string[] } | undefined)?.adminSubtypes,
    primaryRole,
    awardTier,
    pathname: "/",
    enabledFeatureKeys: enabledFeatureKeysArray
      ? new Set(enabledFeatureKeysArray)
      : undefined,
    unlockedSections: unlockedSectionsArray ? new Set(unlockedSectionsArray) : undefined,
    studentFullPortalExplorer,
    studentHasChapter,
  });

  return (
    <AppShell
      userName={session?.user?.name}
      roles={roles}
      primaryRole={primaryRole}
      navModel={{
        primaryRole: navModelWithLocks.primaryRole,
        visible: navModelWithLocks.visible,
        core: navModelWithLocks.core,
        more: navModelWithLocks.more,
      }}
      badges={badges}
      lockedGroups={
        navModelWithLocks.lockedGroups
          ? Array.from(navModelWithLocks.lockedGroups.entries())
          : undefined
      }
      recentlyUnlockedGroups={recentlyUnlockedGroupsArray}
      studentFullPortalExplorer={studentFullPortalExplorer}
    >
      {children}
    </AppShell>
  );
}
