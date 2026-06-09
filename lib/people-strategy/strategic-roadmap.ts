import { daysUntil, startOfDay } from "@/lib/leadership-action-center/dates";

import type { InitiativeMilestoneSummary, MilestoneStatus } from "./strategic-milestones";
import { initiativeHref } from "./strategic-timeline";
import type { StrategicInitiativeDef } from "./strategic-initiatives";

/**
 * YPP Execution OS — INITIATIVE ROADMAPS (Phase E).
 *
 * Instead of a task list, a roadmap: the initiative's milestones + target dates
 * laid out by PHASE (completed · current · upcoming · at risk · blocked) and by
 * HORIZON (overdue · this quarter · this half · this year · beyond), so leadership
 * can read sequencing at a glance — what's done, what's in flight, what's coming,
 * and what's slipping. Pure: it derives entirely from the already-computed
 * milestones + the initiative's configured target, no new query, no new analytics.
 */

/** The execution phase of a roadmap item (the kanban lane). */
export type RoadmapPhase = "completed" | "in_progress" | "upcoming" | "at_risk" | "blocked";

export const ROADMAP_PHASE_META: Record<
  RoadmapPhase,
  { label: string; tone: "success" | "info" | "neutral" | "warning" | "overdue"; order: number }
> = {
  completed: { label: "Completed", tone: "success", order: 0 },
  in_progress: { label: "Current", tone: "info", order: 1 },
  upcoming: { label: "Upcoming", tone: "neutral", order: 2 },
  at_risk: { label: "At risk", tone: "warning", order: 3 },
  blocked: { label: "Blocked", tone: "overdue", order: 4 },
};

/** The time horizon a dated roadmap item falls into. */
export type RoadmapHorizon = "overdue" | "quarter" | "half" | "year" | "beyond" | "undated";

export const ROADMAP_HORIZON_META: Record<
  RoadmapHorizon,
  { label: string; description: string; order: number }
> = {
  overdue: { label: "Overdue", description: "Target date passed, not complete", order: 0 },
  quarter: { label: "This quarter", description: "Within ~90 days", order: 1 },
  half: { label: "This semester", description: "Within ~180 days", order: 2 },
  year: { label: "This year", description: "Within ~365 days", order: 3 },
  beyond: { label: "Beyond", description: "More than a year out", order: 4 },
  undated: { label: "No target date", description: "Not yet scheduled", order: 5 },
};

export type RoadmapItemKind = "milestone" | "initiative_target";

export type RoadmapItem = {
  id: string;
  title: string;
  kind: RoadmapItemKind;
  phase: RoadmapPhase;
  status: MilestoneStatus | null;
  targetDateISO: string | null;
  horizon: RoadmapHorizon;
  percent: number;
  behindSchedule: boolean;
  workstreamId: string | null;
  /** Display order within the roadmap (milestone order; the target sorts last). */
  order: number;
  href: string;
};

export type InitiativeRoadmap = {
  items: RoadmapItem[];
  byPhase: Record<RoadmapPhase, RoadmapItem[]>;
  byHorizon: Record<RoadmapHorizon, RoadmapItem[]>;
  counts: {
    completed: number;
    inProgress: number;
    upcoming: number;
    atRisk: number;
    blocked: number;
    overdue: number;
  };
};

const PHASE_FROM_STATUS: Record<MilestoneStatus, RoadmapPhase> = {
  complete: "completed",
  in_progress: "in_progress",
  not_started: "upcoming",
  at_risk: "at_risk",
  blocked: "blocked",
};

function horizonFor(
  targetDateISO: string | null,
  complete: boolean,
  now: Date
): RoadmapHorizon {
  if (!targetDateISO) return "undated";
  const target = new Date(targetDateISO);
  const days = daysUntil(target, now);
  if (days == null) return "undated";
  if (days < 0) return complete ? "year" : "overdue";
  if (days <= 90) return "quarter";
  if (days <= 180) return "half";
  if (days <= 365) return "year";
  return "beyond";
}

function emptyPhases(): Record<RoadmapPhase, RoadmapItem[]> {
  return { completed: [], in_progress: [], upcoming: [], at_risk: [], blocked: [] };
}

function emptyHorizons(): Record<RoadmapHorizon, RoadmapItem[]> {
  return { overdue: [], quarter: [], half: [], year: [], beyond: [], undated: [] };
}

/**
 * Build the initiative roadmap from its milestones + configured target. Pure.
 * The initiative's own target date is added as a final "initiative_target" item
 * so the roadmap always shows the finish line, not just the checkpoints.
 */
export function deriveInitiativeRoadmap(input: {
  def: StrategicInitiativeDef;
  milestones: InitiativeMilestoneSummary[];
  now?: Date;
}): InitiativeRoadmap {
  const now = input.now ?? new Date();
  const { def } = input;
  const wsById = new Map(def.milestones.map((m) => [m.id, m.workstreamId ?? null]));

  const items: RoadmapItem[] = input.milestones.map((m) => {
    const phase = PHASE_FROM_STATUS[m.status];
    return {
      id: `milestone:${m.id}`,
      title: m.title,
      kind: "milestone" as const,
      phase,
      status: m.status,
      targetDateISO: m.targetDateISO,
      horizon: horizonFor(m.targetDateISO, m.status === "complete", now),
      percent: m.percent,
      behindSchedule: m.behindSchedule,
      workstreamId: wsById.get(m.id) ?? null,
      order: m.order,
      href: `${initiativeHref(def.id)}#milestone-${m.id}`,
    };
  });

  if (def.targetDateISO) {
    const allComplete =
      input.milestones.length > 0 && input.milestones.every((m) => m.status === "complete");
    const past = new Date(def.targetDateISO).getTime() < startOfDay(now).getTime();
    items.push({
      id: `initiative_target:${def.id}`,
      title: `${def.title} — target`,
      kind: "initiative_target",
      phase: allComplete ? "completed" : past ? "at_risk" : "upcoming",
      status: null,
      targetDateISO: def.targetDateISO,
      horizon: horizonFor(def.targetDateISO, allComplete, now),
      percent: allComplete ? 100 : 0,
      behindSchedule: past && !allComplete,
      workstreamId: null,
      order: Number.MAX_SAFE_INTEGER,
      href: initiativeHref(def.id),
    });
  }

  items.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));

  const byPhase = emptyPhases();
  const byHorizon = emptyHorizons();
  for (const item of items) {
    byPhase[item.phase].push(item);
    byHorizon[item.horizon].push(item);
  }

  return {
    items,
    byPhase,
    byHorizon,
    counts: {
      completed: byPhase.completed.length,
      inProgress: byPhase.in_progress.length,
      upcoming: byPhase.upcoming.length,
      atRisk: byPhase.at_risk.length,
      blocked: byPhase.blocked.length,
      overdue: byHorizon.overdue.length,
    },
  };
}
