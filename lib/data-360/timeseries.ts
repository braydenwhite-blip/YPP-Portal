/**
 * Data 360 — historical series helpers.
 *
 * Real history, reconstructed from `createdAt` timestamps — NOT a fabricated
 * layer. `buildMonthlyCumulative` turns a baseline count (records that existed
 * before the window) plus the in-window creation dates into a cumulative
 * monthly curve. Pure; callers inject `now`.
 *
 * This is the seam the Phase-5 `MetricSnapshot` table will plug into for
 * metrics that cannot be reconstructed from `createdAt` (see roadmap §6).
 */

import type { TimeSeries, TimeSeriesPoint } from "./types";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** First day of the month `n` months before `d` (n may be negative). */
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * The first month included in a trailing `months`-month window ending at the
 * current month. Exported so the loader can scope its `findMany` to exactly the
 * dates the series needs (everything older is folded into the baseline count).
 */
export function seriesWindowStart(now: Date, months: number): Date {
  return addMonths(monthStart(now), -(months - 1));
}

/**
 * Build a cumulative monthly series.
 *
 * @param baseline  count of records created strictly before the window start
 * @param dates     creation dates of records inside the window
 * @param now       clock
 * @param months    window length (default 12)
 */
export function buildMonthlyCumulative(input: {
  key: string;
  label: string;
  href: string | null;
  baseline: number;
  dates: Date[];
  now: Date;
  months?: number;
}): TimeSeries {
  const months = input.months ?? 12;
  const windowStart = seriesWindowStart(input.now, months);

  // Per-month bucket scaffold (ordered oldest → newest).
  const buckets: { date: Date; key: string; label: string; added: number }[] =
    [];
  for (let i = 0; i < months; i += 1) {
    const date = addMonths(windowStart, i);
    buckets.push({
      date,
      key: monthKey(date),
      label: MONTH_LABELS[date.getMonth()],
      added: 0,
    });
  }
  const indexByKey = new Map(buckets.map((b, i) => [b.key, i]));

  let added = 0;
  for (const d of input.dates) {
    const idx = indexByKey.get(monthKey(d));
    if (idx != null) {
      buckets[idx].added += 1;
      added += 1;
    }
  }

  let running = input.baseline;
  const points: TimeSeriesPoint[] = buckets.map((b) => {
    running += b.added;
    return { t: b.key, label: b.label, value: running };
  });

  return {
    key: input.key,
    label: input.label,
    points,
    total: running,
    added,
    href: input.href,
  };
}
