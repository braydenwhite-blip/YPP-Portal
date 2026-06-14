import Link from "next/link";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { getSession } from "@/lib/auth-supabase";
import {
  getInstructorOpsMetrics,
  getInstructorOpsRecentActivity,
  getInstructorOpsRecords,
  formatInstructorOpsDateTime,
  type InstructorOpsRecord,
} from "@/lib/instructor-ops";
import InstructorOpsKanban from "../instructor-ops-kanban";

export const dynamic = "force-dynamic";

const getCachedInstructorOpsRecords = unstable_cache(
  async () => getInstructorOpsRecords(),
  ["admin-instructor-ops-records"],
  { revalidate: 60 }
);

export default async function AdminInstructorsHubPage() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!roles.includes("ADMIN")) {
    redirect("/");
  }

  const records = await getCachedInstructorOpsRecords();
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
          <Link href="/admin/instructors" className="button secondary">
            Database
          </Link>
          <Link href="/admin/instructors/lifecycle" className="button secondary">
            Lifecycle board
          </Link>
          <Link href="/admin/mentorship?tab=assignments" className="button secondary">
            Mentor matching
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
          href="/admin/instructors"
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

      <InstructorOpsKanban records={records} />
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
    <Link href={href} className={`card instructor-ops-metric instructor-ops-metric-${tone}`}>
      <div className="instructor-ops-metric-label">{label}</div>
      <div className="instructor-ops-metric-value">{value}</div>
      <div className="instructor-ops-metric-detail">{detail}</div>
    </Link>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="instructor-ops-empty">{text}</p>;
}

// Re-export so V1's existing imports from this file keep working.
export type { InstructorOpsRecord };
