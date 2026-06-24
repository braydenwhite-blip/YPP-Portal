"use client";

import { useMemo, useState } from "react";

import { ButtonLink, StatusBadge, cn } from "@/components/ui-v2";
import type {
  LeadershipHomeUpcomingEvent,
  LeadershipHomeUpcomingEventType,
} from "@/lib/home/leadership-home";

const TYPE_LABEL: Record<LeadershipHomeUpcomingEventType | "all", string> = {
  all: "All",
  meeting: "Meetings",
  action: "Actions",
  decision: "Decisions",
  advisor_check_in: "Check-ins",
  partner_follow_up: "Partners",
};

const TYPE_TONE: Record<
  LeadershipHomeUpcomingEventType,
  "brand" | "info" | "warning" | "danger"
> = {
  meeting: "brand",
  action: "warning",
  decision: "danger",
  advisor_check_in: "info",
  partner_follow_up: "warning",
};

const TYPE_DOT: Record<LeadershipHomeUpcomingEventType, string> = {
  meeting: "bg-brand-600",
  action: "bg-progress-700",
  decision: "bg-blocked-700",
  advisor_check_in: "bg-info-700",
  partner_follow_up: "bg-progress-700",
};

function fmtDateTime(iso: string): { day: string; date: string; time: string } {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString("en-US", { weekday: "short" }),
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

export function UpcomingHomeCalendar({ events }: { events: LeadershipHomeUpcomingEvent[] }) {
  const [activeType, setActiveType] = useState<LeadershipHomeUpcomingEventType | "all">("all");

  const filters = useMemo(() => {
    const counts = new Map<LeadershipHomeUpcomingEventType | "all", number>([
      ["all", events.length],
    ]);
    for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    return (
      ["all", "meeting", "action", "decision", "advisor_check_in", "partner_follow_up"] as const
    )
      .filter((type) => type === "all" || (counts.get(type) ?? 0) > 0)
      .map((type) => ({ type, count: counts.get(type) ?? 0 }));
  }, [events]);

  const filtered =
    activeType === "all" ? events : events.filter((event) => event.type === activeType);

  if (events.length === 0) {
    return (
      <p className="m-0 text-[13.5px] text-ink-muted">
        Nothing dated is coming up in the current operating window.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Upcoming event filters">
        {filters.map((filter) => {
          const selected = activeType === filter.type;
          return (
            <button
              key={filter.type}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-[9px] border px-3 text-[12.5px] font-semibold transition-colors",
                selected
                  ? "border-brand-300 bg-brand-50 text-brand-800"
                  : "border-line-card bg-surface text-ink-muted hover:border-brand-300 hover:text-brand-700"
              )}
              onClick={() => setActiveType(filter.type)}
            >
              {TYPE_LABEL[filter.type]}
              <span className="rounded-full bg-white px-1.5 text-[11px] text-ink-muted">
                {filter.count}
              </span>
            </button>
          );
        })}
      </div>

      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {filtered.map((event) => {
          const when = fmtDateTime(event.startISO);
          return (
            <li
              key={event.id}
              className="grid gap-3 rounded-[10px] border border-line-card bg-surface px-3.5 py-3 transition-colors hover:border-brand-300 sm:grid-cols-[76px_minmax(0,1fr)_auto]"
            >
              <div className="flex items-center gap-2 sm:block">
                <p className="m-0 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
                  {when.day}
                </p>
                <p className="m-0 text-[13px] font-bold text-ink">{when.date}</p>
                <p className="m-0 text-[11.5px] text-ink-muted">{when.time}</p>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span aria-hidden className={cn("size-2 rounded-full", TYPE_DOT[event.type])} />
                  <StatusBadge tone={TYPE_TONE[event.type]}>{event.label}</StatusBadge>
                  {event.urgencyLabel ? (
                    <StatusBadge tone={event.urgencyTone}>{event.urgencyLabel}</StatusBadge>
                  ) : null}
                </div>
                <p className="m-0 mt-1 truncate text-[13.5px] font-semibold text-ink">
                  {event.title}
                </p>
                <p className="m-0 text-[12.5px] text-ink-muted">
                  {event.detail}
                  {event.ownerLabel ? ` · ${event.ownerLabel}` : ""}
                </p>
              </div>
              <div className="flex items-center sm:justify-end">
                <ButtonLink href={event.href} variant="ghost" size="sm">
                  {event.ctaLabel} →
                </ButtonLink>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
