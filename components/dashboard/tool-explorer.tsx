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
  const DEFAULT_TOOLS_PER_SECTION = 4;
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [showAllTools, setShowAllTools] = useState(false);

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
    if (hasSearch || showAllTools) return filteredSections;

    return filteredSections.map((section) => ({
      ...section,
      modules: section.modules.slice(0, DEFAULT_TOOLS_PER_SECTION),
    }));
  }, [DEFAULT_TOOLS_PER_SECTION, filteredSections, hasSearch, showAllTools]);

  const hiddenToolsCount = useMemo(() => {
    if (hasSearch || showAllTools) return 0;
    return filteredSections.reduce((sum, section) => {
      const hiddenForSection = Math.max(0, section.modules.length - DEFAULT_TOOLS_PER_SECTION);
      return sum + hiddenForSection;
    }, 0);
  }, [DEFAULT_TOOLS_PER_SECTION, filteredSections, hasSearch, showAllTools]);

  const totalMatches = filteredSections.reduce((sum, section) => sum + section.modules.length, 0);

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
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>All Tools Explorer</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
            Start with the top tools, then expand to browse everything.
          </p>
        </div>
        <span className="pill">{totalMatches} tools</span>
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

      {filteredSections.length === 0 ? (
        <p style={{ marginTop: 12, color: "var(--muted)" }}>No tools match this filter.</p>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
          {!hasSearch && hiddenToolsCount > 0 ? (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
                Showing top tools first for faster scanning.
              </p>
              <button
                type="button"
                className="link"
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => setShowAllTools((previous) => !previous)}
                aria-expanded={showAllTools}
              >
                {showAllTools ? "Show top tools only" : `Show all tools (${hiddenToolsCount} hidden)`}
              </button>
            </div>
          ) : null}

          {visibleSections.map((section) => (
            <div key={section.id}>
              <h4 style={{ margin: "0 0 8px" }}>{section.title}</h4>
              <div className="grid two">
                {section.modules.map((module) => {
                  const badgeCount = moduleBadgeByHref[module.href] ??
                    (module.badgeKey ? moduleBadgeByHref[module.badgeKey] : undefined);

                  return (
                    <div
                      key={module.href}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 10,
                        padding: 12,
                        background: "var(--surface-alt)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 600 }}>
                            <span style={{ marginRight: 6 }}>{module.icon}</span>
                            {module.label}
                          </p>
                          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
                            {module.description}
                          </p>
                        </div>
                        {badgeCount && badgeCount > 0 ? <span className="pill">{badgeCount}</span> : null}
                      </div>

                      <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <code style={{ fontSize: 11, color: "var(--muted)" }}>{module.href}</code>
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
                          Open
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
