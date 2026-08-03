"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type TeachingCalendarEvent = {
  id: string;
  classId: string;
  classTitle: string;
  chipTitle: string;
  themeColor: string;
  sessionNumber: number;
  topic: string;
  /** YYYY-MM-DD in the class timezone */
  dayKey: string;
  timeLabel: string;
  sortMinutes: number;
  locationLabel: string;
  href: string;
  lifecycle: "before" | "during" | "after" | "cancelled";
  actionLabel: string;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const DEFAULT_THEME = "#6b21c8";

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
}

function dayKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthCells(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i += 1) {
    cells.push({ day: null, key: `pad-${i}` });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ day: d, key: dayKeyFromParts(year, month, d) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: `pad-end-${cells.length}` });
  }
  return cells;
}

function lifecycleLabel(lifecycle: TeachingCalendarEvent["lifecycle"]) {
  if (lifecycle === "during") return "Live";
  if (lifecycle === "after") return "Done";
  if (lifecycle === "cancelled") return "Cancelled";
  return "Upcoming";
}

export function InstructorTeachingCalendar({
  events,
  todayKey,
}: {
  events: TeachingCalendarEvent[];
  todayKey: string;
}) {
  const initial = todayKey.split("-").map(Number);
  const [year, setYear] = useState(initial[0] ?? new Date().getFullYear());
  const [month, setMonth] = useState((initial[1] ?? 1) - 1);
  const [selectedKey, setSelectedKey] = useState<string | null>(todayKey);

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, TeachingCalendarEvent[]>();
    for (const event of events) {
      const list = map.get(event.dayKey) ?? [];
      list.push(event);
      map.set(event.dayKey, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.sortMinutes - b.sortMinutes || a.chipTitle.localeCompare(b.chipTitle));
    }
    return map;
  }, [events]);

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthEvents = useMemo(
    () =>
      events
        .filter((e) => e.dayKey.startsWith(monthPrefix))
        .sort((a, b) => a.dayKey.localeCompare(b.dayKey) || a.timeLabel.localeCompare(b.timeLabel)),
    [events, monthPrefix],
  );

  const selectedEvents = selectedKey ? (eventsByDay.get(selectedKey) ?? []) : [];

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(null);
  }

  function goToday() {
    const [y, m] = todayKey.split("-").map(Number);
    setYear(y!);
    setMonth(m! - 1);
    setSelectedKey(todayKey);
  }

  return (
    <div className="space-y-6">
      <section
        className="overflow-hidden rounded-2xl border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.08)]"
        aria-label="Teaching calendar"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f4] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#dadce0] text-[#5f6368] hover:bg-[#f8f9fa]"
              aria-label="Previous month"
            >
              ‹
            </button>
            <h2 className="m-0 min-w-[10rem] text-center text-[18px] font-medium text-[#202124]">
              {monthLabel(year, month)}
            </h2>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#dadce0] text-[#5f6368] hover:bg-[#f8f9fa]"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="flex items-center gap-3">
            <p className="m-0 text-[12.5px] text-[#5f6368]">
              {monthEvents.length} session{monthEvents.length === 1 ? "" : "s"} this month
            </p>
            <button
              type="button"
              onClick={goToday}
              className="rounded-full border border-[#dadce0] px-3 py-1.5 text-[12.5px] font-medium text-[#202124] hover:bg-[#f8f9fa]"
            >
              Today
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-[#f1f3f4] bg-[#f8f9fa]">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center text-[11px] font-medium uppercase tracking-[0.04em] text-[#5f6368]"
            >
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-[minmax(92px,1fr)]">
          {cells.map((cell) => {
            if (cell.day == null) {
              return (
                <div
                  key={cell.key}
                  className="min-h-[92px] border-b border-r border-[#f1f3f4] bg-[#fafbfc]"
                />
              );
            }
            const dayEvents = eventsByDay.get(cell.key) ?? [];
            const isToday = cell.key === todayKey;
            const isSelected = cell.key === selectedKey;
            return (
              <button
                key={cell.key}
                type="button"
                onClick={() => setSelectedKey(cell.key)}
                className={[
                  "flex min-h-[92px] flex-col gap-1 border-b border-r border-[#f1f3f4] p-1.5 text-left transition",
                  isSelected ? "bg-[#e8f0fe]" : "bg-white hover:bg-[#f8f9fa]",
                ].join(" ")}
              >
                <span
                  className={[
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium",
                    isToday
                      ? "bg-[#1967d2] text-white"
                      : isSelected
                        ? "text-[#1967d2]"
                        : "text-[#202124]",
                  ].join(" ")}
                >
                  {cell.day}
                </span>
                <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((event) => (
                    <span
                      key={event.id}
                      className="truncate rounded px-1 py-0.5 text-[10.5px] font-medium leading-tight text-white"
                      style={{ backgroundColor: event.themeColor || DEFAULT_THEME }}
                      title={`${event.timeLabel} · ${event.classTitle}`}
                    >
                      {event.timeLabel.replace(/\s*[A-Z]{2,4}$/, "")} {event.chipTitle}
                    </span>
                  ))}
                  {dayEvents.length > 3 ? (
                    <span className="px-1 text-[10px] font-medium text-[#5f6368]">
                      +{dayEvents.length - 3} more
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="rounded-2xl border border-[#dadce0] bg-white p-4 shadow-[0_1px_2px_rgba(60,64,67,0.08)] sm:p-5"
        aria-label="Selected day"
      >
        <h2 className="m-0 text-[16px] font-medium text-[#202124]">
          {selectedKey ? formatDayHeading(selectedKey) : "Pick a day"}
        </h2>
        {!selectedKey ? (
          <p className="m-0 mt-2 text-[13px] text-[#5f6368]">
            Select a day on the calendar to see class sessions.
          </p>
        ) : selectedEvents.length === 0 ? (
          <p className="m-0 mt-2 text-[13px] text-[#5f6368]">No teaching sessions this day.</p>
        ) : (
          <ul className="m-0 mt-4 list-none space-y-3 p-0">
            {selectedEvents.map((event) => (
              <li key={event.id}>
                <Link
                  href={event.href}
                  className="flex gap-3 rounded-xl border border-[#dadce0] p-3.5 no-underline transition hover:bg-[#f8f9fa]"
                >
                  <span
                    aria-hidden
                    className="mt-1 h-10 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: event.themeColor || DEFAULT_THEME }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-semibold text-[#1967d2]">
                        {event.timeLabel}
                      </span>
                      <span className="rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[11px] font-medium text-[#5f6368]">
                        {lifecycleLabel(event.lifecycle)}
                      </span>
                    </span>
                    <span className="mt-1 block text-[15px] font-medium text-[#202124]">
                      {event.classTitle}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-[#5f6368]">
                      Session {event.sessionNumber}: {event.topic}
                    </span>
                    <span className="mt-1 block text-[12.5px] text-[#80868b]">
                      {event.locationLabel} · {event.actionLabel}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDayHeading(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(y!, m! - 1, d!));
}
