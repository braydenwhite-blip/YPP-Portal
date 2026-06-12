import { redirect } from "next/navigation";
import Link from "next/link";

import ActionCenterSubNav from "@/components/leadership-action-center/sub-nav";
import ActionCenterSectionHeader from "@/components/leadership-action-center/section-header";
import TaskSummaryRow from "@/components/leadership-action-center/task-row";
import { CategoryBadge } from "@/components/leadership-action-center/badges";
import { CATEGORY_STYLES, MEETING_KIND_LABELS } from "@/lib/leadership-action-center/constants";
import {
  formatMonthDay,
  formatWeekday,
  formatMonthDayYear,
} from "@/lib/leadership-action-center/dates";
import { getDashboardSnapshot } from "@/lib/leadership-action-center/queries";
import { getLeadershipSession } from "@/lib/leadership-action-center/authorization";
import type { LeadershipActionCategory } from "@prisma/client";
import { LegacySurfaceBanner } from "@/components/ui-v2";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leadership Action Center" };

const KPI_LABELS: Record<string, string> = {
  dueToday: "Due today",
  dueThisWeek: "Due this week",
  overdue: "Overdue",
  blocked: "Blocked",
  needsOfficerDiscussion: "Needs officer discussion",
  completedThisWeek: "Completed this week",
};

const KPI_ACCENTS: Record<string, string> = {
  dueToday: "#0ea5e9",
  dueThisWeek: "#6366f1",
  overdue: "#dc2626",
  blocked: "#d97706",
  needsOfficerDiscussion: "#a16207",
  completedThisWeek: "#16a34a",
};

export default async function ActionCenterDashboardPage() {
  const session = await getLeadershipSession();
  if (!session) redirect("/");

  const snapshot = await getDashboardSnapshot();

  const kpis: Array<{ key: string; count: number }> = [
    { key: "dueToday", count: snapshot.dueToday.length },
    { key: "dueThisWeek", count: snapshot.dueThisWeek.length },
    { key: "overdue", count: snapshot.overdue.length },
    { key: "blocked", count: snapshot.blocked.length },
    { key: "needsOfficerDiscussion", count: snapshot.needsOfficerDiscussion.length },
    { key: "completedThisWeek", count: snapshot.completedThisWeek.length },
  ];

  return (
    <div className="page-shell">
      <LegacySurfaceBanner
        title="This is the legacy Leadership Action Center."
        body="New work tracking lives in the Work Hub — this page stays for browsing the old task/meeting records kept in the legacy system."
        ctaLabel="Open Work Hub"
        ctaHref="/work"
      />
      <ActionCenterSectionHeader
        badge="Admin · Leadership"
        title="Leadership Action Center"
        description={`Operating week of ${formatMonthDayYear(snapshot.weekStart)} – ${formatMonthDayYear(snapshot.weekEnd)}. ${snapshot.totalOpen} open task${snapshot.totalOpen === 1 ? "" : "s"} across all categories.`}
        actions={[
          { label: "+ New task", href: "/admin/action-center/tasks?new=1", primary: true },
          { label: "Weekly digest", href: "/admin/action-center/weekly" },
          { label: "Import", href: "/admin/action-center/import" },
          { label: "Download CSV", href: "/api/admin/action-center/export.csv" },
        ]}
      />

      <ActionCenterSubNav />

      {/* KPI strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {kpis.map((kpi) => (
          <div
            key={kpi.key}
            className="card"
            style={{
              padding: 16,
              textAlign: "center",
              borderTop: `3px solid ${KPI_ACCENTS[kpi.key]}`,
            }}
          >
            <div
              style={{
                fontSize: 28,
                fontWeight: 700,
                color: KPI_ACCENTS[kpi.key],
                lineHeight: 1.1,
              }}
            >
              {kpi.count}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 4, fontWeight: 600 }}>
              {KPI_LABELS[kpi.key]}
            </div>
          </div>
        ))}
      </div>

      {/* Two-column grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 20,
          alignItems: "start",
        }}
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DashboardList
            title="Due this week"
            href="/admin/action-center/tasks?bucket=this-week"
            items={snapshot.dueThisWeek}
            emptyHint="No deadlines in this operating week — add tasks or pull them in from the spreadsheet."
          />
          <DashboardList
            title="Overdue"
            tone="danger"
            href="/admin/action-center/tasks?bucket=overdue"
            items={snapshot.overdue}
            emptyHint="Nothing overdue — keep it that way."
          />
          <DashboardList
            title="Blocked / needs input"
            tone="warning"
            href="/admin/action-center/tasks?status=BLOCKED"
            items={snapshot.blocked}
            emptyHint="No blockers reported. If something is stuck, mark it BLOCKED so it shows up here."
          />
          <DashboardList
            title="Completed this week"
            tone="success"
            href="/admin/action-center/tasks?status=COMPLETE"
            items={snapshot.completedThisWeek}
            emptyHint="No completions yet this week."
          />
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <DashboardList
            title="Needs officer discussion"
            href="/admin/action-center/tasks?officer=1"
            items={snapshot.needsOfficerDiscussion}
            emptyHint="No items flagged for officer discussion."
          />

          {/* Upcoming meetings */}
          <div className="card" style={{ padding: 18 }}>
            <SectionTitle
              title="Upcoming meetings"
              actionLabel="All meetings"
              href="/admin/action-center/meetings"
            />
            {snapshot.upcomingMeetings.length === 0 ? (
              <EmptyHint hint="No meetings scheduled. Add one to anchor agenda prep." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {snapshot.upcomingMeetings.map((meeting) => (
                  <Link
                    key={meeting.id}
                    href={`/admin/action-center/meetings?focus=${meeting.id}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{meeting.title}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {MEETING_KIND_LABELS[meeting.kind]} ·{" "}
                        {meeting.scheduledAt
                          ? `${formatWeekday(meeting.scheduledAt)}, ${formatMonthDay(meeting.scheduledAt)}`
                          : "Unscheduled"}
                      </div>
                    </div>
                    <span
                      style={{
                        alignSelf: "center",
                        fontSize: 12,
                        color: "#64748b",
                        background: "#f1f5f9",
                        padding: "2px 8px",
                        borderRadius: 999,
                      }}
                    >
                      {meeting._count.actionItems} task
                      {meeting._count.actionItems === 1 ? "" : "s"}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Category breakdown */}
          <div className="card" style={{ padding: 18 }}>
            <SectionTitle title="Open work by category" />
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
              {(Object.keys(CATEGORY_STYLES) as LeadershipActionCategory[]).map((cat) => {
                const count = snapshot.categoryCounts[cat] ?? 0;
                return (
                  <Link
                    key={cat}
                    href={`/admin/action-center/tasks?category=${cat}`}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "#f8fafc",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <CategoryBadge category={cat} size="small" />
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{count}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  actionLabel,
  href,
}: {
  title: string;
  actionLabel?: string;
  href?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 15, color: "#0f172a", fontWeight: 700 }}>{title}</h3>
      {actionLabel && href && (
        <Link href={href} style={{ fontSize: 12, color: "#6b21c8", textDecoration: "none" }}>
          {actionLabel} →
        </Link>
      )}
    </div>
  );
}

function EmptyHint({ hint }: { hint: string }) {
  return (
    <p style={{ margin: 0, color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>{hint}</p>
  );
}

function DashboardList({
  title,
  items,
  href,
  tone,
  emptyHint,
}: {
  title: string;
  items: import("@/lib/leadership-action-center/queries").ActionItemWithRelations[];
  href: string;
  tone?: "danger" | "warning" | "success";
  emptyHint: string;
}) {
  const accent =
    tone === "danger"
      ? "#dc2626"
      : tone === "warning"
        ? "#d97706"
        : tone === "success"
          ? "#16a34a"
          : "#0f172a";
  return (
    <div className="card" style={{ padding: 18 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: accent, fontWeight: 700 }}>
          {title}{" "}
          <span style={{ color: "#94a3b8", fontWeight: 500 }}>({items.length})</span>
        </h3>
        <Link href={href} style={{ fontSize: 12, color: "#6b21c8", textDecoration: "none" }}>
          View all →
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyHint hint={emptyHint} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.slice(0, 5).map((item) => (
            <TaskSummaryRow key={item.id} item={item} />
          ))}
          {items.length > 5 && (
            <Link
              href={href}
              style={{ fontSize: 12, color: "#6b21c8", textDecoration: "none", textAlign: "right" }}
            >
              + {items.length - 5} more
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
