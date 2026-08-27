import Link from "next/link";

import { cn } from "@/components/ui-v2";

/** How far back from the current calendar month the metrics hub can go. */
export const CHAPTER_MONTH_LOOKBACK = 5;

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type CalendarMonth = { year: number; month: number }; // month 1–12

export function calendarMonthKey({ year, month }: CalendarMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseCalendarMonth(
  raw: string | undefined,
  now = new Date()
): CalendarMonth {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(5, 7));
    if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12) {
      return clampToWindow({ year, month }, now);
    }
  }
  // Legacy ?month=1…6 → map onto the lookback window (6 = current).
  const legacy = Number(raw);
  if (Number.isFinite(legacy) && legacy >= 1 && legacy <= 6) {
    return shiftMonth(currentCalendarMonth(now), legacy - 6);
  }
  return currentCalendarMonth(now);
}

export function currentCalendarMonth(now = new Date()): CalendarMonth {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function shiftMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function monthsBetween(a: CalendarMonth, b: CalendarMonth): number {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

function clampToWindow(value: CalendarMonth, now: Date): CalendarMonth {
  const current = currentCalendarMonth(now);
  const earliest = shiftMonth(current, -CHAPTER_MONTH_LOOKBACK);
  const ahead = monthsBetween(current, value);
  if (ahead > 0) return current;
  const behind = monthsBetween(value, current);
  if (behind > CHAPTER_MONTH_LOOKBACK) return earliest;
  return value;
}

/** Lifecycle slot 1–6: current calendar month → 6, one month back → 5, … */
export function lifecycleMonthFromCalendar(
  value: CalendarMonth,
  now = new Date()
): number {
  const current = currentCalendarMonth(now);
  const monthsBack = monthsBetween(value, current);
  return Math.min(6, Math.max(1, 6 - monthsBack));
}

export function calendarMonthLabel(
  { year, month }: CalendarMonth,
  opts: { includeYear?: boolean } = {}
): string {
  const name = MONTH_NAMES[month - 1] ?? `Month ${month}`;
  if (opts.includeYear) return `${name} ${year}`;
  const current = currentCalendarMonth();
  return year === current.year ? name : `${name} ${year}`;
}

export function chapterMonthHref(value: CalendarMonth, basePath = "/admin/metrics"): string {
  return `${basePath}?month=${calendarMonthKey(value)}`;
}

const navBtn =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[16px] font-semibold leading-none no-underline transition-colors";

export function ChapterMonthNav({
  month,
  basePath = "/admin/metrics",
}: {
  month: CalendarMonth;
  basePath?: string;
}) {
  const current = currentCalendarMonth();
  const earliest = shiftMonth(current, -CHAPTER_MONTH_LOOKBACK);
  const prev =
    monthsBetween(earliest, month) > 0 ? shiftMonth(month, -1) : null;
  const next = monthsBetween(month, current) > 0 ? shiftMonth(month, 1) : null;
  const label = calendarMonthLabel(month);

  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-line-card bg-surface p-0.5"
      aria-label={label}
    >
      {prev ? (
        <Link
          href={chapterMonthHref(prev, basePath)}
          className={cn(navBtn, "text-ink-muted hover:bg-surface-soft hover:text-ink")}
          aria-label={`Previous month (${calendarMonthLabel(prev)})`}
          title={calendarMonthLabel(prev, { includeYear: true })}
        >
          ‹
        </Link>
      ) : (
        <span className={cn(navBtn, "cursor-default text-ink-muted/35")} aria-hidden>
          ‹
        </span>
      )}
      <span className="min-w-[5.5rem] px-1.5 text-center text-[12px] font-semibold text-ink">
        {label}
      </span>
      {next ? (
        <Link
          href={chapterMonthHref(next, basePath)}
          className={cn(navBtn, "text-ink-muted hover:bg-surface-soft hover:text-ink")}
          aria-label={`Next month (${calendarMonthLabel(next)})`}
          title={calendarMonthLabel(next, { includeYear: true })}
        >
          ›
        </Link>
      ) : (
        <span className={cn(navBtn, "cursor-default text-ink-muted/35")} aria-hidden>
          ›
        </span>
      )}
    </div>
  );
}
