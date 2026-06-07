import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import AppShell from "@/components/app-shell";
import SessionUnavailablePage from "@/components/session-unavailable-page";
import { getSession } from "@/lib/auth-supabase";
import {
  PREVIEW_COOKIE_NAME,
  isPublicGateEnabled,
  verifyPreviewToken,
} from "@/lib/public-gate";
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
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";
import { getChairQueueBadgeCount } from "@/lib/hiring-chair-badge";
import {
  isActionTrackerEnabled,
  isLegacyActionCenterNavEnabled,
  isOperationsHubEnabled,
} from "@/lib/feature-flags";

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

  // Middleware passed this request through (auth cookie is valid), but
  // getSession couldn't resolve the user record — either the Prisma row
  // is missing, the lookup timed out, or supabaseAuthId is unlinked.
  // Rendering the shell with "Portal User" placeholders silently hides a
  // broken session. We cannot redirect to /login — middleware will bounce
  // the valid auth cookie right back here and loop. Instead, render a
  // dedicated recovery page with retry + sign-out options.
  if (!session?.user) {
    return <SessionUnavailablePage />;
  }

  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole ?? null;
  const userId = session.user.id;
  const hiringDemoMode = isHiringDemoModeEnabled();
  const shouldCheckOnboarding = Boolean(
    userId && primaryRole !== "APPLICANT" && !hiringDemoMode,
  );
  const shouldLoadShellMetadata = Boolean(
    userId && primaryRole !== "APPLICANT" && !hiringDemoMode,
  );

  // The middleware exposes the current path via the `x-pathname` header so the
  // gate can avoid redirecting a user who is *already* on their onboarding
  // destination (otherwise the launchpad — which lives inside this (app) layout
  // — would redirect to itself in an infinite loop).
  const currentPath = (await headers()).get("x-pathname") ?? "";
  const onLaunchpad = currentPath.startsWith("/instructor-onboarding");

  if (shouldCheckOnboarding && !onLaunchpad) {
    // Treat a missing onboarding table (P2021) on un-migrated environments as
    // "not blocking" rather than throwing.
    const handleMissingTable = (e: unknown) => {
      const isPrismaError = e !== null && typeof e === "object" && "code" in e;
      if (isPrismaError && (e as { code: string }).code === "P2021") {
        return null;
      }
      throw e;
    };

    const isInstructor =
      primaryRole === "INSTRUCTOR" || roles.includes("INSTRUCTOR");

    if (isInstructor) {
      // Instructors onboard through the unified Instructor Launchpad. The
      // InstructorJourney row is the source of truth; fall back to a completed
      // legacy OnboardingProgress so already-onboarded instructors aren't
      // re-gated before the backfill runs.
      const [journeyRow, legacyRow] = await Promise.all([
        prisma.instructorJourney
          .findUnique({ where: { userId: userId! }, select: { completedAt: true } })
          .catch(handleMissingTable),
        prisma.onboardingProgress
          .findUnique({ where: { userId: userId! }, select: { completedAt: true } })
          .catch(handleMissingTable),
      ]);
      const onboarded = Boolean(journeyRow?.completedAt || legacyRow?.completedAt);
      if (!onboarded) {
        redirect("/instructor-onboarding");
      }
    } else {
      const onboardingRow = await prisma.onboardingProgress
        .findUnique({ where: { userId: userId! }, select: { completedAt: true } })
        .catch(handleMissingTable);
      if (onboardingRow === null || !onboardingRow.completedAt) {
        redirect("/onboarding");
      }
    }
  }

  // Award tier comes from session (see getSessionUser) — avoids an extra user query here.
  const awardTier = getHighestAwardTier(session?.user?.awards ?? []);

  let badges: {
    notifications?: number;
    messages?: number;
    approvals?: number;
    chairQueueCount?: number;
  } = {};
  let enabledFeatureKeysArray: string[] | undefined;
  let unlockedSectionsArray: string[] | undefined;
  let recentlyUnlockedGroupsArray: string[] | undefined;
  if (shouldLoadShellMetadata && userId) {
    const [unreadNotifications, unreadMessages, chairQueueCount, enabledFeatureKeys] =
      await Promise.all([
        getUnreadNotificationCountCached(userId),
        getUnreadDirectMessageCountCached(userId),
        getChairQueueBadgeCount(roles),
        getEnabledFeatureKeysForUserCached(
          userId,
          session.user.chapterId ?? null,
          rolesToSortedCsv(roles),
          primaryRole,
        ).catch(() => [] as string[]),
      ]);
    const pendingApprovals = 0;

    badges = {
      notifications: unreadNotifications || undefined,
      messages: unreadMessages || undefined,
      approvals: pendingApprovals || undefined,
      chairQueueCount: chairQueueCount || undefined,
    };
    enabledFeatureKeysArray = enabledFeatureKeys;

    // Fetch unlock data for progressive nav reveal (STUDENT and PARENT roles)
    if (primaryRole === "STUDENT" || primaryRole === "PARENT") {
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
          () => [] as string[],
        );
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
  const studentHasChapter = Boolean(session?.user?.chapterId);

  // Public portal gate: a tester with a valid signed preview cookie sees
  // the full portal. Every other authenticated user — admins included —
  // sees the focused experience with a sidebar trimmed to the
  // public-allowed routes until they enter the preview passcode.
  const publicGateEnabled = isPublicGateEnabled();
  const cookieStore = await cookies();
  const previewToken = cookieStore.get(PREVIEW_COOKIE_NAME)?.value ?? null;
  const previewActive = previewToken ? await verifyPreviewToken(previewToken) : false;
  // The gate is "active" for this user unless they hold a valid preview
  // cookie. There is no admin bypass.
  const publicGateActive = publicGateEnabled && !previewActive;

  // Resolve the user's instructor subtype (most recent application) so
  // SUMMER_WORKSHOP-approved users keep workshop studio + training links
  // visible while the regular instructor program is paused.
  const instructorSubtype = userId
    ? await prisma.instructorApplication
        .findFirst({
          where: { applicantId: userId },
          orderBy: { createdAt: "desc" },
          select: { instructorSubtype: true },
        })
        .then((row) => row?.instructorSubtype ?? null)
        .catch(() => null)
    : null;

  return (
    <AppShell
      userName={session?.user?.name}
      roles={roles}
      adminSubtypes={(session?.user as { adminSubtypes?: string[] } | undefined)?.adminSubtypes}
      primaryRole={primaryRole}
      awardTier={awardTier}
      badges={badges}
      enabledFeatureKeys={enabledFeatureKeysArray}
      actionTrackerEnabled={isActionTrackerEnabled()}
      operationsHubEnabled={isOperationsHubEnabled()}
      legacyActionCenterNavEnabled={isLegacyActionCenterNavEnabled()}
      unlockedSections={unlockedSectionsArray}
      recentlyUnlockedGroups={recentlyUnlockedGroupsArray}
      studentFullPortalExplorer={studentFullPortalExplorer}
      studentHasChapter={studentHasChapter}
      instructorFullPortalExplorer={instructorFullPortalExplorer}
      hiringDemoMode={hiringDemoMode}
      instructorSubtype={instructorSubtype}
      publicGateActive={publicGateActive}
      previewModeActive={previewActive}
    >
      {children}
    </AppShell>
  );
}
