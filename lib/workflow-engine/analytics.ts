// ============================================================================
// Universal Workflow Engine — pure analytics
// ============================================================================
//
// Deterministic aggregation helpers for the analytics dashboard and the metric
// cron. Pure (no Prisma, no server-only); the server query layer
// (lib/workflow-engine/queries.ts) loads the raw records and feeds them here.
// Exposed metrics: completion rate, average cycle + stage duration, bottlenecks,
// blocked / overdue counts, and velocity.

import type { WorkflowInstanceStatusValue } from "@/lib/workflow-engine/types";

/** Minimal instance shape needed for portfolio analytics. */
export type InstanceAnalyticsRecord = {
  id: string;
  templateId: string;
  status: WorkflowInstanceStatusValue;
  startedAt: string; // ISO
  completedAt: string | null; // ISO
  dueAt: string | null; // ISO
};

/** A stage dwell record derived from WorkflowEvent stage enter/exit pairs. */
export type StageDwellRecord = {
  templateId: string;
  stageKey: string;
  stageName: string;
  enteredAt: string; // ISO
  exitedAt: string | null; // ISO (null = still in this stage)
};

const HOUR_MS = 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;

function ms(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

const ACTIVE_STATES: WorkflowInstanceStatusValue[] = ["ACTIVE", "BLOCKED", "ON_HOLD"];

/** Completion rate = completed / (completed + cancelled + active). 0–100. */
export function completionRate(instances: InstanceAnalyticsRecord[]): number {
  if (instances.length === 0) return 0;
  const completed = instances.filter((i) => i.status === "COMPLETED").length;
  return round((completed / instances.length) * 100);
}

export function countByStatus(
  instances: InstanceAnalyticsRecord[]
): Record<WorkflowInstanceStatusValue, number> {
  const out: Record<WorkflowInstanceStatusValue, number> = {
    ACTIVE: 0,
    BLOCKED: 0,
    ON_HOLD: 0,
    COMPLETED: 0,
    CANCELLED: 0,
  };
  for (const i of instances) out[i.status] += 1;
  return out;
}

/** Workflows that are still open and whose dueAt has passed. */
export function overdueCount(instances: InstanceAnalyticsRecord[], now: string): number {
  const nowMs = ms(now) ?? Date.now();
  return instances.filter((i) => {
    if (!ACTIVE_STATES.includes(i.status)) return false;
    const due = ms(i.dueAt);
    return due !== null && nowMs > due;
  }).length;
}

export function blockedCount(instances: InstanceAnalyticsRecord[]): number {
  return instances.filter((i) => i.status === "BLOCKED").length;
}

export function activeCount(instances: InstanceAnalyticsRecord[]): number {
  return instances.filter((i) => ACTIVE_STATES.includes(i.status)).length;
}

/** Average end-to-end cycle time (hours) over COMPLETED instances. */
export function averageCycleHours(instances: InstanceAnalyticsRecord[]): number {
  const durations: number[] = [];
  for (const i of instances) {
    if (i.status !== "COMPLETED") continue;
    const start = ms(i.startedAt);
    const end = ms(i.completedAt);
    if (start === null || end === null || end < start) continue;
    durations.push((end - start) / HOUR_MS);
  }
  if (durations.length === 0) return 0;
  return round(durations.reduce((a, b) => a + b, 0) / durations.length);
}

/** Instances completed per week over the trailing window. */
export function velocityPerWeek(
  instances: InstanceAnalyticsRecord[],
  now: string,
  windowDays = 28
): number {
  const nowMs = ms(now) ?? Date.now();
  const since = nowMs - windowDays * 24 * HOUR_MS;
  const completed = instances.filter((i) => {
    const end = ms(i.completedAt);
    return i.status === "COMPLETED" && end !== null && end >= since;
  }).length;
  const weeks = (windowDays * 24 * HOUR_MS) / WEEK_MS;
  return round(completed / weeks);
}

export type StageDurationStat = {
  templateId: string;
  stageKey: string;
  stageName: string;
  averageHours: number;
  samples: number;
  openCount: number;
};

/** Average dwell time per stage from completed dwell records. */
export function averageStageDurations(dwell: StageDwellRecord[]): StageDurationStat[] {
  const groups = new Map<string, { rec: StageDwellRecord; hours: number[]; open: number }>();
  for (const d of dwell) {
    const key = `${d.templateId}::${d.stageKey}`;
    let g = groups.get(key);
    if (!g) {
      g = { rec: d, hours: [], open: 0 };
      groups.set(key, g);
    }
    const entered = ms(d.enteredAt);
    const exited = ms(d.exitedAt);
    if (entered !== null && exited !== null && exited >= entered) {
      g.hours.push((exited - entered) / HOUR_MS);
    } else if (exited === null) {
      g.open += 1;
    }
  }
  return Array.from(groups.values()).map((g) => ({
    templateId: g.rec.templateId,
    stageKey: g.rec.stageKey,
    stageName: g.rec.stageName,
    averageHours:
      g.hours.length > 0
        ? round(g.hours.reduce((a, b) => a + b, 0) / g.hours.length)
        : 0,
    samples: g.hours.length,
    openCount: g.open,
  }));
}

export type Bottleneck = StageDurationStat & { score: number };

/** Rank stages by a bottleneck score blending dwell time and how many instances
 *  are currently stuck in them. Highest score first. */
export function identifyBottlenecks(
  dwell: StageDwellRecord[],
  limit = 5
): Bottleneck[] {
  const stats = averageStageDurations(dwell);
  return stats
    .map((s) => ({ ...s, score: round(s.averageHours + s.openCount * 24) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export type PortfolioAnalytics = {
  total: number;
  byStatus: Record<WorkflowInstanceStatusValue, number>;
  completionRate: number;
  activeCount: number;
  blockedCount: number;
  overdueCount: number;
  averageCycleHours: number;
  velocityPerWeek: number;
  bottlenecks: Bottleneck[];
};

/** One-shot rollup used by the analytics dashboard and the metric cron. */
export function buildPortfolioAnalytics(
  instances: InstanceAnalyticsRecord[],
  dwell: StageDwellRecord[],
  now: string
): PortfolioAnalytics {
  return {
    total: instances.length,
    byStatus: countByStatus(instances),
    completionRate: completionRate(instances),
    activeCount: activeCount(instances),
    blockedCount: blockedCount(instances),
    overdueCount: overdueCount(instances, now),
    averageCycleHours: averageCycleHours(instances),
    velocityPerWeek: velocityPerWeek(instances, now),
    bottlenecks: identifyBottlenecks(dwell),
  };
}
