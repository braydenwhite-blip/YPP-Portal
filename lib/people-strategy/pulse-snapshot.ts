import { prisma } from "@/lib/prisma";

import type { WeeklyPulse } from "./command-center-selectors";
import type { PulseSnapshot } from "./pulse-trend";

/**
 * People Strategy — weekly pulse snapshot persistence (Phase 7).
 *
 * Thin data access over `ActionPulseSnapshot`: write one row per operating week
 * (idempotent on `weekStart`) and read the most recent earlier week to diff
 * against. Kept separate from the pure `buildPulseTrend` so the trend logic stays
 * unit-testable, and shared so both the weekly briefing cron (writer + reader)
 * and the Command Center page (reader) use the same queries.
 */

/** The seven pulse metrics that are persisted (everything except the week label). */
function snapshotData(pulse: WeeklyPulse) {
  return {
    openTotal: pulse.openTotal,
    completedThisWeek: pulse.completedThisWeek,
    overdue: pulse.overdue,
    flagged: pulse.flagged,
    blocked: pulse.blocked,
    dueThisWeek: pulse.dueThisWeek,
    unowned: pulse.unowned,
  };
}

/** The most recent snapshot from an *earlier* week, or null when none exists yet. */
export async function getPriorPulseSnapshot(
  weekStart: Date
): Promise<PulseSnapshot | null> {
  const row = await prisma.actionPulseSnapshot.findFirst({
    where: { weekStart: { lt: weekStart } },
    orderBy: { weekStart: "desc" },
  });
  if (!row) return null;
  return {
    weekStart: row.weekStart,
    openTotal: row.openTotal,
    completedThisWeek: row.completedThisWeek,
    overdue: row.overdue,
    flagged: row.flagged,
    blocked: row.blocked,
    dueThisWeek: row.dueThisWeek,
    unowned: row.unowned,
  };
}

/** Persist this week's pulse, idempotent on `weekStart` (re-runs just refresh it). */
export async function recordPulseSnapshot(
  weekStart: Date,
  pulse: WeeklyPulse,
  consideredCount: number
): Promise<void> {
  const data = { ...snapshotData(pulse), consideredCount };
  await prisma.actionPulseSnapshot.upsert({
    where: { weekStart },
    create: { weekStart, ...data },
    update: data,
  });
}
