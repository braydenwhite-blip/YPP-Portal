import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import {
  listActionDepartments,
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import {
  applyActionFilters,
  buildActionFilterQuery,
  groupActionsByLinkedEntity,
  hasActiveFilters,
  linkedGroupHeading,
  parseActionFilters,
} from "@/lib/people-strategy/action-filters";
import {
  loadRelatedEntityLabels,
  type RelatedEntitySummary,
} from "@/lib/people-strategy/connections";
import {
  summarizeDepartments,
  summarizeStatuses,
} from "@/lib/people-strategy/action-analytics";
import { ActionFiltersBar } from "@/components/people-strategy/action-filters-bar";
import {
  ActionStatusDonut,
  DepartmentBars,
} from "@/components/people-strategy/action-analytics-cards";
import { listSavedActionViews } from "@/lib/people-strategy/saved-views";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import { ActionCard } from "@/components/people-strategy/action-card";
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { SavedViewsBar } from "@/components/people-strategy/saved-views-bar";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · All Actions" };

const OVERDUE_ACCENT = "var(--error-color)";

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "14px 16px",
        flex: "1 1 150px",
        minWidth: 140,
        borderLeft: accent ? `3px solid ${OVERDUE_ACCENT}` : undefined,
      }}
    >
      <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </p>
      <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700, color: accent ? OVERDUE_ACCENT : "inherit" }}>
        {value}
      </p>
    </div>
  );
}

export default async function AllActionsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Outer gate: with ENABLE_ACTION_TRACKER off the route does not exist.
  if (!isActionTrackerEnabled()) notFound();

  // Officer-tier and above only. requireOfficer() throws "Unauthorized" for
  // members / instructors below officer (and for unauthenticated requests,
  // which the proxy already redirects before reaching here) — deny with a 404
  // so the route's existence is not leaked.
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const params = (await searchParams) ?? {};
  const filters = parseActionFilters(params);
  const now = new Date();

  const [visible, departments, savedViews] = await Promise.all([
    listVisibleActionItems(viewer),
    listActionDepartments(),
    listSavedActionViews(viewer.id),
  ]);

  // ONE filtered set drives everything below: the summary strip, the charts,
  // the department bars, the grouped list, and the CSV export link.
  const items = applyActionFilters(visible, filters, now);

  const statusBreakdown = summarizeStatuses(items, now);
  const departmentBars = summarizeDepartments(items, now);
  const flaggedCount = items.filter((i) => i.flaggedAt != null).length;
  const officersOnlyCount = items.filter((i) => i.visibility === "OFFICERS_ONLY").length;

  const exportQuery = buildActionFilterQuery(filters);
  const exportHref = exportQuery
    ? `/api/admin/actions/export.csv?${exportQuery}`
    : "/api/admin/actions/export.csv";

  // Group-by toggle: department (default) or linked entity. Items keep the
  // deadline sort within each group.
  const groupParam = Array.isArray(params.group) ? params.group[0] : params.group;
  const groupBy: "department" | "linked" = groupParam === "linked" ? "linked" : "department";

  type DisplayGroup = {
    name: string;
    href: string | null;
    items: ActionItemWithRelations[];
  };
  let displayGroups: DisplayGroup[];

  if (groupBy === "linked") {
    // Group by each linked entity and title the group with that entity's own
    // name ("Algebra 101 · Class") via one batched label lookup, not per type.
    const linkedGroups = groupActionsByLinkedEntity(items);
    const refs = linkedGroups
      .filter((g) => g.relatedType && g.relatedId)
      .map((g) => ({ type: g.relatedType!, id: g.relatedId! }));
    const labels = await loadRelatedEntityLabels(refs).catch(
      () => new Map<string, RelatedEntitySummary>()
    );
    displayGroups = linkedGroups
      .map((g) => ({
        name: linkedGroupHeading(g, labels),
        href: labels.get(g.key)?.href ?? null,
        items: g.items,
      }))
      .sort((a, b) => {
        if (a.name === "Not linked") return 1;
        if (b.name === "Not linked") return -1;
        return a.name.localeCompare(b.name);
      });
  } else {
    const groups = new Map<string, ActionItemWithRelations[]>();
    for (const item of items) {
      const key = item.department?.name ?? "Unassigned";
      const bucket = groups.get(key);
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }
    // Keep the "Unassigned" catch-all bucket last.
    displayGroups = Array.from(groups.entries())
      .map(([name, groupItems]) => ({ name, href: null, items: groupItems }))
      .sort((a, b) => {
        if (a.name === "Unassigned") return 1;
        if (b.name === "Unassigned") return -1;
        return a.name.localeCompare(b.name);
      });
  }

  // Group-toggle links preserve the active filters.
  const groupToggleHref = (g: "department" | "linked") => {
    const p = new URLSearchParams(buildActionFilterQuery(filters));
    if (g === "linked") p.set("group", "linked");
    else p.delete("group");
    const qs = p.toString();
    return qs ? `/actions/all?${qs}` : "/actions/all";
  };

  const filtersActive = hasActiveFilters(filters);
  const showPeopleDashboardTab = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);
  const lastUpdated = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(now);

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <ActionCommandBar
        eyebrow="Admin · People Strategy"
        title="Action Tracker"
        subtitle="Every leadership action item, grouped by department — leads, executors, and input owners at a glance."
        meta={`${items.length} ${items.length === 1 ? "action" : "actions"} in view · updated ${lastUpdated}`}
        actions={
          <>
            <a href={exportHref} className="button outline small">
              Export CSV
            </a>
            <Link href="/actions/new" className="button small">
              + New Action
            </Link>
          </>
        }
      />

      <ActionTrackerTabs active="all" showPeople={showPeopleDashboardTab} />

      <ActionFiltersBar
        departments={departments}
        filters={filters}
        hasActive={filtersActive}
      />

      <SavedViewsBar
        views={savedViews}
        currentQuery={exportQuery}
        hasActiveFilters={filtersActive}
      />

      {/* Overview — collapsed by default so the list is reachable fast (#-3). */}
      <div style={{ marginTop: 16 }}>
        <CollapsibleSection
          title="Overview"
          summary={`${statusBreakdown.total} in view · ${statusBreakdown.counts.OVERDUE} overdue · ${flaggedCount} flagged`}
          defaultOpen={false}
        >
          {/* Summary strip — reflects the current filters */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <StatCard label="Total" value={String(statusBreakdown.total)} />
            <StatCard
              label="Overdue"
              value={String(statusBreakdown.counts.OVERDUE)}
              accent={statusBreakdown.counts.OVERDUE > 0}
            />
            <StatCard label="In Progress" value={String(statusBreakdown.counts.IN_PROGRESS)} />
            <StatCard label="Officers Only" value={String(officersOnlyCount)} />
            <StatCard label="Flagged" value={String(flaggedCount)} />
          </div>

          {/* Analytics: status donut + department mini-bars */}
          <div style={{ display: "flex", gap: 16, marginTop: 16, flexWrap: "wrap" }}>
            <ActionStatusDonut breakdown={statusBreakdown} />
            <DepartmentBars bars={departmentBars} />
          </div>
        </CollapsibleSection>
      </div>

      {/* Grouped list by department */}
      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <p style={{ margin: 0 }}>
            {filtersActive
              ? "No action items match the current filters."
              : "No action items are visible yet. Create the first one with + New Action."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <span style={{ color: "var(--muted)" }}>Group by:</span>
            <Link
              href={groupToggleHref("department")}
              className={`button outline small${groupBy === "department" ? " primary" : ""}`}
            >
              Department
            </Link>
            <Link
              href={groupToggleHref("linked")}
              className={`button outline small${groupBy === "linked" ? " primary" : ""}`}
            >
              Linked item
            </Link>
          </div>
          {displayGroups.map((group) => (
            <section key={group.name} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                }}
              >
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "var(--ypp-ink)" }}>
                  {group.href ? (
                    <Link href={group.href} style={{ color: "inherit" }}>
                      {group.name}
                    </Link>
                  ) : (
                    group.name
                  )}
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {group.items.length} {group.items.length === 1 ? "action" : "actions"}
                </span>
              </div>
              {group.items.map((item) => (
                <ActionCard key={item.id} item={item} now={now} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
