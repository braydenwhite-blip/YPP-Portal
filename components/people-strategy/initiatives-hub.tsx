import Link from "next/link";

import { EmptyStateV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { INITIATIVE_HEALTH_COLORS } from "@/components/people-strategy/initiatives-hub-analytics";
import { INITIATIVE_HEALTH_META } from "@/lib/people-strategy/strategic-initiative-health";
import {
  groupInitiativesByHealth,
  groupInitiativesByOwner,
} from "@/lib/people-strategy/initiatives-hub-grouping";
import {
  nextOpenMilestone,
  primaryNextStep,
} from "@/lib/people-strategy/strategic-initiative-attention";
import type { InitiativeSummary } from "@/lib/people-strategy/strategic-initiative-summary";
import { formatMonthDay } from "@/lib/leadership-action-center/dates";

const HEALTH_TONE: Record<string, StatusTone> = {
  healthy: "success",
  drifting: "info",
  at_risk: "warning",
  critical: "danger",
  completed: "neutral",
  archived: "neutral",
};

function InitiativeHubRow({
  initiative,
  isLast,
}: {
  initiative: InitiativeSummary;
  isLast: boolean;
}) {
  const milestone = nextOpenMilestone(initiative);
  const { openActions, overdueActions } = initiative.counts;
  const flagship = initiative.priority === "flagship" || initiative.priority === "high";

  return (
    <Link
      href={initiative.href}
      aria-label={`Open initiative: ${initiative.title}`}
      className={`block cursor-pointer px-4 py-3.5 no-underline transition-colors hover:bg-surface-soft focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-400 ${
        isLast ? "" : "border-b border-line-soft"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 text-[14px] font-bold leading-snug text-ink">
            {initiative.title}
          </span>
          {flagship ? (
            <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.04em] text-brand-800">
              {initiative.priorityLabel}
            </span>
          ) : null}
        </div>
        <StatusBadge tone={HEALTH_TONE[initiative.health.level] ?? "neutral"}>
          {initiative.health.label}
        </StatusBadge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-muted">
        <span>
          Owner: <span className="font-medium text-ink">{initiative.owner ?? "Unassigned"}</span>
        </span>
        <span>{initiative.statusLabel}</span>
        <span className="tabular-nums">{initiative.progress.percent}% of milestones</span>
        {openActions > 0 ? (
          <span className="tabular-nums">
            {openActions} open
            {overdueActions > 0 ? (
              <span className="font-semibold text-[#e5484d]"> · {overdueActions} overdue</span>
            ) : null}
          </span>
        ) : null}
        {milestone?.targetDateISO ? (
          <span
            className="inline-flex items-center gap-1"
            style={{ color: milestone.behindSchedule ? "#e5484d" : undefined }}
          >
            {milestone.behindSchedule ? "Milestone overdue" : "Next milestone"}{" "}
            {formatMonthDay(new Date(milestone.targetDateISO))}
          </span>
        ) : null}
      </div>

      <p className="m-0 mt-2 truncate text-[12px] font-medium text-brand-800">
        Next: {primaryNextStep(initiative)}
      </p>
    </Link>
  );
}

/**
 * Initiatives grouped under colored headers in one bordered card — the same
 * shape as the Meetings and Action Tracker hubs. Groups by health (worst-first)
 * or by owner.
 */
export function InitiativesHub({
  initiatives,
  groupBy,
  emptyTitle,
  emptyBody,
}: {
  initiatives: InitiativeSummary[];
  groupBy: "health" | "owner";
  emptyTitle: string;
  emptyBody: string;
}) {
  if (initiatives.length === 0) {
    return <EmptyStateV2 icon="🏁" title={emptyTitle} body={emptyBody} />;
  }

  const groups =
    groupBy === "owner"
      ? groupInitiativesByOwner(initiatives).map((g) => ({
          key: g.owner,
          label: g.owner,
          color: "#6b21c8",
          items: g.items,
        }))
      : groupInitiativesByHealth(initiatives).map((g) => ({
          key: g.level,
          label: INITIATIVE_HEALTH_META[g.level].label,
          color: INITIATIVE_HEALTH_COLORS[g.level],
          items: g.items,
        }));

  return (
    <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
      {groups.map((group, groupIndex) => {
        const overdue = group.items.reduce((sum, i) => sum + i.counts.overdueActions, 0);
        return (
          <div key={group.key}>
            <header className="flex items-center justify-between gap-3 border-b border-line-soft bg-[#fafafc] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: group.color }}
                />
                <h2
                  className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.1em]"
                  style={{ color: group.color }}
                >
                  {group.label}
                </h2>
              </div>
              <span className="text-[12px] text-ink-muted">
                {group.items.length} initiative{group.items.length === 1 ? "" : "s"}
                {overdue > 0 ? (
                  <span className="font-semibold text-[#e5484d]"> · {overdue} overdue</span>
                ) : null}
              </span>
            </header>

            {group.items.map((initiative, itemIndex) => {
              const isLast =
                groupIndex === groups.length - 1 && itemIndex === group.items.length - 1;
              return (
                <InitiativeHubRow key={initiative.id} initiative={initiative} isLast={isLast} />
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
