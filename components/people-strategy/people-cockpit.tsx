"use client";

import { useState } from "react";

import { ButtonLink, Button, cn } from "@/components/ui-v2";
import type {
  CockpitItem,
  CockpitLane,
  PeopleCockpit,
} from "@/lib/people-strategy/people-cockpit";

/**
 * People Strategy — the cockpit (the calm leadership operating room).
 *
 * Not a table. A briefing strip of plain-English chips sits on top; below it,
 * each decision lane states why its people are grouped, then shows a few
 * spotlight cards with the concrete reason and one obvious button. Person cards
 * route to the existing drawers; class/meeting/applicant cards navigate to the
 * existing workflow. People who are up to date never appear here.
 */

const TONE_BAR: Record<CockpitLane["tone"], string> = {
  danger: "bg-danger-700",
  warning: "bg-warning-700",
  info: "bg-info-700",
  brand: "bg-brand-600",
  success: "bg-success-700",
  neutral: "bg-line",
};

const CHIP_TONE: Record<CockpitLane["tone"], string> = {
  danger: "bg-danger-100 text-danger-700",
  warning: "bg-warning-100 text-warning-700",
  info: "bg-info-100 text-info-700",
  brand: "bg-brand-100 text-brand-700",
  success: "bg-success-100 text-success-700",
  neutral: "bg-brand-50 text-brand-800",
};

/** How many spotlight cards to show before "show more". */
const LANE_PREVIEW = 3;

export function PeopleCockpitView({
  cockpit,
  onOpenPerson,
  onRunPersonAction,
}: {
  cockpit: PeopleCockpit;
  /** Open the Person 360 drawer. */
  onOpenPerson: (personId: string) => void;
  /** Dispatch a person card's primary action to the right drawer. */
  onRunPersonAction: (item: CockpitItem) => void;
}) {
  if (cockpit.lanes.length === 0) {
    return (
      <section className="flex flex-col items-start gap-1.5 rounded-[12px] border border-line-soft bg-surface p-5 shadow-card">
        <p className="m-0 text-[14px] font-semibold text-ink">
          Nothing needs a decision right now.
        </p>
        <p className="m-0 text-[13px] text-ink-muted">
          No check-ins, feedback, reviews, or meeting follow-ups are waiting on
          you. Browse the full team below if you want to look someone up.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cockpit.chips.length > 0 ? (
        <nav
          aria-label="What needs attention"
          className="flex flex-wrap gap-2 rounded-[12px] border border-line-soft bg-surface p-3 shadow-card"
        >
          {cockpit.chips.map((chip) => (
            <a
              key={chip.laneId}
              href={`#lane-${chip.laneId}`}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-[12.5px] font-semibold transition-opacity hover:opacity-80",
                CHIP_TONE[chip.tone]
              )}
            >
              {chip.label}
            </a>
          ))}
        </nav>
      ) : null}

      {cockpit.lanes.map((lane) => (
        <Lane
          key={lane.id}
          lane={lane}
          onOpenPerson={onOpenPerson}
          onRunPersonAction={onRunPersonAction}
        />
      ))}
    </div>
  );
}

function Lane({
  lane,
  onOpenPerson,
  onRunPersonAction,
}: {
  lane: CockpitLane;
  onOpenPerson: (personId: string) => void;
  onRunPersonAction: (item: CockpitItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? lane.items : lane.items.slice(0, LANE_PREVIEW);
  const hidden = lane.items.length - visible.length;

  return (
    <section
      id={`lane-${lane.id}`}
      className="scroll-mt-4 overflow-hidden rounded-[12px] border border-line-soft bg-surface shadow-card"
    >
      <div className="flex items-stretch gap-3">
        <span aria-hidden className={cn("w-1 shrink-0", TONE_BAR[lane.tone])} />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5 py-4 pr-4">
          <h3 className="m-0 text-[14.5px] font-bold tracking-[-0.01em] text-ink">
            {lane.title}
            <span className="ml-2 text-[12.5px] font-semibold text-ink-muted">
              {lane.items.length}
            </span>
          </h3>
          <p className="m-0 text-[12.5px] leading-snug text-ink-muted">{lane.blurb}</p>

          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {visible.map((item) => (
              <SpotlightCard
                key={item.id}
                item={item}
                onOpenPerson={onOpenPerson}
                onRunPersonAction={onRunPersonAction}
              />
            ))}
          </ul>

          {hidden > 0 ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="self-start text-[12.5px] font-semibold text-brand-700 hover:underline"
            >
              Show {hidden} more
            </button>
          ) : expanded && lane.items.length > LANE_PREVIEW ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="self-start text-[12.5px] font-semibold text-ink-muted hover:underline"
            >
              Show less
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function SpotlightCard({
  item,
  onOpenPerson,
  onRunPersonAction,
}: {
  item: CockpitItem;
  onOpenPerson: (personId: string) => void;
  onRunPersonAction: (item: CockpitItem) => void;
}) {
  const personId = item.person.id;
  const isNavigate = item.primaryAction.kind === "navigate";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-surface-soft px-3 py-2">
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {personId ? (
            <button
              type="button"
              onClick={() => onOpenPerson(personId)}
              className="truncate text-[13.5px] font-semibold text-ink hover:underline"
            >
              {item.person.name}
            </button>
          ) : (
            <span className="truncate text-[13.5px] font-semibold text-ink">
              {item.person.name}
            </span>
          )}
          <span className="text-[12.5px] text-ink-muted">{item.reason}</span>
        </div>
        {item.person.context || item.dueLabel ? (
          <span className="truncate text-[11.5px] text-ink-muted">
            {[item.person.context, item.dueLabel].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </div>

      {isNavigate && item.primaryAction.href ? (
        <ButtonLink href={item.primaryAction.href} variant="secondary" size="sm">
          {item.primaryAction.label}
        </ButtonLink>
      ) : item.primaryAction.label ? (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRunPersonAction(item)}
        >
          {item.primaryAction.label}
        </Button>
      ) : null}
    </li>
  );
}
