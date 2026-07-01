// ============================================================================
// Universal Workflow Engine — "My Workflow Queue" Home dashboard section
// ============================================================================
//
// Part 6 of the activation-layer spec (Workflow Inbox / My Work). The
// portal's separate "/work" hub was retired, so this is the Home-dashboard
// answer to "what workflow steps do I own, and what's overdue?" — a compact
// CardV2 with a summary line, a list of steps assigned to the viewer, and
// (when non-empty) a secondary list of workflow instances they own outright.
//
// Async server component: fetches its own data via getMyWorkflowQueue so
// callers just drop <MyWorkflowQueueCard userId={...} /> into a page.

import Link from "next/link";

import { CardV2 } from "@/components/ui-v2/card";
import { EmptyStateV2 } from "@/components/ui-v2/empty-state";
import { StatusBadge } from "@/components/ui-v2/status-badge";
import { getMyWorkflowQueue } from "@/lib/workflow-engine/my-queue";

function formatDueDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export async function MyWorkflowQueueCard({ userId }: { userId: string }) {
  const queue = await getMyWorkflowQueue(userId);
  const { assignedToMe, instancesIOwn, overdueCount, dueThisWeekCount } = queue;

  const isEmpty = assignedToMe.length === 0 && instancesIOwn.length === 0;

  return (
    <CardV2 padding="lg" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[15px] font-bold text-ink">My Workflow Queue</h2>
        {assignedToMe.length > 0 ? (
          <p className="m-0 text-[12.5px] text-ink-muted">
            {assignedToMe.length} assigned
            {" · "}
            {overdueCount} overdue
            {" · "}
            {dueThisWeekCount} due this week
          </p>
        ) : null}
      </div>

      {isEmpty ? (
        <EmptyStateV2
          title="No workflow steps assigned to you right now."
          body="Steps you own on active workflows will show up here."
        />
      ) : (
        <>
          {assignedToMe.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {assignedToMe.slice(0, 8).map((item) => {
                const dueLabel = formatDueDate(item.dueAt);
                return (
                  <li
                    key={item.executionId}
                    className="flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 transition-colors hover:bg-surface-soft"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink">
                        {item.stepTitle}
                      </span>
                      <Link
                        href={`/workflows/${item.instanceId}`}
                        className="block truncate text-[12px] text-brand-700 no-underline hover:underline"
                      >
                        {item.instanceTitle}
                      </Link>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {item.isBlocked ? (
                        <StatusBadge tone="danger" title="This step is blocked and needs to be unblocked.">
                          Blocked
                        </StatusBadge>
                      ) : item.isOverdue ? (
                        <StatusBadge
                          tone="danger"
                          title={dueLabel ? `Was due ${dueLabel}` : "Past its due date"}
                        >
                          Overdue
                        </StatusBadge>
                      ) : dueLabel ? (
                        <span className="text-[11.5px] font-medium text-ink-muted">
                          Due {dueLabel}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}

          {instancesIOwn.length > 0 ? (
            <div className="flex flex-col gap-1.5 border-t border-line-soft pt-3">
              <p className="m-0 text-[12.5px] font-semibold text-ink-muted">Workflows you own</p>
              <ul className="flex flex-col gap-1">
                {instancesIOwn.slice(0, 6).map((instance) => (
                  <li key={instance.instanceId}>
                    <Link
                      href={`/workflows/${instance.instanceId}`}
                      className="flex items-center justify-between gap-3 rounded-[10px] px-2.5 py-2 no-underline transition-colors hover:bg-surface-soft"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium text-ink">
                          {instance.title}
                        </span>
                        {instance.currentStageName ? (
                          <span className="block truncate text-[12px] text-ink-muted">
                            {instance.currentStageName}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[11.5px] font-medium text-ink-muted">
                        {instance.completionPercent}%
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </CardV2>
  );
}
