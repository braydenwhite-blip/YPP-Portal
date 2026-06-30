"use client";

/**
 * Partner Command Workspace (Partner Automation, Phase 1).
 *
 * The CP-facing `/partners` workspace: today's priorities, the Chapter Impact
 * metrics strip, the pipeline board (board / list), and the operating queues.
 * Calm cards + concrete next actions — it tells the Chapter President what to do
 * next. Reads only; every card opens the partner operating room to act.
 */

import { useState } from "react";
import Link from "next/link";

import { Button, ButtonLink, CardV2, StatusBadge, cn } from "@/components/ui-v2";
import type { PartnerCardDTO, PartnerWorkspaceData } from "@/lib/partners/workspace-types";

function MetricTile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-1">
      <span className={cn("text-[26px] font-extrabold leading-none", accent ? "text-brand-600" : "text-ink")}>
        {value}
      </span>
      <span className="text-[12px] font-medium text-ink-muted">{label}</span>
    </CardV2>
  );
}

function PartnerCard({ card }: { card: PartnerCardDTO }) {
  return (
    <Link
      href={card.href}
      className="block rounded-[12px] border border-line-card bg-surface px-3.5 py-3 no-underline shadow-card transition-colors hover:border-brand-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 truncate text-[13.5px] font-bold text-ink">{card.name}</p>
          <p className="m-0 mt-0.5 text-[11.5px] text-ink-muted">
            {card.typeLabel ?? "Partner"}
            {card.contactName ? ` · ${card.contactName}` : ""}
          </p>
        </div>
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
          {card.initials}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "truncate text-[11.5px] font-semibold",
            card.nextAction.tone === "danger" ? "text-rose-600" : "text-ink-muted"
          )}
        >
          {card.nextAction.label}
        </span>
        {card.logisticsIncomplete ? (
          <StatusBadge tone="warning">Logistics</StatusBadge>
        ) : card.nextFollowUpOverdue ? (
          <StatusBadge tone="danger">Due</StatusBadge>
        ) : null}
      </div>
    </Link>
  );
}

function QueueCard({
  title,
  icon,
  cards,
  emptyText,
  meta,
}: {
  title: string;
  icon: string;
  cards: PartnerCardDTO[];
  emptyText: string;
  meta?: (c: PartnerCardDTO) => string | null;
}) {
  return (
    <CardV2 padding="md" className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        <h3 className="m-0 text-[14px] font-bold text-ink">{title}</h3>
        <span className="ml-auto text-[12px] font-semibold text-ink-muted">{cards.length}</span>
      </div>
      {cards.length === 0 ? (
        <p className="m-0 text-[12.5px] text-ink-muted">{emptyText}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {cards.slice(0, 4).map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="flex items-center justify-between gap-2 no-underline">
                <span className="truncate text-[12.5px] font-semibold text-ink">{c.name}</span>
                <span className="shrink-0 text-[11.5px] text-ink-muted">{meta?.(c) ?? c.nextAction.detail ?? ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </CardV2>
  );
}

export function PartnerWorkspace({ data }: { data: PartnerWorkspaceData }) {
  const [view, setView] = useState<"board" | "list">("board");
  const [window, setWindow] = useState<"all" | "week">("all");
  const m = window === "week" ? data.metricsThisWeek : data.metrics;

  const metricTiles = [
    { label: "Partners Researched", value: m.researched, accent: true },
    { label: window === "week" ? "Emails Sent (wk)" : "Emails Sent", value: m.emailsSent },
    { label: "Follow-ups Due", value: m.followUpsDue },
    { label: "Meetings Scheduled", value: m.meetingsScheduled },
    { label: "Confirmed Partners", value: m.confirmed },
    { label: "Logistics Incomplete", value: m.logisticsIncomplete },
  ];

  const priorityRows = [
    data.priorities.followUpsDue > 0 && {
      label: `${data.priorities.followUpsDue} follow-up${data.priorities.followUpsDue === 1 ? "" : "s"} due`,
      detail: "Reach out so they don't go cold",
      href: "#follow-ups-due",
      tone: "danger" as const,
    },
    data.priorities.meetingsThisWeek > 0 && {
      label: `${data.priorities.meetingsThisWeek} meeting${data.priorities.meetingsThisWeek === 1 ? "" : "s"} scheduled`,
      detail: "Prep your meeting briefs",
      href: "#meetings",
      tone: "warning" as const,
    },
    data.priorities.waitingOnResponse > 0 && {
      label: `${data.priorities.waitingOnResponse} waiting on a response`,
      detail: "Follow up after 5 business days",
      href: "#waiting",
      tone: "info" as const,
    },
    data.priorities.logisticsIncomplete > 0 && {
      label: `${data.priorities.logisticsIncomplete} confirmed, logistics incomplete`,
      detail: "Lock rooms, times, and supervision",
      href: "#logistics",
      tone: "warning" as const,
    },
  ].filter(Boolean) as { label: string; detail: string; href: string; tone: "danger" | "warning" | "info" }[];

  return (
    <div className="flex flex-col gap-5">
      {/* Top: priorities + metric strip */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,360px)_1fr]">
        <CardV2 padding="md" className="flex flex-col gap-3">
          <h2 className="m-0 text-[15px] font-bold text-ink">Today&rsquo;s Partner Work</h2>
          {data.priorities.recommendedAction ? (
            <p className="m-0 rounded-[10px] bg-brand-50 px-3 py-2 text-[12.5px] font-semibold text-brand-700">
              {data.priorities.recommendedAction}
            </p>
          ) : (
            <p className="m-0 text-[12.5px] text-ink-muted">You&rsquo;re all caught up. Add more leads to keep the pipeline full.</p>
          )}
          <div className="flex flex-col gap-1.5">
            {priorityRows.length === 0 ? (
              <p className="m-0 text-[12.5px] text-ink-muted">Nothing urgent right now.</p>
            ) : (
              priorityRows.map((r) => (
                <Link
                  key={r.label}
                  href={r.href}
                  className="flex items-center justify-between gap-2 rounded-[10px] border border-line-soft px-3 py-2 no-underline transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-semibold text-ink">{r.label}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{r.detail}</span>
                  </span>
                  <StatusBadge tone={r.tone}>›</StatusBadge>
                </Link>
              ))
            )}
          </div>
        </CardV2>

        <CardV2 padding="md" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="m-0 text-[15px] font-bold text-ink">Impact Snapshot</h2>
            <div className="seg-tabs">
              <button type="button" className={cn("seg-tab", window === "all" && "active")} onClick={() => setWindow("all")}>
                All time
              </button>
              <button type="button" className={cn("seg-tab", window === "week" && "active")} onClick={() => setWindow("week")}>
                This week
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {metricTiles.map((t) => (
              <MetricTile key={t.label} label={t.label} value={t.value} accent={t.accent} />
            ))}
          </div>
        </CardV2>
      </div>

      {/* Pipeline board / list */}
      <div>
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <h2 className="m-0 text-[16px] font-bold text-ink">Partner Pipeline</h2>
          <div className="seg-tabs">
            <button type="button" className={cn("seg-tab", view === "board" && "active")} onClick={() => setView("board")}>
              Board
            </button>
            <button type="button" className={cn("seg-tab", view === "list" && "active")} onClick={() => setView("list")}>
              List
            </button>
          </div>
        </div>

        {data.cards.length === 0 ? (
          <CardV2 padding="lg" className="text-center">
            <p className="m-0 text-[14px] font-semibold text-ink">No partners yet</p>
            <p className="m-0 mt-1 text-[13px] text-ink-muted">
              Add your first school, library, or community center to start the pipeline.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <ButtonLink href="/partners/new" variant="primary" size="md">+ Add partner</ButtonLink>
              <ButtonLink href="/partners/import" variant="secondary" size="md">Import partners</ButtonLink>
            </div>
          </CardV2>
        ) : view === "board" ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {data.lanes
              .filter((l) => l.cards.length > 0)
              .map((lane) => (
                <section key={lane.lane} className="flex w-[260px] shrink-0 flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 px-0.5">
                    <h3 className="m-0 text-[12.5px] font-bold text-ink">{lane.label}</h3>
                    <span className="text-[11.5px] font-semibold text-ink-muted">{lane.cards.length}</span>
                  </div>
                  <div className="flex flex-col gap-2 rounded-[12px] bg-surface-2 p-2">
                    {lane.cards.map((c) => (
                      <PartnerCard key={c.id} card={c} />
                    ))}
                    <ButtonLink href="/partners/new" variant="ghost" size="sm" className="justify-center">
                      + Add partner
                    </ButtonLink>
                  </div>
                </section>
              ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {data.lanes
              .filter((l) => l.cards.length > 0)
              .map((lane) => (
                <section key={lane.lane}>
                  <div className="mb-2 flex items-baseline gap-2">
                    <h3 className="m-0 text-[13.5px] font-bold text-ink">{lane.label}</h3>
                    <span className="text-[12px] text-ink-muted">{lane.cards.length} · {lane.hint}</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {lane.cards.map((c) => (
                      <PartnerCard key={c.id} card={c} />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        )}
      </div>

      {/* Operating queues */}
      <div id="follow-ups-due" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QueueCard
          title="Follow-ups Due"
          icon="⏰"
          cards={data.lists.followUpsDue}
          emptyText="Nothing overdue — every conversation has a next step."
          meta={(c) => (c.nextFollowUpOverdue ? "Due" : c.nextFollowUpLabel)}
        />
        <div id="meetings" className="contents">
          <QueueCard
            title="Meetings This Week"
            icon="📅"
            cards={data.lists.meetingsUpcoming}
            emptyText="No meetings scheduled yet."
            meta={(c) => c.meetingDateLabel}
          />
        </div>
        <div id="waiting" className="contents">
          <QueueCard
            title="Waiting on Response"
            icon="✉️"
            cards={data.lists.waitingOnResponse}
            emptyText="No one is waiting on a reply."
            meta={(c) => c.lastContactedLabel}
          />
        </div>
        <div id="logistics" className="contents">
          <QueueCard
            title="Logistics Incomplete"
            icon="⚠️"
            cards={data.lists.logisticsIncomplete}
            emptyText="All confirmed partners are launch-ready."
            meta={() => "Incomplete"}
          />
        </div>
      </div>
    </div>
  );
}
