import { cookies, headers } from "next/headers";
import AppShell from "@/components/app-shell";
import SessionUnavailablePage from "@/components/session-unavailable-page";
import { getSession } from "@/lib/auth-supabase";
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

  return (
    <AppShell
      userName={session.user.name}
      roles={roles}
      adminSubtypes={(session.user as { adminSubtypes?: string[] }).adminSubtypes}
      primaryRole={primaryRole}
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
    >
      {children}
    </AppShell>
  );
}
