import Link from "next/link";

import { CardV2 } from "@/components/ui-v2/card";
import { SectionHeaderV2 } from "@/components/ui-v2/section-header";
import { StatusBadge, type StatusTone } from "@/components/ui-v2/status-badge";
import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";

/**
 * Compact list of the ActionItems a workflow instance created (via
 * `WorkflowStepExecution.linkedActionItemId`), for embedding on an entity
 * detail page or instance runner. Presentational only — the caller loads the
 * data with `getWorkflowLinkedActionsData` and passes it in.
 */

// Same tone choices as ACTION_STATUS_TONE in components/people-strategy/pills.tsx,
// re-expressed in StatusBadge's tone vocabulary (neutral/success/warning/danger/
// info/brand) so this list reads consistently with the rest of the Action Tracker.
const ACTION_STATUS_BADGE_TONE: Record<string, StatusTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "brand",
  COMPLETE: "success",
  OVERDUE: "danger",
  BLOCKED: "danger",
  DROPPED: "neutral",
};

export function WorkflowLinkedActions({
  actions,
}: {
  actions: Array<{
    id: string;
    title: string;
    status: string;
    dueDate: string | null;
    ownerName: string | null;
  }>;
}): JSX.Element | null {
  if (actions.length === 0) return null;

  return (
    <CardV2 padding="lg">
      <SectionHeaderV2
        title="Linked actions"
        description="Action items this workflow created."
      />
      <ul className="mt-3 flex flex-col divide-y divide-line-soft">
        {actions.map((action) => (
          <li key={action.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <div className="min-w-0 flex-1">
              <Link
                href={`/actions/${action.id}`}
                className="truncate text-[13.5px] font-medium text-ink no-underline hover:text-brand-700"
              >
                {action.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-ink-muted">
                {action.ownerName ? <span>{action.ownerName}</span> : <span>Unassigned</span>}
                {action.dueDate ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>Due {new Date(action.dueDate).toLocaleDateString()}</span>
                  </>
                ) : null}
              </div>
            </div>
            <StatusBadge tone={ACTION_STATUS_BADGE_TONE[action.status] ?? "neutral"}>
              {ACTION_STATUS_LABELS[action.status as keyof typeof ACTION_STATUS_LABELS] ??
                action.status}
            </StatusBadge>
          </li>
        ))}
      </ul>
    </CardV2>
  );
}
