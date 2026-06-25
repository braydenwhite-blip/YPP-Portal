import { cookies, headers } from "next/headers";
import AppShell from "@/components/app-shell";
import SessionUnavailablePage from "@/components/session-unavailable-page";
import { getSession } from "@/lib/auth-supabase";
import { COMMAND_MODE_COOKIE, parseCommandMode } from "@/lib/command-mode-cookie";
import {
  ensurePortalOnboardingComplete,
  loadAppShellMetadata,
  loadInstructorSubtype,
  shouldCheckPortalOnboarding,
  shouldLoadInstructorSubtype,
} from "@/lib/app-shell-metadata";
import {
  PREVIEW_COOKIE_NAME,
  isOfficerTierFromAuth,
  isPublicGateEnabled,
  verifyPreviewToken,
} from "@/lib/public-gate";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";
import {
  isActionTrackerEnabled,
  isGrowthOsEnabled,
  isLegacyActionCenterNavEnabled,
  isOperationsHubEnabled,
} from "@/lib/feature-flags";
import { isPublicPreviewSlimNavEnabled } from "@/lib/navigation/public-preview-slim-nav";
import { canAccessLeadershipPreviewStack } from "@/lib/leadership-preview-access";
import { syncPortalAuthMetadataForPrismaUser } from "@/lib/sync-portal-auth-metadata";
import type { NavRole } from "@/lib/navigation/types";

export const dynamic = "force-dynamic";

function getHighestAwardTier(awards: { type: string | null }[]): string | undefined {
  const tiers = awards.map((a) => a.type).filter(Boolean);
  if (tiers.some((t) => t?.includes("GOLD"))) return "GOLD";
  if (tiers.some((t) => t?.includes("SILVER"))) return "SILVER";
  if (tiers.some((t) => t?.includes("BRONZE"))) return "BRONZE";
  return undefined;
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session?.user) {
    return <SessionUnavailablePage />;
  }

  const roles = session.user.roles ?? [];
  const primaryRole = session.user.primaryRole ?? null;
  const userId = session.user.id;
  const hiringDemoMode = isHiringDemoModeEnabled();
  const shouldLoadShellMetadata = Boolean(
    userId && primaryRole !== "APPLICANT" && !hiringDemoMode
  );

  const currentPath = (await headers()).get("x-pathname") ?? "";
  const onLaunchpad = currentPath.startsWith("/instructor-onboarding");
  const checkOnboarding = shouldCheckPortalOnboarding({
    userId,
    primaryRole,
    hiringDemoMode,
    onLaunchpad,
  });

  const publicGateEnabled = isPublicGateEnabled();
  const cookieStore = await cookies();
  const previewToken = cookieStore.get(PREVIEW_COOKIE_NAME)?.value ?? null;
  // Read the saved Calm/Executive choice so the first paint matches it (no
  // flash). Undefined when no cookie yet — the provider then adopts a returning
  // visitor's localStorage preference and seeds the cookie for next time.
  const initialCommandMode =
    parseCommandMode(cookieStore.get(COMMAND_MODE_COOKIE)?.value) ?? undefined;
  const loadSubtype = shouldLoadInstructorSubtype(roles, primaryRole);

  const onboardingTask = checkOnboarding
    ? ensurePortalOnboardingComplete({ userId: userId!, roles, primaryRole })
    : Promise.resolve();
  const shellTask = loadAppShellMetadata(session, shouldLoadShellMetadata);
  const subtypeTask = loadSubtype && userId ? loadInstructorSubtype(userId) : Promise.resolve(null);
  const previewTask =
    publicGateEnabled && previewToken ? verifyPreviewToken(previewToken) : Promise.resolve(false);

  const [, shellMetadata, instructorSubtype, previewActive] = await Promise.all([
    onboardingTask,
    shellTask,
    subtypeTask,
    previewTask,
  ]);

  const awardTier = getHighestAwardTier(session.user.awards ?? []);
  const officerBypassesPublicGate = isOfficerTierFromAuth(roles, primaryRole);
  const publicGateActive = publicGateEnabled && !previewActive && !officerBypassesPublicGate;
  const navPrimaryRole = (primaryRole ?? "STUDENT") as NavRole;
  if (userId) {
    void syncPortalAuthMetadataForPrismaUser(userId).catch((error) => {
      console.error("[layout] Failed to sync Supabase user_metadata:", error);
    });
  }
  const officerSlimNavActive =
    isPublicPreviewSlimNavEnabled() &&
    canAccessLeadershipPreviewStack({
      id: userId,
      email: session.user.email,
      name: session.user.name,
      roles,
      primaryRole: navPrimaryRole,
      internalLevel: session.user.internalLevel,
    });

  return (
    <AppShell
      userName={session.user.name}
      userEmail={session.user.email}
      initialCommandMode={initialCommandMode}
      roles={roles}
      adminSubtypes={(session.user as { adminSubtypes?: string[] }).adminSubtypes}
      primaryRole={primaryRole}
      title={session.user.title}
      internalLevel={session.user.internalLevel}
      ladder={session.user.ladder}
      canonicalTitle={session.user.canonicalTitle}
      awardTier={awardTier}
      badges={shellMetadata.badges}
      enabledFeatureKeys={shellMetadata.enabledFeatureKeysArray}
      actionTrackerEnabled={isActionTrackerEnabled()}
      growthOsEnabled={isGrowthOsEnabled()}
      operationsHubEnabled={isOperationsHubEnabled()}
      legacyActionCenterNavEnabled={isLegacyActionCenterNavEnabled()}
      unlockedSections={shellMetadata.unlockedSectionsArray}
      recentlyUnlockedGroups={shellMetadata.recentlyUnlockedGroupsArray}
      studentFullPortalExplorer={process.env.STUDENT_FULL_PORTAL_EXPLORER === "true"}
      studentHasChapter={Boolean(session.user.chapterId)}
      instructorFullPortalExplorer={process.env.INSTRUCTOR_FULL_PORTAL_EXPLORER === "true"}
      hiringDemoMode={hiringDemoMode}
      instructorSubtype={instructorSubtype}
      publicGateActive={publicGateActive}
      previewModeActive={previewActive}
      officerSlimNavActive={officerSlimNavActive}
    >
      {children}
    </AppShell>
  );
}
