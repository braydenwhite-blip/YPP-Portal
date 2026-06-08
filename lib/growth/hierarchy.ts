/**
 * Student Operating System / Growth Engine (Phase N1) — hierarchy rollup math.
 *
 * Pure functions over plain node shapes (decoupled from Prisma) that turn a
 * Vision -> Goal -> Milestone -> Action tree into progress numbers, the "what's
 * next" / "what's blocked" / "recently accomplished" lists the /my-growth
 * command center renders, and per-vision/goal summaries. Deterministic: same
 * tree always yields the same numbers. No IO.
 *
 * Rollup rules (see docs/student-os/N1-STUDENT-OPERATING-SYSTEM.md §1):
 *   - Milestone progress = done / (non-DROPPED actions). An ACHIEVED milestone
 *     reads as 1 regardless.
 *   - Goal progress pools ALL its leaf actions (milestone actions + direct
 *     actions) so a goal reads identically whether modeled flat or nested. An
 *     ACHIEVED goal reads as 1 regardless.
 *   - Vision progress = mean of its non-ARCHIVED goals' ratios.
 */

import {
  actionStatusIsComplete,
  actionStatusIsCountable,
  actionStatusIsOpen,
  clamp01,
  normalizeActionStatus,
  type GrowthObjectiveStatus,
} from "./constants";

/* ------------------------------- input shapes ------------------------------ */

export interface HierarchyAction {
  id: string;
  title?: string;
  status: string;
  order?: number;
  dueDate?: string | Date | null;
  milestoneId?: string | null;
  goalId?: string | null;
  completedAt?: string | Date | null;
}

export interface HierarchyMilestone {
  id: string;
  title?: string;
  status?: string;
  order?: number;
  actions: HierarchyAction[];
}

export interface HierarchyGoal {
  id: string;
  title?: string;
  status?: string;
  order?: number;
  targetDate?: string | Date | null;
  milestones: HierarchyMilestone[];
  directActions: HierarchyAction[];
}

export interface HierarchyVision {
  id: string;
  title?: string;
  status?: string;
  order?: number;
  goals: HierarchyGoal[];
}

/* --------------------------------- output ---------------------------------- */

export interface Progress {
  total: number;
  done: number;
  /** 0..1 completion ratio. */
  ratio: number;
}

function isAchieved(status: string | undefined): boolean {
  return (status as GrowthObjectiveStatus | undefined) === "ACHIEVED";
}

function isArchived(status: string | undefined): boolean {
  return (status as GrowthObjectiveStatus | undefined) === "ARCHIVED";
}

function progressFromActions(actions: HierarchyAction[]): Progress {
  const countable = actions.filter((a) => actionStatusIsCountable(a.status));
  const total = countable.length;
  const done = countable.filter((a) => actionStatusIsComplete(a.status)).length;
  return { total, done, ratio: total > 0 ? clamp01(done / total) : 0 };
}

/** Progress of a single milestone. An ACHIEVED milestone is always 1. */
export function milestoneProgress(milestone: HierarchyMilestone): Progress {
  const base = progressFromActions(milestone.actions ?? []);
  if (isAchieved(milestone.status)) {
    return { total: base.total, done: base.total, ratio: 1 };
  }
  return base;
}

/** Every leaf action under a goal (milestone actions + direct actions). */
export function goalActions(goal: HierarchyGoal): HierarchyAction[] {
  const fromMilestones = (goal.milestones ?? []).flatMap((m) => m.actions ?? []);
  return [...fromMilestones, ...(goal.directActions ?? [])];
}

/** Progress of a goal — pools all its leaf actions. ACHIEVED is always 1. */
export function goalProgress(goal: HierarchyGoal): Progress {
  const base = progressFromActions(goalActions(goal));
  if (isAchieved(goal.status)) {
    return { total: base.total, done: base.total, ratio: 1 };
  }
  return base;
}

/** Progress of a vision — mean of its non-ARCHIVED goals' ratios. */
export function visionProgress(vision: HierarchyVision): Progress {
  const goals = (vision.goals ?? []).filter((g) => !isArchived(g.status));
  if (goals.length === 0) {
    return { total: 0, done: 0, ratio: isAchieved(vision.status) ? 1 : 0 };
  }
  const ratios = goals.map((g) => goalProgress(g).ratio);
  const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
  // total/done aggregate the underlying leaf actions for display.
  const allActions = goals.flatMap((g) => goalActions(g));
  const base = progressFromActions(allActions);
  return { total: base.total, done: base.done, ratio: clamp01(mean) };
}

/* ----------------------------- selection helpers --------------------------- */

function byOrderThenId(a: { order?: number; id: string }, b: { order?: number; id: string }): number {
  const ao = a.order ?? 0;
  const bo = b.order ?? 0;
  if (ao !== bo) return ao - bo;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * The student's next concrete steps: open actions (IN_PROGRESS ranked ahead of
 * TODO), deterministically ordered, limited. Drives "What should I do next?".
 */
export function nextActions(actions: HierarchyAction[], limit = 5): HierarchyAction[] {
  const open = (actions ?? []).filter((a) => actionStatusIsOpen(a.status));
  const inProgress = open
    .filter((a) => normalizeActionStatus(a.status) === "IN_PROGRESS")
    .sort(byOrderThenId);
  const todo = open
    .filter((a) => normalizeActionStatus(a.status) === "TODO")
    .sort(byOrderThenId);
  return [...inProgress, ...todo].slice(0, Math.max(0, limit));
}

/** Actions explicitly marked BLOCKED. Drives "What is blocked?". */
export function blockedActions(actions: HierarchyAction[]): HierarchyAction[] {
  return (actions ?? [])
    .filter((a) => normalizeActionStatus(a.status) === "BLOCKED")
    .sort(byOrderThenId);
}

/** Recently completed actions (DONE), newest first by completedAt. */
export function recentlyCompleted(
  actions: HierarchyAction[],
  limit = 5
): HierarchyAction[] {
  return (actions ?? [])
    .filter((a) => actionStatusIsComplete(a.status))
    .sort((a, b) => completedTime(b) - completedTime(a))
    .slice(0, Math.max(0, limit));
}

function completedTime(a: HierarchyAction): number {
  if (!a.completedAt) return 0;
  const t = new Date(a.completedAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Goals that are past their target date and not yet complete (and still ACTIVE).
 * Drives the stalled-goal nudge in the opportunity engine + the blocked panel.
 */
export function pastDueGoals(
  goals: HierarchyGoal[],
  now: Date = new Date()
): { goal: HierarchyGoal; ratio: number }[] {
  const nowMs = now.getTime();
  const out: { goal: HierarchyGoal; ratio: number }[] = [];
  for (const goal of goals ?? []) {
    if (isArchived(goal.status) || isAchieved(goal.status)) continue;
    if (!goal.targetDate) continue;
    const due = new Date(goal.targetDate).getTime();
    if (!Number.isFinite(due) || due >= nowMs) continue;
    const ratio = goalProgress(goal).ratio;
    if (ratio >= 1) continue;
    out.push({ goal, ratio });
  }
  return out.sort((a, b) => byOrderThenId(a.goal, b.goal));
}

/* -------------------------------- summary ---------------------------------- */

export interface HierarchySummary {
  visionCount: number;
  goalCount: number;
  activeGoalCount: number;
  achievedGoalCount: number;
  milestoneCount: number;
  totalActions: number;
  doneActions: number;
  openActions: number;
  blockedActions: number;
  /** 0..1 overall completion across all non-DROPPED leaf actions. */
  overallRatio: number;
}

/**
 * One pass over the whole tree (visions + any goals not under a vision) for the
 * dashboard header. `looseGoals` are goals with no parent vision.
 */
export function summarizeHierarchy(
  visions: HierarchyVision[],
  looseGoals: HierarchyGoal[] = []
): HierarchySummary {
  const allGoals = [
    ...(visions ?? []).flatMap((v) => v.goals ?? []),
    ...(looseGoals ?? []),
  ];
  const allActions = allGoals.flatMap((g) => goalActions(g));
  const countable = allActions.filter((a) => actionStatusIsCountable(a.status));
  const done = countable.filter((a) => actionStatusIsComplete(a.status)).length;
  const open = allActions.filter((a) => actionStatusIsOpen(a.status)).length;
  const blocked = allActions.filter(
    (a) => normalizeActionStatus(a.status) === "BLOCKED"
  ).length;

  return {
    visionCount: (visions ?? []).length,
    goalCount: allGoals.length,
    activeGoalCount: allGoals.filter(
      (g) => !isArchived(g.status) && !isAchieved(g.status)
    ).length,
    achievedGoalCount: allGoals.filter((g) => isAchieved(g.status)).length,
    milestoneCount: allGoals.reduce((n, g) => n + (g.milestones?.length ?? 0), 0),
    totalActions: countable.length,
    doneActions: done,
    openActions: open,
    blockedActions: blocked,
    overallRatio: countable.length > 0 ? clamp01(done / countable.length) : 0,
  };
}
