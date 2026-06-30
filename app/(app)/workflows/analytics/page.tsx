import { PageHeaderV2 } from "@/components/ui-v2/page-header";
import { CardV2 } from "@/components/ui-v2/card";
import { StatCardV2 } from "@/components/ui-v2/stat-card";
import { SectionHeaderV2 } from "@/components/ui-v2/section-header";
import { EmptyStateV2 } from "@/components/ui-v2/empty-state";
import { requirePageRoles } from "@/lib/page-guards";
import { getWorkflowAnalytics } from "@/lib/workflow-engine/queries";

export const metadata = { title: "Workflow analytics · MissionOS" };

const OFFICER_ROLES = ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"];

export default async function WorkflowAnalyticsPage() {
  await requirePageRoles(OFFICER_ROLES);
  const a = await getWorkflowAnalytics();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <PageHeaderV2
        eyebrow="MissionOS"
        title="Workflow analytics"
        subtitle="Completion, velocity, and where work gets stuck — across every process."
        backHref="/workflows"
        backLabel="Workflows"
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCardV2 label="Completion rate" value={`${a.completionRate}%`} href="/workflows?status=completed" accent="success" />
        <StatCardV2 label="Active" value={a.activeCount} href="/workflows?status=active" accent="brand" />
        <StatCardV2 label="Blocked" value={a.blockedCount} href="/workflows?status=blocked" accent="danger" />
        <StatCardV2 label="Overdue" value={a.overdueCount} href="/workflows" accent="warning" />
        <StatCardV2 label="Avg cycle" value={`${a.averageCycleHours}h`} href="/workflows" accent="neutral" />
        <StatCardV2 label="Velocity" value={`${a.velocityPerWeek}/wk`} href="/workflows" accent="teal" />
      </div>

      <CardV2 padding="lg">
        <SectionHeaderV2
          title="Bottlenecks"
          description="Stages ranked by dwell time and how many workflows are stuck in them."
        />
        {a.bottlenecks.length === 0 ? (
          <EmptyStateV2
            tone="editorial"
            title="No bottlenecks yet"
            body="As workflows move through stages, the slowest ones surface here."
          />
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {a.bottlenecks.map((b) => (
              <li
                key={`${b.templateId}-${b.stageKey}`}
                className="flex items-center justify-between rounded-lg bg-surface-soft px-4 py-2"
              >
                <span className="text-[14px] font-medium text-ink">{b.stageName}</span>
                <span className="text-[12px] text-ink-muted">
                  avg {b.averageHours}h · {b.openCount} in progress
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardV2>

      <p className="text-center text-[11px] text-ink-muted">
        Generated {new Date(a.generatedAt).toLocaleString()} · {a.total} total workflows
      </p>
    </div>
  );
}
