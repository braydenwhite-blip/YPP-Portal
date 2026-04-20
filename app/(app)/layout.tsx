import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getSession } from "@/lib/auth-supabase";
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

// Force runtime rendering so `next build` doesn't try to prerender pages that
// require auth/database access (which can fail in build environments).
export const dynamic = "force-dynamic";

// Helper to determine highest award tier from awards
function getHighestAwardTier(awards: { type: string | null }[]): string | undefined {
  const tiers = awards.map(a => a.type).filter(Boolean);
  if (tiers.some(t => t?.includes("GOLD"))) return "GOLD";
  if (tiers.some(t => t?.includes("SILVER"))) return "SILVER";
  if (tiers.some(t => t?.includes("BRONZE"))) return "BRONZE";
  return undefined;
}

export default async function AppLayout({
  children
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
        .catch((e: unknown) => {
          const isPrismaError = e !== null && typeof e === "object" && "code" in e;
          if (isPrismaError && (e as { code: string }).code === "P2021") {
            return null;
          }
          throw e;
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

  const [onboardingRow, badgeTuple] = await Promise.all([onboardingPromise, badgePromise]);

  if (shouldCheckOnboarding) {
    if (onboardingRow === null) {
      redirect("/onboarding");
    }
    if (!onboardingRow.completedAt) {
      redirect("/onboarding");
    }
  }

  // Award tier comes from session (see getSessionUser) — avoids an extra user query here.
  const awardTier = getHighestAwardTier(session?.user?.awards ?? []);

  let badges: { notifications?: number; messages?: number; approvals?: number } = {};
  let enabledFeatureKeysArray: string[] | undefined;
  let unlockedSectionsArray: string[] | undefined;
  let recentlyUnlockedGroupsArray: string[] | undefined;
  if (userId) {
    const [unreadNotifications, unreadMessages, pendingApprovals, enabledFeatureKeys] = badgeTuple;
    badges = {
      notifications: unreadNotifications || undefined,
      messages: unreadMessages || undefined,
      approvals: pendingApprovals || undefined,
    };
    enabledFeatureKeysArray = enabledFeatureKeys;

    // Fetch unlock data for progressive nav reveal (STUDENT and PARENT roles)
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
              return recent.map((r) => r.sectionKey);
            },
            () => [] as string[],
          ),
        ]);
        unlockedSectionsArray = Array.from(unlockedSections);

        // Map section keys to nav group names for the "New!" badge
        if (recentlyUnlockedSections.length > 0) {
          const { visibleGroups } = getVisibleNavGroups(
            primaryRole,
            new Set(recentlyUnlockedSections),
          );
          recentlyUnlockedGroupsArray = Array.from(visibleGroups).filter(
            (g) => !["Start Here", "Learning", "Progress", "Profile & Settings", "Family"].includes(g),
          );
        }
      } catch {
        // If unlock tables don't exist yet, continue with no unlock filtering
        unlockedSectionsArray = undefined;
        recentlyUnlockedGroupsArray = undefined;
      }
    }
  }

  const studentFullPortalExplorer = process.env.STUDENT_FULL_PORTAL_EXPLORER === "true";
  const instructorFullPortalExplorer = process.env.INSTRUCTOR_FULL_PORTAL_EXPLORER === "true";
  const hiringDemoMode =
    process.env.HIRING_DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_HIRING_DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const studentHasChapter = Boolean(session?.user?.chapterId);

  return (
    <AppShell
      userName={session?.user?.name}
      roles={roles}
      adminSubtypes={(session?.user as { adminSubtypes?: string[] } | undefined)?.adminSubtypes}
      primaryRole={primaryRole}
      awardTier={awardTier}
      badges={badges}
      enabledFeatureKeys={enabledFeatureKeysArray}
      unlockedSections={unlockedSectionsArray}
      recentlyUnlockedGroups={recentlyUnlockedGroupsArray}
      studentFullPortalExplorer={studentFullPortalExplorer}
      studentHasChapter={studentHasChapter}
      instructorFullPortalExplorer={instructorFullPortalExplorer}
      hiringDemoMode={hiringDemoMode}
    >
      {children}
    </AppShell>
  );
}
