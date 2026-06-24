"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button, ButtonLink } from "@/components/ui-v2";
import { StatusPill } from "@/components/people-strategy/pills";
import { formatDueDate } from "@/lib/leadership-action-center/dates";
import { deriveActionContextLabel } from "@/lib/people-strategy/action-context-label";
import { deriveActionNextCta } from "@/lib/people-strategy/action-next-cta";
import { deriveActionUrgency } from "@/lib/people-strategy/action-intel";
import { updateActionStatus } from "@/lib/people-strategy/action-items-actions";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

/**
 * Simplified, scannable Action Tracker row. Shows only what the eye needs to
 * triage — title, owner, due phrasing, connected context, status, an optional
 * next step — and exactly ONE primary button, chosen by {@link deriveActionNextCta}.
 * Everything else lives in the detail page. No dense pill walls, one action.
 */

/** Plain-English due phrasing: "Due tomorrow", "3 days overdue", "Due Jun 30". */
function duePhrase(item: ActionItemWithRelations, now: Date): string {
  if (item.status === "COMPLETE") {
    return `Completed ${formatDueDate(item.completedAt ?? item.updatedAt)}`;
  }
  if (!item.deadlineStart) return "No deadline";
  const u = deriveActionUrgency(item, now);
  if (u.level === "overdue") {
    return `${u.daysOverdue} day${u.daysOverdue === 1 ? "" : "s"} overdue`;
  }
  if (u.level === "due_today") return "Due today";
  if (u.daysUntilDue === 1) return "Due tomorrow";
  if (u.level === "due_soon") return `Due in ${u.daysUntilDue} days`;
  return `Due ${formatDueDate(item.deadlineEnd ?? item.deadlineStart)}`;
}

function ownerLabel(item: ActionItemWithRelations): string {
  const lead = item.lead?.name ?? item.lead?.email ?? null;
  if (lead) return `Assigned to ${lead}`;
  const exec = item.assignments.find((a) => a.role === "EXECUTING")?.user;
  if (exec) return `Assigned to ${exec.name ?? exec.email}`;
  return "Unassigned";
}

export function ActionRow({
  item,
  now,
  reason,
}: {
  item: ActionItemWithRelations;
  now: Date;
  /** Optional override reason line (e.g. the "Needs attention" cause). */
  reason?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cta = deriveActionNextCta(item, now);
  const context = deriveActionContextLabel(item);
  const overdue =
    item.status !== "COMPLETE" &&
    item.status !== "DROPPED" &&
    Boolean(item.deadlineStart) &&
    deriveActionUrgency(item, now).level === "overdue";

  function markDone() {
    setError(null);
    startTransition(async () => {
      try {
        await updateActionStatus(item.id, "COMPLETE");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update that action.");
      }
    });
  }

  const ctaHref =
    cta.behavior === "edit" ? `/actions/${item.id}/edit` : `/actions/${item.id}`;

  // Left rail reads the action's signal: red when overdue, otherwise quiet —
  // matching the mockup's cards.
  const railClass = overdue ? "border-l-blocked-700" : "border-l-transparent";

  return (
    <div
      className={`ps-action-card flex items-start justify-between gap-3 rounded-[12px] border border-l-[3px] border-line-card bg-surface p-3.5 shadow-card ${railClass}`}
    >
      <div className="min-w-0 flex-1">
        <Link
          href={`/actions/${item.id}`}
          className="ps-action-card-title text-[14px] font-semibold leading-snug text-ink no-underline hover:text-brand-700"
        >
          {item.title}
        </Link>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
          <StatusPill status={item.status} />
          <span className={overdue ? "font-semibold text-blocked-700" : "font-semibold text-ink"}>
            {duePhrase(item, now)}
          </span>
          <span aria-hidden>·</span>
          <span>{ownerLabel(item)}</span>
          {context ? (
            <>
              <span aria-hidden>·</span>
              {context.href ? (
                <Link href={context.href} className="text-brand-700 no-underline hover:underline">
                  {context.text}
                </Link>
              ) : (
                <span>{context.text}</span>
              )}
            </>
          ) : null}
        </div>

        {reason ? (
          <p className="m-0 mt-1.5 text-[12px] text-blocked-700">{reason}</p>
        ) : item.successDefinition ? (
          <p className="m-0 mt-1.5 truncate text-[12px] text-ink-muted">
            Next: {item.successDefinition}
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="m-0 mt-1.5 text-[12px] text-blocked-700">
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0">
        {cta.behavior === "complete" ? (
          <Button variant="primary" size="sm" onClick={markDone} disabled={pending} title={cta.reason}>
            {pending ? "Saving…" : cta.label}
          </Button>
        ) : (
          <ButtonLink
            href={ctaHref}
            variant={cta.behavior === "edit" ? "secondary" : "ghost"}
            size="sm"
          >
            {cta.label}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
