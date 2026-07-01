/**
 * Data 360 — week bucketing (pure).
 *
 * Turns a bag of timestamps into a dense week-by-week series for the last N
 * reporting weeks, using the portal's canonical Monday-00:00-UTC week
 * (`lib/weekly-meetings/week.ts`). Dense = every week in the window is present,
 * even zero weeks, so charts don't lie about gaps. Pure + deterministic:
 * `now` is injected.
 */

import { addWeeks, weekKey, weekLabel, weekStartFor } from "@/lib/weekly-meetings/week";
import type { TimeSeriesPoint } from "./types";

export const DEFAULT_TREND_WEEKS = 16;

/** The ordered list of week starts for the trailing `weeks` window ending at `now`. */
export function trailingWeekStarts(now: Date, weeks: number): Date[] {
  const current = weekStartFor(now);
  const out: Date[] = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    out.push(addWeeks(current, -i));
  }
  return out;
}

/**
 * Bucket `dates` into a dense trailing-`weeks` week series. Each point's value
 * is the count of dates whose reporting week matches that bucket.
 */
export function bucketDatesByWeek(
  dates: Date[],
  now: Date,
  weeks: number = DEFAULT_TREND_WEEKS
): TimeSeriesPoint[] {
  const starts = trailingWeekStarts(now, weeks);
  const index = new Map<string, number>();
  starts.forEach((s, i) => index.set(weekKey(s), i));

  const values = new Array(starts.length).fill(0);
  for (const d of dates) {
    const key = weekKey(weekStartFor(d));
    const i = index.get(key);
    if (i !== undefined) values[i] += 1;
  }

  return starts.map((s, i) => ({
    t: weekKey(s),
    label: weekLabel(s),
    value: values[i],
  }));
}

/**
 * Like `bucketDatesByWeek` but each date carries a numeric weight that is summed
 * (e.g. attendance %, not just counts). Weights are averaged per week when
 * `average` is set, otherwise summed.
 */
export function bucketWeightedByWeek(
  entries: { date: Date; weight: number }[],
  now: Date,
  weeks: number = DEFAULT_TREND_WEEKS,
  average = false
): TimeSeriesPoint[] {
  const starts = trailingWeekStarts(now, weeks);
  const index = new Map<string, number>();
  starts.forEach((s, i) => index.set(weekKey(s), i));

  const sums = new Array(starts.length).fill(0);
  const counts = new Array(starts.length).fill(0);
  for (const e of entries) {
    const key = weekKey(weekStartFor(e.date));
    const i = index.get(key);
    if (i !== undefined) {
      sums[i] += e.weight;
      counts[i] += 1;
    }
  }

  return starts.map((s, i) => ({
    t: weekKey(s),
    label: weekLabel(s),
    value: average ? (counts[i] > 0 ? Math.round(sums[i] / counts[i]) : 0) : sums[i],
  }));
}
