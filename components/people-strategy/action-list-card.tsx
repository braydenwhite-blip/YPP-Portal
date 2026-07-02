import Link from "next/link";

import { EntityLink } from "@/components/operations/entity-link";
import { PersonLink } from "@/components/people-strategy/person-link";
import { RelatedEntityBadge } from "@/components/people-strategy/operational-badges";
import { cn, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { deriveActionStrategicLinkage } from "@/lib/people-strategy/action-source";
import {
  deriveActionNextMove,
  deriveActionQualityLabels,
} from "@/lib/people-strategy/action-intel";
import { ACTION_STATUS_LABELS } from "@/lib/people-strategy/constants";
import {
  effectiveDeadline,
  isActionOverdue,
} from "@/lib/people-strategy/my-actions-selectors";
import { getUserTitle } from "@/lib/user-title";
import type { ActionItemStatus } from "@prisma/client";

/**
 * Action Tracker list card on ui-v2 (Knowledge OS V2 Phase 3F) — the Tailwind
 * rebuild of `ActionCard` for the rebuilt `/actions` and `/actions/all`
 * surfaces. Same data contract (`ActionItemWithRelations`) and the same
 * interactive behaviors as the legacy card: the title opens the Action 360 in
 * place via `EntityLink` (modifier-click navigates to `/actions/[id]`), the
 * lead opens their person 360 via `PersonLink`, and the linked entity opens
 * its 360 via `RelatedEntityBadge`. Status/priority/type/source render as
 * ui-v2 `StatusBadge`s. The legacy `ActionCard` is untouched — it still serves
 * its ~10 other consumers (chapter / strategic / operations surfaces).
 */

const STATUS_TONE: Record<ActionItemStatus, StatusTone> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  BLOCKED: "warning",
  COMPLETE: "success",
  OVERDUE: "danger",
  DROPPED: "neutral",
};

/** Operational-signal label tone → badge tone (replaces the old priority pill). */
const GAP_TONE: Record<"good" | "warn" | "danger" | "info", StatusTone> = {
  good: "success",
  warn: "warning",
  danger: "danger",
  info: "info",
};

function leadLabel(
  person: ActionItemWithRelations["lead"] | null | undefined
): { name: string; title: string } | null {
  if (!person) return null;
  return {
    name: person.name ?? person.email,
    title: getUserTitle({
      title: person.title,
      primaryRole: person.primaryRole,
      adminSubtypes: person.adminSubtypes.map((s) => s.subtype),
    }),
  };
}

export function ActionListCard({
  item,
  now,
  prompt,
}: {
  item: ActionItemWithRelations;
  now: Date;
  /** Optional context line (e.g. the input request shown on My Actions). */
  prompt?: string | null;
}) {
  const overdue = isActionOverdue(item, now);
  const due = effectiveDeadline(item);
  const executors = item.assignments.filter((a) => a.role === "EXECUTING");
  const lead = leadLabel(item.lead);
  const strategic = deriveActionStrategicLinkage(item);
  const nextMove = deriveActionNextMove(item, now);

  // The single most serious operational gap (needs owner, blocked, stale,
  // define done, follow-up needed…) — the honest "why this matters" signal that
  // replaces the priority pill. "Overdue" is dropped here since the due badge
  // above already says it, and positive ("good") reads are not surfaced.
  const gap =
    deriveActionQualityLabels(item, now).filter((l) => l.key !== "overdue").find(
      (l) => l.tone !== "good"
    ) ?? null;

  // Left rail makes the list scannable: overdue (red) wins, otherwise the rail
  // carries the operational-gap signal so work that needs attention stands out.
  const rail =
    overdue || gap?.tone === "danger"
      ? "border-l-danger-700"
      : gap?.tone === "warn"
        ? "border-l-warning-700"
        : "border-l-transparent";

  return (
    <div
      className={cn(
        "rounded-[10px] border border-line-soft border-l-[3px] bg-surface px-3.5 py-3 shadow-card",
        rail
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <EntityLink
          type="action"
          id={item.id}
          className="min-w-0 truncate text-[14px] font-bold text-ink hover:text-brand-700"
        >
          {item.title}
        </EntityLink>
        <StatusBadge tone={overdue ? "danger" : "neutral"}>
          {overdue ? "Overdue · " : "Due "}
          {formatDueDate(due)}
        </StatusBadge>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={STATUS_TONE[item.status] ?? "neutral"}>
          {ACTION_STATUS_LABELS[item.status]}
        </StatusBadge>
        {gap ? <StatusBadge tone={GAP_TONE[gap.tone]}>{gap.text}</StatusBadge> : null}
        {item.relatedEntityType ? (
          <RelatedEntityBadge type={item.relatedEntityType} id={item.relatedEntityId} />
        ) : null}
        {strategic.initiativeTitle ? (
          <span className="text-[12px] text-ink-muted">
            Initiative: {strategic.initiativeTitle}
          </span>
        ) : null}
      </div>

      {prompt ? (
        <p className="m-0 mt-2 text-[12px] italic text-ink-muted">&ldquo;{prompt}&rdquo;</p>
      ) : (
        <p className="m-0 mt-2 text-[12.5px] text-ink-muted">
          <span className="font-semibold text-ink">Next:</span> {nextMove.move}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3 text-[12px] text-ink-muted">
        <span>
          {lead ? (
            <>
              Lead:{" "}
              <PersonLink id={item.leadId} className="font-semibold text-ink">
                {lead.name}
              </PersonLink>
              <span className="text-ink-muted"> · {lead.title}</span>
            </>
          ) : (
            "Unassigned"
          )}
          {executors.length > 0 ? ` · Executing: ${executors.length}` : ""}
        </span>
        <span className="inline-flex items-baseline gap-2.5 whitespace-nowrap">
          {item.comments.length} {item.comments.length === 1 ? "comment" : "comments"}
          <Link
            href={`/actions/${item.id}`}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            Open →
          </Link>
        </span>
      </div>
    </div>
  );
}
