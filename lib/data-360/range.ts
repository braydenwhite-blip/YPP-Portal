/**
 * Data 360 — date-range resolution.
 *
 * Pure and deterministic: callers inject `now`. Resolves one of the proposal's
 * historical windows (today / week / month / quarter / year / all) into a
 * concrete `{start, end}` plus the equally-sized PREVIOUS window for
 * period-over-period reads. Week starts Monday, matching the rest of the portal
 * (`lib/weekly-meetings/week.ts`).
 */

import {
  DATE_RANGE_KEYS,
  type DateRangeKey,
  type ResolvedRange,
} from "./types";

const RANGE_KEY_SET = new Set<string>(DATE_RANGE_KEYS);

/** Parse an untrusted query value into a range key, defaulting to "month". */
export function parseRangeKey(value: unknown): DateRangeKey {
  if (typeof value === "string" && RANGE_KEY_SET.has(value)) {
    return value as DateRangeKey;
  }
  return "month";
}

const RANGE_LABELS: Record<DateRangeKey, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
  all: "All time",
};

const SINCE_LABELS: Record<DateRangeKey, string> = {
  today: "today",
  week: "this week",
  month: "this month",
  quarter: "this quarter",
  year: "this year",
  all: "all time",
};

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Monday 00:00 of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const day = startOfDay(d);
  const dow = (day.getDay() + 6) % 7; // 0 = Monday
  day.setDate(day.getDate() - dow);
  return day;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), q, 1);
}

function startOfYear(d: Date): Date {
  return new Date(d.getFullYear(), 0, 1);
}

/**
 * Resolve a range key against `now`. The previous window is the same duration
 * immediately before `start` (for "all time" there is no previous window).
 */
export function resolveRange(key: DateRangeKey, now: Date): ResolvedRange {
  const end = now;
  let start: Date | null;

  switch (key) {
    case "today":
      start = startOfDay(now);
      break;
    case "week":
      start = startOfWeek(now);
      break;
    case "month":
      start = startOfMonth(now);
      break;
    case "quarter":
      start = startOfQuarter(now);
      break;
    case "year":
      start = startOfYear(now);
      break;
    case "all":
    default:
      start = null;
  }

  let prevStart: Date | null = null;
  let prevEnd: Date | null = null;
  if (start) {
    const durationMs = end.getTime() - start.getTime();
    prevEnd = start;
    prevStart = new Date(start.getTime() - durationMs);
  }

  return {
    key,
    label: RANGE_LABELS[key],
    sinceLabel: SINCE_LABELS[key],
    start,
    end,
    prevStart,
    prevEnd,
  };
}

/**
 * A Prisma `createdAt`-style filter for the range, or `undefined` for "all
 * time" (no lower bound). Use as `where: { createdAt: rangeWhere(range) }`.
 */
export function rangeWhere(
  range: ResolvedRange
): { gte: Date; lte: Date } | undefined {
  if (!range.start) return undefined;
  return { gte: range.start, lte: range.end };
}
