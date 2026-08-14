"use client";

/**
 * Partner workspace — calm CP-facing list.
 * One job: see who needs you next, then open the partner to act.
 */

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  ButtonLink,
  EmptyStateV2,
  StatusBadge,
  cn,
} from "@/components/ui-v2";
import type { PartnerCardDTO, PartnerWorkspaceData } from "@/lib/partners/workspace-types";

type FocusFilter = "all" | "needs_you" | "confirmed";

function PartnerRow({ card }: { card: PartnerCardDTO }) {
  const urgent = card.nextAction.tone === "danger" || card.nextFollowUpOverdue;
  return (
    <li>
      <Link
        href={card.href}
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 rounded-[12px] border bg-surface px-4 py-3.5 no-underline",
          "transition-colors hover:border-brand-300 hover:bg-brand-50/40",
          urgent ? "border-rose-200/80" : "border-line-soft"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700"
          >
            {card.initials}
          </span>
          <div className="min-w-0">
            <p className="m-0 truncate text-[14px] font-semibold text-ink">{card.name}</p>
            <p className="m-0 mt-0.5 truncate text-[12.5px] text-ink-muted">
              {[card.typeLabel, card.contactName, card.chapterLabel].filter(Boolean).join(" · ") ||
                "Partner"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={card.laneTone}>{card.laneLabel}</StatusBadge>
          {card.nextFollowUpOverdue ? <StatusBadge tone="danger">Follow-up due</StatusBadge> : null}
          {card.logisticsIncomplete ? <StatusBadge tone="warning">Logistics</StatusBadge> : null}
          <span
            className={cn(
              "text-[12.5px] font-medium",
              urgent ? "text-rose-700" : "text-ink-muted"
            )}
          >
            {card.nextAction.label}
          </span>
        </div>
      </Link>
    </li>
  );
}

export function PartnerWorkspace({ data }: { data: PartnerWorkspaceData }) {
  const [focus, setFocus] = useState<FocusFilter>("all");

  const attention = useMemo(() => {
    const items: { label: string; detail: string; count: number }[] = [];
    if (data.priorities.followUpsDue > 0) {
      items.push({
        label: "Follow-ups due",
        detail: "Reach out so conversations don’t go cold",
        count: data.priorities.followUpsDue,
      });
    }
    if (data.priorities.meetingsThisWeek > 0) {
      items.push({
        label: "Meetings this week",
        detail: "Prep briefs before you meet",
        count: data.priorities.meetingsThisWeek,
      });
    }
    if (data.priorities.logisticsIncomplete > 0) {
      items.push({
        label: "Logistics incomplete",
        detail: "Confirmed partners still missing room/time details",
        count: data.priorities.logisticsIncomplete,
      });
    }
    return items;
  }, [data.priorities]);

  const needsYouIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of data.lists.followUpsDue) ids.add(c.id);
    for (const c of data.lists.meetingsUpcoming) ids.add(c.id);
    for (const c of data.lists.waitingOnResponse) ids.add(c.id);
    for (const c of data.lists.logisticsIncomplete) ids.add(c.id);
    return ids;
  }, [data.lists]);

  const confirmedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of data.cards) {
      if (c.lane === "CONFIRMED") ids.add(c.id);
    }
    return ids;
  }, [data.cards]);

  const visible = useMemo(() => {
    let rows = data.cards;
    if (focus === "needs_you") rows = rows.filter((c) => needsYouIds.has(c.id));
    if (focus === "confirmed") rows = rows.filter((c) => confirmedIds.has(c.id));
    // Needs-you first, then name
    return [...rows].sort((a, b) => {
      const aNeed = needsYouIds.has(a.id) ? 0 : 1;
      const bNeed = needsYouIds.has(b.id) ? 0 : 1;
      if (aNeed !== bNeed) return aNeed - bNeed;
      if (a.nextFollowUpOverdue !== b.nextFollowUpOverdue) return a.nextFollowUpOverdue ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [data.cards, focus, needsYouIds, confirmedIds]);

  const metrics = [
    { label: "Partners", value: data.metrics.researched || data.cards.length },
    { label: "Confirmed", value: data.metrics.confirmed },
    { label: "Follow-ups due", value: data.metrics.followUpsDue, attention: data.metrics.followUpsDue > 0 },
    { label: "Meetings this week", value: data.priorities.meetingsThisWeek },
  ];

  if (data.cards.length === 0) {
    return (
      <EmptyStateV2
        title="No partners yet"
        body="Add a school, library, or community center to start your pipeline."
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <ButtonLink href="/partners/new" variant="primary" size="md">
              + Add partner
            </ButtonLink>
            <ButtonLink href="/partners/import" variant="secondary" size="md">
              Import
            </ButtonLink>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Quiet metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-[14px] border border-line-soft bg-surface px-4 py-3.5 shadow-card"
          >
            <p
              className={cn(
                "m-0 text-[26px] font-bold leading-none tracking-[-0.02em]",
                m.attention ? "text-rose-700" : "text-ink"
              )}
            >
              {m.value}
            </p>
            <p className="m-0 mt-1.5 text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-muted">
              {m.label}
            </p>
          </div>
        ))}
      </div>

      {/* Needs attention — only when something is due */}
      {attention.length > 0 ? (
        <section
          aria-label="Needs attention"
          className="rounded-[14px] border border-amber-200/80 bg-amber-50/50 px-4 py-3.5"
        >
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-amber-900/80">
            Needs you
          </p>
          {data.priorities.recommendedAction ? (
            <p className="m-0 mt-1 text-[13.5px] font-semibold text-ink">
              {data.priorities.recommendedAction}
            </p>
          ) : null}
          <ul className="m-0 mt-2.5 flex list-none flex-wrap gap-2 p-0">
            {attention.map((item) => (
              <li
                key={item.label}
                className="rounded-full border border-amber-200/90 bg-surface px-3 py-1.5 text-[12.5px] text-ink"
                title={item.detail}
              >
                <span className="font-bold tabular-nums">{item.count}</span>{" "}
                <span className="text-ink-muted">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="m-0 rounded-[14px] border border-line-soft bg-surface-soft px-4 py-3 text-[13.5px] text-ink-muted">
          You’re caught up — nothing urgent on partners right now.
        </p>
      )}

      {/* Focus filters + list */}
      <section aria-label="Partner list" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="m-0 text-[15px] font-bold text-ink">
            {focus === "needs_you"
              ? "Needs you"
              : focus === "confirmed"
                ? "Confirmed"
                : "All partners"}
            <span className="ml-2 text-[13px] font-medium text-ink-muted">{visible.length}</span>
          </h2>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter partners">
            {(
              [
                { key: "all", label: "All" },
                { key: "needs_you", label: "Needs you" },
                { key: "confirmed", label: "Confirmed" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFocus(f.key)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  focus === f.key
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-line bg-surface text-brand-800 hover:border-brand-400 hover:bg-brand-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <EmptyStateV2
            title="Nothing in this view"
            body="Try All partners, or add someone new to the pipeline."
            action={
              <ButtonLink href="/partners/new" variant="secondary" size="sm">
                + Add partner
              </ButtonLink>
            }
          />
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {visible.map((card) => (
              <PartnerRow key={card.id} card={card} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
