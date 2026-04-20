"use client";

import { useMemo, useState } from "react";
import Nav, { type NavBadges } from "@/components/nav";
import BrandLockup from "@/components/brand-lockup";
import LogoutButton from "@/components/logout-button";
import PageHelperFab from "@/components/page-helper-fab";
import type { PageHelperRole } from "@/lib/page-helper/types";

export default function AppShell({
  children,
  userName,
  roles,
  adminSubtypes,
  primaryRole,
  awardTier,
  badges,
  enabledFeatureKeys,
  unlockedSections,
  recentlyUnlockedGroups,
  studentFullPortalExplorer,
  studentHasChapter,
  instructorFullPortalExplorer,
  hiringDemoMode,
}: {
  children: React.ReactNode;
  userName?: string | null;
  roles?: string[];
  adminSubtypes?: string[];
  primaryRole?: string | null;
  awardTier?: string;
  badges?: NavBadges;
  enabledFeatureKeys?: string[];
  unlockedSections?: string[];
  recentlyUnlockedGroups?: string[];
  studentFullPortalExplorer?: boolean;
  /** User is assigned to a chapter; hide "Join a chapter" in the nav. */
  studentHasChapter?: boolean;
  instructorFullPortalExplorer?: boolean;
  hiringDemoMode?: boolean;
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

  return (
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
            onNavigate={() => setSidebarOpen(false)}
            unlockedSections={unlockedSectionsSet}
            recentlyUnlockedGroups={recentlyUnlockedGroupsSet}
            studentFullPortalExplorer={studentFullPortalExplorer}
            studentHasChapter={studentHasChapter}
            instructorFullPortalExplorer={instructorFullPortalExplorer}
            hiringDemoMode={hiringDemoMode}
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
                  {primaryRole ? primaryRole.replace(/_/g, " ") : "Portal access"}
                </p>
              </div>
            </div>
            <LogoutButton className="button small outline logout-button-sidebar" />
          </div>
        </div>
      </aside>

      <main>{children}</main>
      <PageHelperFab
        primaryRole={(primaryRole as PageHelperRole | null | undefined) ?? undefined}
        roles={roles}
      />
    </div>
  );
}
