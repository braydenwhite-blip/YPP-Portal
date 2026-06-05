import type { WeeklyPulse } from "./command-center-selectors";

/**
 * People Strategy — week-over-week pulse trend (Phase 7).
 *
 * A PURE diff (no DB, no session) between the current Weekly Pulse and the prior
 * week's persisted snapshot (`ActionPulseSnapshot`). It turns two snapshots into
 * per-metric deltas so the Leadership Briefing can answer "are we getting better
 * or worse?" — e.g. "overdue ↓2, completed ↑3 vs last week" — without
 * reconstructing historical state. Pure + deterministic so it is unit-testable.
 */

/** The persisted shape of a prior week's pulse (a subset of ActionPulseSnapshot). */
export interface PulseSnapshot {
  weekStart: Date;
  openTotal: number;
  completedThisWeek: number;
  overdue: number;
  flagged: number;
  blocked: number;
  dueThisWeek: number;
  unowned: number;
}

export type PulseMetric =
  | "openTotal"
  | "completedThisWeek"
  | "overdue"
  | "flagged"
  | "blocked"
  | "dueThisWeek"
  | "unowned";

export interface PulseTrend {
  /** Monday of the week being compared against. */
  priorWeekStart: Date;
  /** `current - prior`, per metric (positive = went up this week). */
  deltas: Record<PulseMetric, number>;
}

/** The metrics a trend covers, in a stable order. */
export const PULSE_METRICS: readonly PulseMetric[] = [
  "openTotal",
  "completedThisWeek",
  "overdue",
  "flagged",
  "blocked",
  "dueThisWeek",
  "unowned",
] as const;

/**
 * Pure week-over-week diff of the pulse against the prior snapshot. The caller is
 * responsible for only passing a snapshot from an *earlier* week; this just
 * subtracts, so the direction is always `current - prior`.
 */
export function buildPulseTrend(
  current: WeeklyPulse,
  prior: PulseSnapshot
): PulseTrend {
  const deltas = {} as Record<PulseMetric, number>;
  for (const metric of PULSE_METRICS) {
    deltas[metric] = current[metric] - prior[metric];
  }
  return { priorWeekStart: prior.weekStart, deltas };
}
