"use client";

import { useMemo, useState } from "react";
import Nav, { type NavBadges } from "@/components/nav";
import BrandLockup from "@/components/brand-lockup";
import LogoutButton from "@/components/logout-button";
import PageHelperFab from "@/components/page-helper-fab";
import type { PageHelperRole } from "@/lib/page-helper/types";
import { getUserTitle } from "@/lib/user-title";
import { Entity360Provider } from "@/components/operations/entity-360-drawer";
import { HelpAgentProvider } from "@/components/help-agent/help-agent-provider";

/** Mirrors OFFICER_TIER_ROLES in lib/authorization.ts (server-only module). */
const OFFICER_TIER_NAV_ROLES = new Set([
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "HIRING_CHAIR",
]);

export default function AppShell({
  children,
  userName,
  roles,
  adminSubtypes,
  primaryRole,
  awardTier,
  badges,
  enabledFeatureKeys,
  actionTrackerEnabled,
  growthOsEnabled,
  operationsHubEnabled,
  legacyActionCenterNavEnabled,
  unlockedSections,
  recentlyUnlockedGroups,
  studentFullPortalExplorer,
  studentHasChapter,
  instructorFullPortalExplorer,
  hiringDemoMode,
  instructorSubtype,
  publicGateActive,
  previewModeActive,
}: {
  children: React.ReactNode;
  userName?: string | null;
  roles?: string[];
  adminSubtypes?: string[];
  primaryRole?: string | null;
  awardTier?: string;
  badges?: NavBadges;
  enabledFeatureKeys?: string[];
  /** People Strategy Action Tracker enabled (env ENABLE_ACTION_TRACKER). */
  actionTrackerEnabled?: boolean;
  /** Student Operating System / Growth Engine enabled (env ENABLE_GROWTH_OS). */
  growthOsEnabled?: boolean;
  operationsHubEnabled?: boolean;
  /** Deprecated Leadership Action Center nav entry enabled. */
  legacyActionCenterNavEnabled?: boolean;
  unlockedSections?: string[];
  recentlyUnlockedGroups?: string[];
  studentFullPortalExplorer?: boolean;
  /** User is assigned to a chapter; hide "Join a chapter" in the nav. */
  studentHasChapter?: boolean;
  instructorFullPortalExplorer?: boolean;
  hiringDemoMode?: boolean;
  /** SUMMER_WORKSHOP keeps the workshop studio + training links visible. */
  instructorSubtype?: string | null;
  /** Public portal gate is active for this user after admin/preview bypass checks. */
  publicGateActive?: boolean;
  /** User is browsing in internal preview mode — show the indicator bar. */
  previewModeActive?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarId = "portal-sidebar";

  // Convert serialized arrays back to Sets for the Nav component
  const unlockedSectionsSet = useMemo(
    () => (unlockedSections ? new Set(unlockedSections) : undefined),
    [unlockedSections],
  );
  const recentlyUnlockedGroupsSet = useMemo(
    () => (recentlyUnlockedGroups ? new Set(recentlyUnlockedGroups) : undefined),
    [recentlyUnlockedGroups],
  );
  const enabledFeatureKeysSet = useMemo(
    () => (enabledFeatureKeys ? new Set(enabledFeatureKeys) : undefined),
    [enabledFeatureKeys],
  );

  const userInitials = useMemo(() => {
    const raw = (userName ?? "U").trim();
    if (!raw) return "U";
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return raw.slice(0, 2).toUpperCase();
  }, [userName]);

  // Officer tier gates which entity types the Help Agent searches/suggests.
  const officerTier = useMemo(() => {
    if (primaryRole && OFFICER_TIER_NAV_ROLES.has(primaryRole)) return true;
    return (roles ?? []).some((role) => OFFICER_TIER_NAV_ROLES.has(role));
  }, [primaryRole, roles]);

  return (
    <Entity360Provider>
    <HelpAgentProvider officerTier={officerTier}>
    <div className="app-shell">
      {/* Mobile menu toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation"
        aria-expanded={sidebarOpen}
        aria-controls={sidebarId}
        type="button"
      >
        {sidebarOpen ? "\u2715" : "\u2630"}
      </button>

      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSidebarOpen(false);
          }
        }}
        role="button"
        tabIndex={sidebarOpen ? 0 : -1}
        aria-label="Close navigation"
        aria-hidden={!sidebarOpen}
      />

      <aside id={sidebarId} className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Header — fixed */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <BrandLockup
              height={40}
              className="brand-lockup"
              href="/"
              priority
              onClick={() => setSidebarOpen(false)}
            />
          </div>
        </div>

        {/* Scrollable navigation */}
        <div className="sidebar-nav">
          <Nav
            roles={roles}
            adminSubtypes={adminSubtypes}
            primaryRole={primaryRole}
            awardTier={awardTier}
            badges={badges}
            enabledFeatureKeys={enabledFeatureKeysSet}
            actionTrackerEnabled={actionTrackerEnabled}
            growthOsEnabled={growthOsEnabled}
            operationsHubEnabled={operationsHubEnabled}
            legacyActionCenterNavEnabled={legacyActionCenterNavEnabled}
            onNavigate={() => setSidebarOpen(false)}
            unlockedSections={unlockedSectionsSet}
            recentlyUnlockedGroups={recentlyUnlockedGroupsSet}
            studentFullPortalExplorer={studentFullPortalExplorer}
            studentHasChapter={studentHasChapter}
            instructorFullPortalExplorer={instructorFullPortalExplorer}
            hiringDemoMode={hiringDemoMode}
            instructorSubtype={instructorSubtype}
            publicGateActive={publicGateActive}
          />
        </div>

        {/* Footer — fixed */}
        <div className="sidebar-footer">
          <div className="sidebar-footer-card sidebar-marble-panel">
            <div className="sidebar-user-row">
              <div className="sidebar-user-avatar" aria-hidden>
                {userInitials}
              </div>
              <div>
                <p className="user-name">{userName ?? "Portal User"}</p>
                <p className="user-role">
                  {primaryRole || adminSubtypes?.length
                    ? getUserTitle({ primaryRole, adminSubtypes })
                    : "Portal access"}
                </p>
              </div>
            </div>
            <LogoutButton className="button small outline logout-button-sidebar" />
          </div>
        </div>
      </aside>

      <main>
        {previewModeActive && (
          <div
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "8px 16px",
              background: "#f5f3ff",
              borderBottom: "1px solid #ddd6fe",
              color: "#5b21b6",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.4,
              textTransform: "uppercase",
            }}
          >
            <span>Internal preview mode — full portal unlocked on this device</span>
            <a
              href="/api/preview/exit?next=/"
              style={{ color: "#5b21b6", textDecoration: "underline", fontWeight: 600 }}
            >
              Exit preview
            </a>
          </div>
        )}
        {children}
      </main>
      <PageHelperFab
        primaryRole={(primaryRole as PageHelperRole | null | undefined) ?? undefined}
        roles={roles}
      />
    </div>
    </HelpAgentProvider>
    </Entity360Provider>
  );
}
