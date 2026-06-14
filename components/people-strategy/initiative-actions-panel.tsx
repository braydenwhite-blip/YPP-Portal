import Link from "next/link";

import { ActionCard } from "@/components/people-strategy/action-card";
import { ActionQuickCreate } from "@/components/people-strategy/action-quick-create";
import { EmptyStateV2, RecordSection } from "@/components/ui-v2";
import { effectiveStatus } from "@/lib/people-strategy/action-filters";
import type {
  ActionDepartmentOption,
  ActionItemWithRelations,
  ActionPickerUser,
} from "@/lib/people-strategy/action-queries";
import { initiativePrimaryGoalCategory } from "@/lib/people-strategy/strategic-recommendations";
import type { InitiativeMilestoneSummary } from "@/lib/people-strategy/strategic-milestones";
import type { StrategicInitiativeDef } from "@/lib/people-strategy/strategic-initiatives";

/**
 * The work under one initiative. Open actions are grouped by the milestone they
 * move forward (overdue surface first via the deadline sort), with completed work
 * tucked into a collapsed section. Adding an action inline keeps the initiative
 * context, so it stays linked to the plan.
 */
export function InitiativeActionsPanel({
  initiative,
  milestones,
  actions,
  now,
  canCreate,
  assignableUsers,
  departments,
  currentUserId,
}: {
  initiative: StrategicInitiativeDef;
  milestones: InitiativeMilestoneSummary[];
  actions: ActionItemWithRelations[];
  now: Date;
  canCreate: boolean;
  assignableUsers: ActionPickerUser[];
  departments: ActionDepartmentOption[];
  currentUserId: string;
}) {
  const trackerHref = `/actions?initiative=${encodeURIComponent(initiative.id)}&who=all`;

  const open: ActionItemWithRelations[] = [];
  const completed: ActionItemWithRelations[] = [];
  for (const a of actions) {
    if (effectiveStatus(a, now) === "COMPLETE") completed.push(a);
    else open.push(a);
  }

  // Assign each open action to the first milestone (roadmap order) that claims
  // it, so it appears once. The rest fall into a general bucket.
  const milestoneOf = new Map<string, string>();
  for (const m of milestones) {
    for (const id of m.actionIds) {
      if (!milestoneOf.has(id)) milestoneOf.set(id, m.id);
    }
  }
  const byMilestone = new Map<string, ActionItemWithRelations[]>();
  const general: ActionItemWithRelations[] = [];
  for (const a of open) {
    const mid = milestoneOf.get(a.id);
    if (mid) {
      const arr = byMilestone.get(mid) ?? [];
      arr.push(a);
      byMilestone.set(mid, arr);
    } else {
      general.push(a);
    }
  }

  return (
    <RecordSection
      id="actions"
      title="Actions"
      description={`${open.length} open${completed.length > 0 ? ` · ${completed.length} done` : ""} — the work that moves this initiative forward.`}
      action={
        <Link
          href={trackerHref}
          className="text-[13px] font-semibold text-brand-700 no-underline hover:underline"
        >
          View all →
        </Link>
      }
    >
      {canCreate && assignableUsers.length > 0 ? (
        <ActionQuickCreate
          users={assignableUsers}
          departments={departments}
          currentUserId={currentUserId}
          redirectTo={`/operations/initiatives/${initiative.id}`}
          initiativeLink={{
            id: initiative.id,
            goalCategory: initiativePrimaryGoalCategory(initiative),
          }}
        />
      ) : null}

      {open.length === 0 && completed.length === 0 ? (
        <EmptyStateV2
          title="No actions yet"
          body={
            canCreate
              ? "Add the first action above — it will stay linked to this initiative and its milestone."
              : "No work has been linked to this initiative yet."
          }
          className="py-8"
        />
      ) : (
        <div className="mt-2 flex flex-col gap-5">
          {milestones.map((m) => {
            const items = byMilestone.get(m.id);
            if (!items || items.length === 0) return null;
            return (
              <div key={m.id} className="flex flex-col gap-2">
                <p className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
                  {m.title}
                  <span className="font-medium normal-case text-ink-muted/80">
                    {" "}· {items.length} open
                  </span>
                </p>
                {items.map((item) => (
                  <ActionCard key={item.id} item={item} now={now} />
                ))}
              </div>
            );
          })}

          {general.length > 0 ? (
            <div className="flex flex-col gap-2">
              {byMilestone.size > 0 ? (
                <p className="m-0 text-[12px] font-bold uppercase tracking-[0.04em] text-ink-muted">
                  General
                  <span className="font-medium normal-case text-ink-muted/80">
                    {" "}· {general.length} open
                  </span>
                </p>
              ) : null}
              {general.map((item) => (
                <ActionCard key={item.id} item={item} now={now} />
              ))}
            </div>
          ) : null}

          {open.length === 0 ? (
            <p className="m-0 text-[13px] text-ink-muted">
              No open actions — every linked action is complete.
            </p>
          ) : null}

          {completed.length > 0 ? (
            <details className="rounded-[10px] border border-line-soft bg-surface-soft px-3 py-2">
              <summary className="cursor-pointer text-[12.5px] font-semibold text-ink-muted">
                Completed actions ({completed.length})
              </summary>
              <div className="mt-2 flex flex-col gap-2">
                {completed.map((item) => (
                  <ActionCard key={item.id} item={item} now={now} />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      )}
    </RecordSection>
  );
}
