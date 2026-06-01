import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import {
  listVisibleActionItems,
  type ActionItemWithRelations,
} from "@/lib/people-strategy/action-queries";
import {
  ACTION_STATUS_LABELS,
  ACTION_VISIBILITY_LABELS,
} from "@/lib/people-strategy/constants";
import {
  effectiveDeadline,
  isActionOverdue,
  sortByDeadline,
} from "@/lib/people-strategy/my-actions-selectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · All Actions" };

const OVERDUE_ACCENT = "#dc2626";

/** Small rounded pill, used for deadline / status / officer-meeting markers. */
function Pill({
  children,
  bg,
  color,
  border,
}: {
  children: React.ReactNode;
  bg?: string;
  color?: string;
  border?: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.4,
        padding: "2px 8px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        background: bg ?? "#f1f5f9",
        color: color ?? "#475569",
        border: border ? `1px solid ${border}` : "1px solid transparent",
      }}
    >
      {children}
    </span>
  );
}

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  NOT_STARTED: { bg: "#f1f5f9", color: "#475569" },
  IN_PROGRESS: { bg: "#eff6ff", color: "#1d4ed8" },
  COMPLETE: { bg: "#ecfdf5", color: "#047857" },
  OVERDUE: { bg: "#fef2f2", color: "#b91c1c" },
};

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
      <p style={{ margin: 0, fontSize: 12, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 }}>
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
  const status = STATUS_STYLES[item.status] ?? STATUS_STYLES.NOT_STARTED;

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
        <Pill
          bg={overdue ? "#fef2f2" : "#f8fafc"}
          color={overdue ? OVERDUE_ACCENT : "#64748b"}
          border={overdue ? "#fecaca" : "#e2e8f0"}
        >
          {overdue ? "Overdue · " : "Due "}
          {formatDueDate(due)}
        </Pill>
      </div>

      {/* Pill row: status, officer-meeting (if any), visibility badge */}
      <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Pill bg={status.bg} color={status.color}>
          {ACTION_STATUS_LABELS[item.status]}
        </Pill>
        {item.officerMeetingId ? (
          <Pill bg="#f5f3ff" color="#6d28d9" border="#ddd6fe">
            📅 Officer meeting
          </Pill>
        ) : null}
        <span
          className="badge"
          style={{
            fontSize: 11,
            background: item.visibility === "OFFICERS_ONLY" ? "#fffbeb" : "#f1f5f9",
            color: item.visibility === "OFFICERS_ONLY" ? "#b45309" : "#475569",
          }}
        >
          {ACTION_VISIBILITY_LABELS[item.visibility]}
        </span>
      </div>

      {/* Roles line + comment count */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          marginTop: 8,
          fontSize: 12,
          color: "#94a3b8",
          flexWrap: "wrap",
        }}
      >
        <span>
          Lead: {leadName}
          {executors.length > 0 ? ` · Executing: ${executors.length}` : ""}
          {inputs.length > 0 ? ` · Input: ${inputs.length}` : ""}
        </span>
        <span style={{ whiteSpace: "nowrap" }}>
          💬 {item.comments.length} {item.comments.length === 1 ? "comment" : "comments"}
        </span>
      </div>
    </Link>
  );
}

/** Tabs across the top of the Action Tracker. Routes not yet built render as
 * disabled placeholders so the layout is complete without dead links. */
function Tabs() {
  const tabs: Array<{ label: string; href?: string; active?: boolean }> = [
    { label: "All Actions", active: true },
    { label: "My Actions", href: "/my-actions" },
    { label: "Needs My Input" },
    { label: "Officer Meetings" },
    { label: "People" },
  ];

  return (
    <div
      role="tablist"
      aria-label="Action tracker views"
      style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}
    >
      {tabs.map((tab) => {
        if (tab.active) {
          return (
            <span key={tab.label} className="button small" aria-current="page">
              {tab.label}
            </span>
          );
        }
        if (tab.href) {
          return (
            <Link key={tab.label} href={tab.href} className="button outline small">
              {tab.label}
            </Link>
          );
        }
        return (
          <span
            key={tab.label}
            className="button outline small"
            aria-disabled="true"
            title="Coming soon"
            style={{ opacity: 0.5, pointerEvents: "none", cursor: "default" }}
          >
            {tab.label}
          </span>
        );
      })}
    </div>
  );
}

/** Filter row — placeholders only (wired up in a later phase). */
function FilterRow() {
  const placeholderStyle: React.CSSProperties = {
    fontSize: 13,
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
  };
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
      <select disabled aria-label="Filter by department" style={placeholderStyle}>
        <option>All departments</option>
      </select>
      <select disabled aria-label="Filter by status" style={placeholderStyle}>
        <option>All statuses</option>
      </select>
      <select disabled aria-label="Filter by visibility" style={placeholderStyle}>
        <option>All visibility</option>
      </select>
      <input disabled placeholder="Search actions…" aria-label="Search actions" style={placeholderStyle} />
    </div>
  );
}

export default async function AllActionsPage() {
  // Outer gate: with ENABLE_ACTION_TRACKER off the route does not exist.
  if (!isActionTrackerEnabled()) notFound();

  // Officer-tier and above only. requireOfficer() throws "Unauthorized" for
  // members / instructors below officer (and for unauthenticated requests,
  // which the proxy already redirects before reaching here) — deny with a 404
  // so the route's existence is not leaked.
  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const items = await listVisibleActionItems(viewer);
  const now = new Date();

  // Simple summary counts (no heavier analytics in this phase).
  const summary = {
    total: items.length,
    overdue: items.filter((i) => isActionOverdue(i, now)).length,
    inProgress: items.filter((i) => i.status === "IN_PROGRESS").length,
    officersOnly: items.filter((i) => i.visibility === "OFFICERS_ONLY").length,
    flagged: items.filter((i) => i.flaggedAt != null).length,
  };

  // Group by department name, departments sorted alphabetically, items within a
  // group sorted by (overdue-aware) deadline.
  const groups = new Map<string, ActionItemWithRelations[]>();
  for (const item of items) {
    const key = item.department?.name ?? "Unassigned";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  const groupedDepartments = Array.from(groups.entries())
    .map(([name, deptItems]) => ({ name, items: sortByDeadline(deptItems) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      {/* Header */}
      <div
        className="topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <p className="badge">Admin · People Strategy</p>
          <h1 className="page-title" style={{ marginTop: 8 }}>
            Action Tracker
          </h1>
          <p className="page-subtitle">
            Every leadership action item, grouped by department — leads, executors, and input owners at a glance.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {/* CSV export is a later phase — placeholder, not wired up. */}
          <span
            className="button outline small"
            aria-disabled="true"
            title="Coming soon"
            style={{ opacity: 0.5, pointerEvents: "none", cursor: "default" }}
          >
            Export CSV
          </span>
          <Link href="/admin/actions/new" className="button small">
            + New Action
          </Link>
        </div>
      </div>

      <Tabs />
      <FilterRow />

      {/* Summary strip */}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <StatCard label="Total" value={String(summary.total)} />
        <StatCard label="Overdue" value={String(summary.overdue)} accent={summary.overdue > 0} />
        <StatCard label="In Progress" value={String(summary.inProgress)} />
        <StatCard label="Officers Only" value={String(summary.officersOnly)} />
        <StatCard label="Flagged" value={String(summary.flagged)} />
      </div>

      {/* Grouped list by department */}
      {items.length === 0 ? (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <p style={{ margin: 0 }}>
            No action items are visible yet. Create the first one with <strong>+ New Action</strong>.
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
                <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: "#0f172a" }}>
                  {group.name}
                </h2>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
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
