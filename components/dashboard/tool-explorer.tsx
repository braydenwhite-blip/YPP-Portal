"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { DashboardSection } from "@/lib/dashboard/types";

function trackDashboardEvent(eventType: string, eventData: Record<string, unknown>) {
  try {
    const payload = JSON.stringify({ eventType, eventData });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/dashboard", payload);
      return;
    }
    void fetch("/api/analytics/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    });
  } catch {
    // Tracking should never block UX.
  }
}

export default function ToolExplorer({
  sections,
  moduleBadgeByHref,
}: {
  sections: DashboardSection[];
  moduleBadgeByHref: Record<string, number>;
}) {
  /** Links shown per group before "expand" — higher so most dashboards need no second click. */
  const PREVIEW_LIMIT_PER_SECTION = 12;
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [showFullListPerGroup, setShowFullListPerGroup] = useState(false);

  const groups = useMemo(() => ["ALL", ...sections.map((section) => section.title)], [sections]);
  const searchLower = search.trim().toLowerCase();

  const filteredSections = useMemo(() => {
    return sections
      .filter((section) => groupFilter === "ALL" || section.title === groupFilter)
      .map((section) => ({
        ...section,
        modules: section.modules.filter((module) => {
          if (!searchLower) return true;
          return (
            module.label.toLowerCase().includes(searchLower) ||
            module.description.toLowerCase().includes(searchLower) ||
            module.href.toLowerCase().includes(searchLower)
          );
        }),
      }))
      .filter((section) => section.modules.length > 0);
  }, [groupFilter, searchLower, sections]);

  const hasSearch = searchLower.length > 0;
  const visibleSections = useMemo(() => {
    if (hasSearch || showFullListPerGroup) return filteredSections;

    return filteredSections.map((section) => ({
      ...section,
      modules: section.modules.slice(0, PREVIEW_LIMIT_PER_SECTION),
    }));
  }, [PREVIEW_LIMIT_PER_SECTION, filteredSections, hasSearch, showFullListPerGroup]);

  const hiddenToolsCount = useMemo(() => {
    if (hasSearch || showFullListPerGroup) return 0;
    return filteredSections.reduce((sum, section) => {
      const hiddenForSection = Math.max(0, section.modules.length - PREVIEW_LIMIT_PER_SECTION);
      return sum + hiddenForSection;
    }, 0);
  }, [PREVIEW_LIMIT_PER_SECTION, filteredSections, hasSearch, showFullListPerGroup]);

  const totalMatches = filteredSections.reduce((sum, section) => sum + section.modules.length, 0);
  const totalToolsInSections = useMemo(
    () => sections.reduce((sum, section) => sum + section.modules.length, 0),
    [sections],
  );
  const isQuickLinksLayout = totalToolsInSections > 0 && totalToolsInSections < 15;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!searchLower) return;
      trackDashboardEvent("dashboard_search", {
        query: searchLower,
        groupFilter,
        resultCount: totalMatches,
      });
    }, 450);

    return () => window.clearTimeout(timeoutId);
  }, [groupFilter, searchLower, totalMatches]);

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h3 className="dashboard-section-kicker" style={{ marginTop: 0, marginBottom: 6 }}>
            {isQuickLinksLayout ? "Quick links" : "All feature areas"}
          </h3>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "var(--ypp-purple-800)" }}>
            {isQuickLinksLayout
              ? "Jump to the routes you use most."
              : "Browse grouped tools, or filter to a single area."}
          </p>
        </div>
        <span className="pill pill-purple">{isQuickLinksLayout ? `${totalMatches} links` : `${totalMatches} tools`}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 2fr) minmax(180px, 1fr)", gap: 10, marginTop: 12 }}>
        <input
          className="input"
          placeholder="Search tools by name, purpose, or route..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select className="input" value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)}>
          {groups.map((group) => (
            <option key={group} value={group}>
              {group === "ALL" ? "All groups" : group}
            </option>
          ))}
        </select>
      </div>

      {!isQuickLinksLayout && sections.length > 0 ? (
        <div className="dashboard-feature-areas-grid" style={{ marginTop: 16 }}>
          {sections.map((section) => {
            const lead = section.modules[0];
            const active = groupFilter === section.title;
            return (
              <button
                key={section.id}
                type="button"
                className={`dashboard-feature-area-card${active ? " is-active" : ""}`}
                onClick={() =>
                  setGroupFilter((previous) => (previous === section.title ? "ALL" : section.title))
                }
              >
                <span className="dashboard-feature-icon" aria-hidden>
                  {lead?.icon ?? "✦"}
                </span>
                <p className="dashboard-feature-title">{section.title}</p>
                <p className="dashboard-feature-desc">
                  {lead?.description ?? "Open tools in this area of the portal."}
                </p>
                <div className="dashboard-feature-foot">
                  <span className="pill pill-success pill-small">{section.modules.length} tools</span>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {filteredSections.length === 0 ? (
        <p style={{ marginTop: 12, color: "var(--muted)" }}>No tools match this filter.</p>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          {!hasSearch && hiddenToolsCount > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                Preview: up to {PREVIEW_LIMIT_PER_SECTION} links per group. Expand to see the rest.
              </p>
              <button
                type="button"
                className="link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => setShowFullListPerGroup((previous) => !previous)}
                aria-expanded={showFullListPerGroup}
              >
                {showFullListPerGroup
                  ? "Back to preview"
                  : `Show full list (${hiddenToolsCount} more)`}
              </button>
            </div>
          ) : null}

          {visibleSections.map((section) => (
            <div key={section.id}>
              <h4 style={{ margin: "0 0 8px" }}>{section.title}</h4>
              <div className="dashboard-tools-grid">
                {section.modules.map((module) => {
                  const badgeCount = moduleBadgeByHref[module.href] ??
                    (module.badgeKey ? moduleBadgeByHref[module.badgeKey] : undefined);

                  return (
                    <div key={module.href} className="dashboard-tool-module-card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--gray-900)" }}>
                            <span style={{ marginRight: 8 }}>{module.icon}</span>
                            {module.label}
                          </p>
                          <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--muted)", lineHeight: 1.45 }}>
                            {module.description}
                          </p>
                        </div>
                        {badgeCount && badgeCount > 0 ? (
                          <span className="pill pill-pending pill-small">{badgeCount}</span>
                        ) : null}
                      </div>

                      <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                        <Link
                          href={module.href}
                          className="link"
                          onClick={() =>
                            trackDashboardEvent("dashboard_card_open", {
                              href: module.href,
                              label: module.label,
                              group: section.title,
                              badgeCount: badgeCount ?? 0,
                            })
                          }
                        >
                          Open →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
