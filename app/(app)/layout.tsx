import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import { getSession } from "@/lib/auth-supabase";
import { getEnabledFeatureKeysForUser } from "@/lib/feature-gates";
import { prisma } from "@/lib/prisma";
import { getUnlockedSections, checkAndAutoUnlock } from "@/lib/unlock-manager";
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

  // Redirect to onboarding if not completed yet (skip for APPLICANT users)
  if (session?.user?.id && primaryRole !== "APPLICANT") {
    try {
      const onboarding = await prisma.onboardingProgress.findUnique({
        where: { userId: session.user.id },
        select: { completedAt: true },
      });

      if (!onboarding?.completedAt) {
        redirect("/onboarding");
      }
    } catch (e: unknown) {
      // If the OnboardingProgress table doesn't exist yet (P2021),
      // redirect to onboarding so users still see it.
      const isPrismaError = e !== null && typeof e === "object" && "code" in e;
      if (isPrismaError && (e as { code: string }).code === "P2021") {
        redirect("/onboarding");
      }
      throw e;
    }
  }

  // Get user's highest award tier + badge counts for navigation
  let awardTier: string | undefined;
  let badges: { notifications?: number; messages?: number; approvals?: number } = {};
  let enabledFeatureKeysArray: string[] | undefined;
  let unlockedSectionsArray: string[] | undefined;
  let recentlyUnlockedGroupsArray: string[] | undefined;
  if (session?.user?.id) {
    const userId = session.user.id;
    const [userWithAwards, unreadNotifications, unreadMessages, pendingApprovals, enabledFeatureKeys] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: { awards: { select: { type: true } } },
        }),
        // Unread notification count
        prisma.notification.count({
          where: { userId, isRead: false },
        }).catch(() => 0),
        // Unread messages: conversations where latest message is after user's lastReadAt
        prisma.conversationParticipant
          .findMany({
            where: {
              userId,
              conversation: {
                isGroup: false,
              },
            },
            include: {
              conversation: {
                include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
              },
            },
          })
          .then((parts: Array<{ lastReadAt: Date; conversation: { messages: Array<{ createdAt: Date; senderId: string }> } }>) =>
            parts.filter(
              (p) =>
                p.conversation.messages.length > 0 &&
                p.conversation.messages[0].createdAt > p.lastReadAt &&
                p.conversation.messages[0].senderId !== userId,
            ).length,
          )
          .catch(() => 0),
        // Pending approvals placeholder (future: parent approvals, instructor readiness, etc.)
        Promise.resolve(0),
        getEnabledFeatureKeysForUser({
          userId,
          chapterId: session.user.chapterId ?? null,
          roles,
          primaryRole,
        }).catch(() => []),
      ]);

    awardTier = getHighestAwardTier(userWithAwards?.awards ?? []);
    badges = {
      notifications: unreadNotifications || undefined,
      messages: unreadMessages || undefined,
      approvals: pendingApprovals || undefined,
    };
    enabledFeatureKeysArray = enabledFeatureKeys;

    // Fetch unlock data for progressive nav reveal (STUDENT and PARENT roles)
    if (primaryRole === "STUDENT" || primaryRole === "PARENT") {
      try {
        // Auto-unlock any sections the user has earned
        await checkAndAutoUnlock(userId);

        // Fetch current unlocked sections
        const unlockedSections = await getUnlockedSections(userId);
        unlockedSectionsArray = Array.from(unlockedSections);

        // Find recently unlocked groups (last 7 days) for "New!" badges
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
          () => [] as string[],
        );

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
    >
      {children}
    </AppShell>
  );
}
