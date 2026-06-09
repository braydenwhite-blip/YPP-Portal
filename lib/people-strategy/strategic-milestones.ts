import { addDays, startOfDay } from "@/lib/leadership-action-center/dates";

import type { ActionItemWithRelations } from "./action-queries";
import { effectiveStatus } from "./action-filters";
import { isActionOverdue } from "./my-actions-selectors";
import { STALE_ACTIVITY_DAYS } from "./command-center-selectors";
import type { MeetingCardDTO } from "./meetings-queries";
import type { DigestDecisionInput } from "./operational-digest";
import {
  computeOperationalHealth,
  type OperationalHealth,
} from "./operational-context";
import {
  actionToMatchable,
  decisionToMatchable,
  matchWork,
  meetingToMatchable,
  type InitiativeMilestoneDef,
  type StrategicInitiativeDef,
} from "./strategic-initiatives";

/**
 * YPP Execution OS — MILESTONE SYSTEM (Phase D).
 *
 * Milestones sit ABOVE actions inside an initiative ("Secure Camp Partners",
 * "Run Pilot"). They are never entered by hand: each milestone declares a match
 * and DETERMINISTICALLY aggregates the subset of its initiative's already-loaded
 * work (actions, and — for context — meetings + decisions) that matches it. From
 * that real work it derives completion %, status, health, open / blocked counts,
 * ownership, and a behind-schedule flag. Pure (only the injected `now`), so it
 * unit-tests with plain fixtures and never touches the DB.
 */

export type MilestoneStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "at_risk"
  | "complete";

export const MILESTONE_STATUS_META: Record<
  MilestoneStatus,
  { label: string; tone: "success" | "info" | "warning" | "overdue" | "neutral"; rank: number }
> = {
  complete: { label: "Complete", tone: "success", rank: 0 },
  in_progress: { label: "In progress", tone: "info", rank: 1 },
  not_started: { label: "Not started", tone: "neutral", rank: 2 },
  at_risk: { label: "At risk", tone: "warning", rank: 3 },
  blocked: { label: "Blocked", tone: "overdue", rank: 4 },
};

export type InitiativeMilestoneSummary = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  targetDateISO: string | null;
  status: MilestoneStatus;
  statusLabel: string;
  /** 0–100 share of the milestone's tracked actions that are complete. */
  percent: number;
  totalActions: number;
  openActions: number;
  completedActions: number;
  blockedActions: number;
  overdueActions: number;
  unassignedActions: number;
  meetingCount: number;
  decisionCount: number;
  health: OperationalHealth;
  /** Declared milestone owner, else the dominant lead among its open actions. */
  ownerName: string | null;
  /** Target date has passed while the milestone is not complete. */
  behindSchedule: boolean;
  /** Stable ids of the actions rolled up here (for the detail drill-down). */
  actionIds: string[];
};

type MilestoneCounts = {
  total: number;
  open: number;
  notStarted: number;
  inProgress: number;
  blocked: number;
  overdue: number;
  unassigned: number;
  stale: number;
  completed: number;
  dropped: number;
  ownerName: string | null;
};

function isUnassigned(item: ActionItemWithRelations): boolean {
  return !item.assignments.some((a) => a.role === "EXECUTING");
}

/** One pass over a milestone's matched actions → the counts the summary needs. */
function countMilestoneActions(
  actions: ActionItemWithRelations[],
  now: Date
): MilestoneCounts {
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  const leadCounts = new Map<string, number>();
  const counts: MilestoneCounts = {
    total: actions.length,
    open: 0,
    notStarted: 0,
    inProgress: 0,
    blocked: 0,
    overdue: 0,
    unassigned: 0,
    stale: 0,
    completed: 0,
    dropped: 0,
    ownerName: null,
  };
  for (const a of actions) {
    const status = effectiveStatus(a, now);
    if (status === "COMPLETE") {
      counts.completed += 1;
      continue;
    }
    if (status === "DROPPED") {
      counts.dropped += 1;
      continue;
    }
    counts.open += 1;
    if (status === "NOT_STARTED") counts.notStarted += 1;
    else counts.inProgress += 1;
    if (status === "BLOCKED") counts.blocked += 1;
    if (isActionOverdue(a, now)) counts.overdue += 1;
    if (isUnassigned(a)) counts.unassigned += 1;
    if (a.updatedAt.getTime() < staleCutoff) counts.stale += 1;
    const lead = a.lead?.name ?? a.lead?.email ?? null;
    if (lead) leadCounts.set(lead, (leadCounts.get(lead) ?? 0) + 1);
  }
  let topLead: string | null = null;
  let topCount = 0;
  for (const [name, n] of leadCounts) {
    if (n > topCount || (n === topCount && (topLead == null || name < topLead))) {
      topLead = name;
      topCount = n;
    }
  }
  counts.ownerName = topLead;
  return counts;
}

function deriveMilestoneStatus(counts: MilestoneCounts, behindSchedule: boolean): MilestoneStatus {
  const tracked = counts.completed + counts.open;
  if (tracked === 0) return "not_started";
  if (counts.open === 0 && counts.completed > 0) return "complete";
  if (counts.blocked > 0) return "blocked";
  if (counts.overdue > 0 || behindSchedule) return "at_risk";
  if (counts.completed > 0 || counts.inProgress > 0) return "in_progress";
  return "not_started";
}

/**
 * Build the summary for one milestone from its initiative's loaded work. Actions
 * drive completion + status + health; meetings and decisions are counted for
 * context. Pure.
 */
export function deriveMilestone(input: {
  def: InitiativeMilestoneDef;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  now?: Date;
}): InitiativeMilestoneSummary {
  const now = input.now ?? new Date();
  const { def } = input;

  const actions = input.actions.filter((a) => matchWork(actionToMatchable(a), def.match).matched);
  const meetings = input.meetings.filter((m) => matchWork(meetingToMatchable(m), def.match).matched);
  const decisions = input.decisions.filter(
    (d) => matchWork(decisionToMatchable(d), def.match).matched
  );

  const counts = countMilestoneActions(actions, now);
  const tracked = counts.completed + counts.open;
  const percent = tracked === 0 ? 0 : Math.round((counts.completed / tracked) * 100);

  const behindSchedule =
    Boolean(def.targetDateISO) &&
    new Date(def.targetDateISO as string).getTime() < startOfDay(now).getTime() &&
    !(counts.open === 0 && counts.completed > 0);

  const status = deriveMilestoneStatus(counts, behindSchedule);

  const health = computeOperationalHealth({
    openActions: counts.open,
    overdueActions: counts.overdue,
    blockedActions: counts.blocked,
    unassignedActions: counts.unassigned,
    staleActions: counts.stale,
  });

  return {
    id: def.id,
    title: def.title,
    description: def.description ?? null,
    order: def.order,
    targetDateISO: def.targetDateISO ?? null,
    status,
    statusLabel: MILESTONE_STATUS_META[status].label,
    percent,
    totalActions: counts.total,
    openActions: counts.open,
    completedActions: counts.completed,
    blockedActions: counts.blocked,
    overdueActions: counts.overdue,
    unassignedActions: counts.unassigned,
    meetingCount: meetings.length,
    decisionCount: decisions.length,
    health,
    ownerName: def.owner?.trim() || counts.ownerName,
    behindSchedule,
    actionIds: actions.map((a) => a.id),
  };
}

/** All of an initiative's milestones in roadmap order. Pure. */
export function deriveInitiativeMilestones(input: {
  def: StrategicInitiativeDef;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  now?: Date;
}): InitiativeMilestoneSummary[] {
  const now = input.now ?? new Date();
  return input.def.milestones
    .map((def) =>
      deriveMilestone({
        def,
        actions: input.actions,
        meetings: input.meetings,
        decisions: input.decisions,
        now,
      })
    )
    .sort((a, b) => a.order - b.order);
}

/** A milestone is "complete" for progress when it has work and none is open. */
export function milestoneIsComplete(m: InitiativeMilestoneSummary): boolean {
  return m.status === "complete";
}

/** Count milestones complete / behind schedule across an initiative. */
export function summarizeMilestones(milestones: InitiativeMilestoneSummary[]): {
  total: number;
  completed: number;
  behindSchedule: number;
} {
  return {
    total: milestones.length,
    completed: milestones.filter(milestoneIsComplete).length,
    behindSchedule: milestones.filter((m) => m.behindSchedule).length,
  };
}
