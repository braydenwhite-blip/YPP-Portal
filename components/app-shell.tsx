"use client";

import { useState } from "react";
import Image from "next/image";
import Nav from "@/components/nav";
import LogoutButton from "@/components/logout-button";
import AdminQuickActions from "@/components/admin-quick-actions";

export default function AppShell({
  children,
  userName,
  roles,
  primaryRole,
  awardTier
}: {
  children: React.ReactNode;
  userName?: string | null;
  roles?: string[];
  primaryRole?: string | null;
  awardTier?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      {/* Mobile menu toggle */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle navigation"
        type="button"
      >
        {sidebarOpen ? "\u2715" : "\u2630"}
      </button>

      {/* Mobile backdrop */}
      <div
        className={`sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        {/* Header — fixed */}
        <div className="sidebar-header">
          <div className="brand">
            <Image
              src="/logo-icon.svg"
              alt="YPP Logo"
              width={36}
              height={36}
              className="brand-logo"
            />
            <span className="brand-text">
              Youth Passion <span>Project</span>
            </span>
          </div>
        </div>

        {/* Scrollable navigation */}
        <div className="sidebar-nav">
          <Nav roles={roles} awardTier={awardTier} onNavigate={() => setSidebarOpen(false)} />
        </div>

        {/* Footer — fixed */}
        <div className="sidebar-footer">
          <div className="sidebar-card">
            <div className="sidebar-card-row">
              <div>
                <p className="user-name">{userName ?? "Portal User"}</p>
                <p className="user-role">
                  {primaryRole ? primaryRole.replace("_", " ") : "Portal Access"}
                </p>
              </div>
              <LogoutButton />
            </div>
          </div>
        </div>
      </aside>

      <main>{children}</main>

      {/* Admin Quick Actions Floating Bar */}
      {roles?.includes("ADMIN") && <AdminQuickActions />}
    </div>
  );
}
