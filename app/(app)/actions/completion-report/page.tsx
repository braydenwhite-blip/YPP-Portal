import Link from "next/link";
import { notFound } from "next/navigation";

import { requireOfficer } from "@/lib/authorization";
import {
  isActionTrackerEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import { listVisibleActionItems } from "@/lib/people-strategy/action-queries";
import {
  summarizeCompletion,
  summarizeDepartments,
  summarizeStatuses,
} from "@/lib/people-strategy/action-analytics";
import { buildWinLog } from "@/lib/people-strategy/command-center-selectors";
import { isLeadershipOrBoard } from "@/lib/people-strategy/action-permissions";
import { ActionTrackerTabsV2 } from "@/components/people-strategy/action-tracker-tabs-v2";
import { ActionCommandBar } from "@/components/people-strategy/action-command-bar";
import { StatCard } from "@/components/people-strategy/stat-card";
import {
  ActionStatusDonut,
  DepartmentBars,
} from "@/components/people-strategy/action-analytics-cards";

export const dynamic = "force-dynamic";
export const metadata = { title: "Action Tracker · Completion Report" };

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Phase 8 — Action Completion Report. A read-only accountability view over the
 * SAME visibility-filtered items the tracker shows, reusing the shared
 * aggregates (completion/status/department) and the win log. No new schema.
 */
export default async function ActionCompletionReportPage() {
  if (!isActionTrackerEnabled()) notFound();

  const viewer = await requireOfficer().catch(() => null);
  if (!viewer) notFound();

  const now = new Date();
  const items = await listVisibleActionItems(viewer);

  const completion = summarizeCompletion(items, now);
  const statusBreakdown = summarizeStatuses(items, now);
  const departmentBars = summarizeDepartments(items, now);
  const wins = buildWinLog(items, now);

  const showPeople = isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer);
  const generated = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(now);

  return (
    <div className="page-shell" style={{ maxWidth: 1040 }}>
      <ActionCommandBar
        eyebrow="People Strategy · Reports"
        title="Action Completion Report"
        subtitle="How execution is landing — completion rate, what's overdue, and what shipped this week."
        meta={`${completion.total} ${completion.total === 1 ? "action" : "actions"} in view · generated ${generated}`}
        actions={
          <a href="/api/admin/actions/export.csv" className="button outline small">
            Export CSV
          </a>
        }
      />

      <ActionTrackerTabsV2 active="all" showPeople={showPeople} />

      {/* Headline completion metrics */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
        <StatCard label="Completion rate" value={pct(completion.completionRate)} icon="check" tone="success" hint={`${completion.completed} of ${completion.total - completion.dropped} non-dropped`} />
        <StatCard label="Completed" value={completion.completed} icon="check" tone="success" />
        <StatCard label="Open" value={completion.open} icon="layers" tone="accent" href="/actions/all" />
        <StatCard
          label="Overdue"
          value={completion.overdue}
          icon="alert"
          tone={completion.overdue > 0 ? "danger" : "default"}
          href="/actions/all?status=OVERDUE"
          hint={`${pct(completion.overdueRate)} of open`}
        />
        <StatCard
          label="Blocked"
          value={completion.blocked}
          icon="clock"
          tone={completion.blocked > 0 ? "warning" : "default"}
          href="/actions/all?preset=blocked"
        />
      </div>

      {/* Status mix + per-department load */}
      <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap" }}>
        <ActionStatusDonut breakdown={statusBreakdown} />
        <DepartmentBars bars={departmentBars} />
      </div>

      {/* Completed this week */}
      <section style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
          <h2 className="ps-section-title">Completed this week</h2>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            {wins.length} {wins.length === 1 ? "completion" : "completions"}
          </span>
        </div>
        {wins.length === 0 ? (
          <div className="card" style={{ padding: 16, fontSize: 13, color: "var(--muted)" }}>
            No actions have been completed yet this week — they&apos;ll appear here as work ships.
          </div>
        ) : (
          <div className="card" style={{ padding: "8px 0" }}>
            {wins.map((win) => (
              <Link
                key={win.id}
                href={`/actions/${win.id}`}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 12,
                  padding: "8px 14px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>✓ {win.title}</span>
                <span style={{ fontSize: 12, color: "var(--muted)", whiteSpace: "nowrap" }}>
                  {win.ownerName}
                  {win.departmentName ? ` · ${win.departmentName}` : ""} · {win.completedLabel}
                </span>
              </Link>
            ))}
          </div>
        )}
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--muted)" }}>
          Completed during the current operating week · counts reflect what you can see.
        </p>
      </section>
    </div>
  );
}
