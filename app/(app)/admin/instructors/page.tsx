import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-supabase";
import {
  getInstructorOpsMetrics,
  getInstructorOpsRecentActivity,
  getInstructorOpsRecords,
  formatInstructorOpsDateTime,
  type InstructorOpsRecord,
} from "@/lib/instructor-ops";
import InstructorOpsKanban from "./instructor-ops-kanban";

export const dynamic = "force-dynamic";

export default async function AdminInstructorsPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const records = await getInstructorOpsRecords();
  const metrics = getInstructorOpsMetrics(records);
  const recentActivity = getInstructorOpsRecentActivity(records, 8);
  const attentionRecords = records
    .filter((record) => record.needsAttention)
    .toSorted((a, b) => {
      const aCritical = a.attentionFlags.some((flag) => flag.tone === "critical") ? 1 : 0;
      const bCritical = b.attentionFlags.some((flag) => flag.tone === "critical") ? 1 : 0;
      if (aCritical !== bCritical) return bCritical - aCritical;
      return new Date(b.latestActivityAt).getTime() - new Date(a.latestActivityAt).getTime();
    })
    .slice(0, 6);

  return (
    <div className="instructor-ops-page">
      <div className="topbar">
        <div>
          <p className="badge">Admin | Instructor Operations</p>
          <h1 className="page-title">Instructor Operations Hub</h1>
          <p className="page-subtitle">
            One visual pipeline for applicants, onboarding, readiness, assignments,
            mentorship, and people who need attention.
          </p>
        </div>
        <div className="instructor-ops-header-actions">
          <Link href="/admin/instructors/directory" className="button secondary">
            Directory
          </Link>
          <Link href="/admin/instructors/attention" className="button">
            Attention inbox
          </Link>
        </div>
      </div>

      <div className="grid four instructor-ops-metrics">
        <MetricCard
          label="Needs attention"
          value={metrics.attention}
          detail={`${metrics.overloaded} overloaded`}
          href="/admin/instructors/attention"
          tone="danger"
        />
        <MetricCard
          label="Onboarding"
          value={metrics.onboarding}
          detail={`${metrics.interview} in interview`}
          href="/admin/instructor-readiness"
          tone="warning"
        />
        <MetricCard
          label="Ready"
          value={metrics.ready}
          detail={`${metrics.unassignedReady} unassigned`}
          href="/admin/instructors/directory?load=available"
          tone="success"
        />
        <MetricCard
          label="Active assignments"
          value={metrics.activeAssignments}
          detail={`${metrics.active} active instructors`}
          href="/admin/classes"
          tone="info"
        />
      </div>

      <div className="instructor-ops-summary-grid">
        <section className="card instructor-ops-attention-summary">
          <div className="instructor-ops-section-heading">
            <div>
              <h2>Attention Summary</h2>
              <p>Highest-priority people and blockers surfaced from existing records.</p>
            </div>
            <Link href="/admin/instructors/attention" className="button small secondary">
              Open inbox
            </Link>
          </div>

          {attentionRecords.length === 0 ? (
            <EmptyLine text="No attention flags right now." />
          ) : (
            <div className="instructor-ops-list">
              {attentionRecords.map((record) => (
                <Link key={record.id} href={record.profileHref} className="instructor-ops-list-row">
                  <span className="instructor-ops-list-name">{record.name}</span>
                  <span className="instructor-ops-list-detail">
                    {record.attentionFlags[0]?.title ?? "Needs review"}
                  </span>
                  <span className={`pill pill-small ${record.stage === "NEEDS_ATTENTION" ? "pill-attention" : "pill-purple"}`}>
                    {record.attentionFlags.length}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="card instructor-ops-recent">
          <div className="instructor-ops-section-heading">
            <div>
              <h2>Recent Activity</h2>
              <p>Latest application, class, growth, and profile movement.</p>
            </div>
          </div>

          {recentActivity.length === 0 ? (
            <EmptyLine text="No recent instructor activity." />
          ) : (
            <div className="instructor-ops-list">
              {recentActivity.map((activity) => (
                <Link key={activity.id} href={activity.href} className="instructor-ops-list-row">
                  <span className="instructor-ops-list-name">{activity.instructorName}</span>
                  <span className="instructor-ops-list-detail">{activity.label}</span>
                  <span className="instructor-ops-list-date">
                    {formatInstructorOpsDateTime(activity.occurredAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card instructor-ops-board-card">
        <div className="instructor-ops-section-heading">
          <div>
            <h2>Pipeline Board</h2>
            <p>
              Computed from existing application, readiness, assignment, mentorship,
              certification, and growth records. V1 uses quick actions instead of
              persisted drag moves.
            </p>
          </div>
          <div className="instructor-ops-stage-strip">
            <span>{metrics.applicants} applicants</span>
            <span>{metrics.ready} ready</span>
            <span>{metrics.leadership} leadership</span>
          </div>
        </div>
        <InstructorOpsKanban records={records} />
      </section>

      <section className="card instructor-ops-assignment-board">
        <div className="instructor-ops-section-heading">
          <div>
            <h2>Assignment Load Board</h2>
            <p>
              A lightweight assignment pipeline for availability, overload, mentor
              readiness, and underutilization.
            </p>
          </div>
          <Link href="/admin/classes" className="button small secondary">
            Class operations
          </Link>
        </div>
        <AssignmentLoadBoard records={records} />
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  href,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  href: string;
  tone: "danger" | "warning" | "success" | "info";
}) {
  return (
    <Link href={href} className={`card instructor-ops-metric is-${tone}`}>
      <span className="kpi">{value}</span>
      <span className="kpi-label">{label}</span>
      <span>{detail}</span>
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <p style={{ margin: 0, color: "var(--muted)", fontSize: 14 }}>
      {text}
    </p>
  );
}

function AssignmentLoadBoard({ records }: { records: InstructorOpsRecord[] }) {
  const lanes = [
    {
      key: "available",
      title: "Available",
      records: records.filter(
        (record) => record.currentLoadLabel === "Available" && record.activeAssignmentCount === 0
      ),
    },
    {
      key: "active",
      title: "Active Workshops",
      records: records.filter(
        (record) => record.activeAssignmentCount > 0 && record.workshopEligible
      ),
    },
    {
      key: "mentor-ready",
      title: "Mentor Ready",
      records: records.filter(
        (record) => record.mentorEligible && record.currentLoadLabel !== "Overloaded"
      ),
    },
    {
      key: "underutilized",
      title: "Underutilized",
      records: records.filter(
        (record) =>
          record.isInstructor &&
          record.readinessComplete &&
          record.activeAssignmentCount === 0 &&
          record.assignmentCount <= 1
      ),
    },
    {
      key: "overloaded",
      title: "Overloaded",
      records: records.filter((record) => record.currentLoadLabel === "Overloaded"),
    },
  ];

  return (
    <div className="instructor-ops-load-lanes">
      {lanes.map((lane) => (
        <div key={lane.key} className="instructor-ops-load-lane">
          <div className="instructor-ops-load-lane-header">
            <strong>{lane.title}</strong>
            <span>{lane.records.length}</span>
          </div>
          <div className="instructor-ops-load-stack">
            {lane.records.slice(0, 8).map((record) => (
              <Link key={record.id} href={record.profileHref} className="instructor-ops-load-card">
                <span>{record.name}</span>
                <small>
                  {record.activeAssignmentCount} active / {record.assignmentCount} total
                </small>
              </Link>
            ))}
            {lane.records.length === 0 && (
              <p>No instructors in this lane.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
