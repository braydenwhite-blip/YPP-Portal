import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import {
  listActionDepartments,
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import { ACTION_VISIBILITY_LABELS } from "@/lib/people-strategy/constants";
import {
  effectiveDeadline,
  isActionOverdue,
} from "@/lib/people-strategy/my-actions-selectors";
import { isCpoOrBoard } from "@/lib/people-strategy/action-permissions";
import {
  applyActionFilters,
  buildActionFilterQuery,
  hasActiveFilters,
  parseActionFilters,
} from "@/lib/people-strategy/action-filters";
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
import { ActionTrackerTabs } from "@/components/people-strategy/action-tracker-tabs";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { Pill, PriorityPill, StatusPill } from "@/components/people-strategy/pills";
import { SavedViewsBar } from "@/components/people-strategy/saved-views-bar";

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

function ActionRow({ item, now }: { item: ActionItemWithRelations; now: Date }) {
  const overdue = isActionOverdue(item, now);
  const due = effectiveDeadline(item);

  const executors = item.assignments.filter((a) => a.role === "EXECUTING");
  const inputs = item.assignments.filter((a) => a.role === "INPUT");
  const leadName = item.lead?.name ?? item.lead?.email ?? "Unassigned";

  return (
    <Link
      href={`/actions/${item.id}`}
      className="card"
      style={{
        display: "block",
        padding: "12px 14px",
        textDecoration: "none",
        color: "inherit",
        borderLeft: overdue ? `3px solid ${OVERDUE_ACCENT}` : "3px solid transparent",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14 }}>{item.title}</strong>
        <Pill tone={overdue ? "overdue" : "neutral"}>
          {overdue ? "Overdue · " : "Due "}
          {formatDueDate(due)}
        </Pill>
      </div>

      {/* Pill row: status, officer-meeting (if any), visibility badge */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <StatusPill status={item.status} />
        <PriorityPill priority={item.priority} hideLow />
        {item.officerMeetingId ? <Pill tone="purple">Officer meeting</Pill> : null}
        <Pill tone={item.visibility === "OFFICERS_ONLY" ? "warning" : "neutral"}>
          {ACTION_VISIBILITY_LABELS[item.visibility]}
        </Pill>
      </div>

      {/* Roles line + comment count */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 8,
          fontSize: 12,
          color: "#64748b",
          flexWrap: "wrap",
        }}
      >
        <span>
          Lead: {leadName}
          {executors.length > 0 ? ` · Executing: ${executors.length}` : ""}
          {inputs.length > 0 ? ` · Input: ${inputs.length}` : ""}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          {item.comments.length} {item.comments.length === 1 ? "comment" : "comments"}
        </span>
      </div>
    </Link>
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

  // Grouped list by department; items keep the deadline sort within each group.
  const groups = new Map<string, ActionItemWithRelations[]>();
  for (const item of items) {
    const key = item.department?.name ?? "Unassigned";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  const groupedDepartments = Array.from(groups.entries())
    .map(([name, deptItems]) => ({ name, items: deptItems }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const filtersActive = hasActiveFilters(filters);
  const showPeopleDashboardTab = isPeopleDashboardEnabled() && isCpoOrBoard(viewer);
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

      {/* Summary strip — reflects the current filters */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
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
          {groupedDepartments.map((group) => (
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
                  {group.name}
                </h2>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  {group.items.length} {group.items.length === 1 ? "action" : "actions"}
                </span>
              </div>
              {group.items.map((item) => (
                <ActionRow key={item.id} item={item} now={now} />
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
