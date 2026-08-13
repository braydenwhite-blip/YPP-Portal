"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { ChapterCalendarEntry } from "@/lib/chapter-calendar";

export type ChapterCalendarScopeFilter = "all" | "chapter" | "ypp";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function monthLabel(year: number, month: number) {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(
    new Date(year, month, 1),
  );
}

function dayKeyFromDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayKeyFromParts(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function buildMonthCells(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDow; i += 1) cells.push({ day: null, key: `pad-${i}` });
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push({ day: d, key: dayKeyFromParts(year, month, d) });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, key: `pad-end-${cells.length}` });
  }
  return cells;
}

function entryDayKeys(entry: ChapterCalendarEntry): string[] {
  const start = new Date(entry.startDate);
  const end = new Date(entry.endDate);
  const keys: string[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  // Cap multi-day spans so a bad end date can't explode the grid.
  for (let i = 0; i < 31 && cursor <= last; i += 1) {
    keys.push(dayKeyFromDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return keys;
}

function formatTime(iso: string, allDay: boolean) {
  if (allDay) return "All day";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function scopeBadge(scope: ChapterCalendarEntry["scope"]) {
  return scope === "GLOBAL" ? "YPP-wide" : "Chapter";
}

export function ChapterCalendarBoard({
  chapterName,
  entries,
}: {
  chapterName: string;
  entries: ChapterCalendarEntry[];
}) {
  const today = new Date();
  const todayKey = dayKeyFromDate(today);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedKey, setSelectedKey] = useState<string | null>(todayKey);
  const [filter, setFilter] = useState<ChapterCalendarScopeFilter>("all");

  const filtered = useMemo(() => {
    if (filter === "chapter") return entries.filter((e) => e.scope === "CHAPTER");
    if (filter === "ypp") return entries.filter((e) => e.scope === "GLOBAL");
    return entries;
  }, [entries, filter]);

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, ChapterCalendarEntry[]>();
    for (const entry of filtered) {
      for (const key of entryDayKeys(entry)) {
        const list = map.get(key) ?? [];
        list.push(entry);
        map.set(key, list);
      }
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime() ||
          a.title.localeCompare(b.title),
      );
    }
    return map;
  }, [filtered]);

  const selectedEvents = selectedKey ? (eventsByDay.get(selectedKey) ?? []) : [];

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthCount = filtered.filter((e) => dayKeyFromDate(new Date(e.startDate)).startsWith(monthPrefix))
    .length;

  function shiftMonth(delta: number) {
    const next = new Date(year, month + delta, 1);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedKey(null);
  }

  const filters: Array<{ id: ChapterCalendarScopeFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "chapter", label: chapterName },
    { id: "ypp", label: "YPP-wide" },
  ];

  return (
    <section className="overflow-hidden rounded-[20px] border border-[#dadce0] bg-white shadow-[0_1px_2px_rgba(60,64,67,0.06)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#f1f3f4] bg-linear-to-br from-brand-50/80 via-white to-[#f8f9fa] px-4 py-4 sm:px-5">
        <div>
          <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-brand-700">
            Calendar
          </p>
          <h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[#202124]">
            {monthLabel(year, month)}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-[#5f6368]">
            {monthCount} item{monthCount === 1 ? "" : "s"} this month
            {filter === "all"
              ? " · chapter + YPP-wide"
              : filter === "ypp"
                ? " · YPP-wide only"
                : ` · ${chapterName} only`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full border border-[#dadce0] bg-white p-1">
            {filters.map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFilter(f.id)}
                  className={[
                    "cursor-pointer rounded-full border-0 px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                    active
                      ? "bg-[#202124] text-white"
                      : "bg-transparent text-[#5f6368] hover:text-[#202124]",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <div className="inline-flex overflow-hidden rounded-full border border-[#dadce0] bg-white">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="cursor-pointer border-0 bg-transparent px-3 py-1.5 text-[13px] text-[#3c4043] hover:bg-[#f8f9fa]"
              aria-label="Previous month"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => {
                setYear(today.getFullYear());
                setMonth(today.getMonth());
                setSelectedKey(todayKey);
              }}
              className="cursor-pointer border-0 border-x border-[#dadce0] bg-transparent px-3 py-1.5 text-[12.5px] font-medium text-[#3c4043] hover:bg-[#f8f9fa]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="cursor-pointer border-0 bg-transparent px-3 py-1.5 text-[13px] text-[#3c4043] hover:bg-[#f8f9fa]"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="border-b border-[#f1f3f4] p-3 sm:p-4 lg:border-b-0 lg:border-r">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[#80868b]"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell) => {
              if (cell.day == null) {
                return <div key={cell.key} className="min-h-[84px] rounded-xl bg-transparent" />;
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
                    "flex min-h-[84px] cursor-pointer flex-col gap-1 rounded-xl border p-1.5 text-left transition-colors",
                    isSelected
                      ? "border-brand-400 bg-brand-50/70"
                      : isToday
                        ? "border-brand-200 bg-white"
                        : "border-transparent bg-[#f8f9fa] hover:border-[#dadce0] hover:bg-white",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                      isToday ? "bg-brand-600 text-white" : "text-[#3c4043]",
                    ].join(" ")}
                  >
                    {cell.day}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {dayEvents.slice(0, 3).map((event) => (
                      <span
                        key={event.id}
                        className="truncate rounded-md px-1 py-0.5 text-[10px] font-medium text-white"
                        style={{ backgroundColor: event.eventTypeColor }}
                        title={event.title}
                      >
                        {event.title}
                      </span>
                    ))}
                    {dayEvents.length > 3 ? (
                      <span className="px-1 text-[10px] font-medium text-[#80868b]">
                        +{dayEvents.length - 3} more
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="flex flex-col gap-3 p-4 sm:p-5">
          <div>
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#80868b]">
              {selectedKey
                ? new Date(`${selectedKey}T12:00:00`).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })
                : "Pick a day"}
            </p>
            <p className="m-0 mt-1 text-[14px] text-[#5f6368]">
              {selectedEvents.length === 0
                ? "Nothing scheduled."
                : `${selectedEvents.length} item${selectedEvents.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {selectedEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#dadce0] bg-[#f8f9fa] px-4 py-8 text-center text-[13.5px] text-[#5f6368]">
              No events on this day for the current filter.
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {selectedEvents.map((event) => (
                <li
                  key={event.id}
                  className="rounded-2xl border border-[#dadce0] bg-white p-3 shadow-[0_1px_2px_rgba(60,64,67,0.04)]"
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: event.eventTypeColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[14px] font-semibold text-[#202124]">{event.title}</p>
                      <p className="m-0 mt-1 text-[12px] text-[#5f6368]">
                        {formatTime(event.startDate, event.allDay)}
                        {event.isCancelled ? " · Cancelled" : ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            event.scope === "GLOBAL"
                              ? "bg-indigo-50 text-indigo-700"
                              : "bg-brand-50 text-brand-800",
                          ].join(" ")}
                        >
                          {scopeBadge(event.scope)}
                        </span>
                        <span className="rounded-full bg-[#f1f3f4] px-2 py-0.5 text-[11px] font-medium text-[#5f6368]">
                          {event.eventTypeLabel}
                        </span>
                      </div>
                      {event.link ? (
                        <Link
                          href={event.link}
                          className="mt-2 inline-block text-[12.5px] font-medium text-brand-700 no-underline hover:underline"
                        >
                          Open details →
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto rounded-2xl border border-[#e8def8] bg-brand-50/50 px-3 py-3 text-[12.5px] text-brand-900">
            <strong className="font-semibold">Tip:</strong> Filter by {chapterName} for local
            classes and chapter events, or YPP-wide for network workshops and showcases.
          </div>
        </aside>
      </div>
    </section>
  );
}
