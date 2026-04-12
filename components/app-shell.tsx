"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Nav, { type NavBadges } from "@/components/nav";
import BrandLockup from "@/components/brand-lockup";
import LogoutButton from "@/components/logout-button";
import type { NavGroup, NavViewModel } from "@/lib/navigation/types";
import type { PageHelperRole } from "@/lib/page-helper/types";

const PageHelperFab = dynamic(() => import("@/components/page-helper-fab"), {
  ssr: false,
});

export default function AppShell({
  children,
  userName,
  roles,
  primaryRole,
  navModel,
  badges,
  lockedGroups,
  recentlyUnlockedGroups,
  studentFullPortalExplorer,
}: {
  children: React.ReactNode;
  userName?: string | null;
  roles?: string[];
  primaryRole?: string | null;
  navModel: NavViewModel;
  badges?: NavBadges;
  lockedGroups?: Array<[NavGroup, string]>;
  recentlyUnlockedGroups?: NavGroup[];
  studentFullPortalExplorer?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarId = "portal-sidebar";

  const recentlyUnlockedGroupsSet = useMemo(
    () => (recentlyUnlockedGroups ? new Set<NavGroup>(recentlyUnlockedGroups) : undefined),
    [recentlyUnlockedGroups],
  );
  const lockedGroupsMap = useMemo(
    () => (lockedGroups ? new Map(lockedGroups) : undefined),
    [lockedGroups],
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

        <div className="sidebar-nav">
          <Nav
            model={navModel}
            badges={badges}
            onNavigate={() => setSidebarOpen(false)}
            lockedGroups={lockedGroupsMap}
            recentlyUnlockedGroups={recentlyUnlockedGroupsSet}
            studentFullPortalExplorer={studentFullPortalExplorer}
          />
        </div>

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
