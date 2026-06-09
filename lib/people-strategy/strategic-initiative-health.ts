import { addDays, daysUntil, startOfDay } from "@/lib/leadership-action-center/dates";

import { ACTION_PRIORITY_WEIGHT } from "./constants";
import type { ActionItemWithRelations } from "./action-queries";
import { effectiveStatus } from "./action-filters";
import { effectiveDeadline, isActionOverdue } from "./my-actions-selectors";
import { daysOverdue, STALE_ACTIVITY_DAYS } from "./command-center-selectors";
import type { MeetingCardDTO } from "./meetings-queries";
import type { DigestDecisionInput } from "./operational-digest";
import {
  isTerminalStatus,
  type InitiativeStatus,
  type StrategicInitiativeDef,
} from "./strategic-initiatives";

/**
 * YPP Execution OS — Strategic Initiative HEALTH ENGINE (Phase E).
 *
 * The deterministic brain that turns one initiative's matched work (its actions,
 * meetings, and decisions) into the five leadership reads: PROGRESS, MOMENTUM,
 * RISK, OWNERSHIP, and the composite HEALTH — plus a plain-English explanation
 * of each. Every function is PURE (no DB, no session, no React, only the
 * injected `now`) so the whole module unit-tests with plain fixtures, and every
 * score is explainable from real signal counts — never AI-generated, never a
 * black box.
 *
 * It reuses the exact action/meeting semantics the rest of the OS uses
 * (`effectiveStatus`, the staleness window, overdue depth, priority weights) so
 * "overdue" / "blocked" / "stale" mean the same thing on an initiative as they
 * do on the Command Center.
 */

// --- tunable windows (documented so they can never silently drift) ----------

/** Days back a completion / new action counts toward momentum. */
export const INITIATIVE_MOMENTUM_WINDOW_DAYS = 14;
/** Days ahead an open action counts as "due soon" within an initiative. */
export const INITIATIVE_DUE_SOON_DAYS = 7;
/** Days since the last meeting past which an active initiative reads as quiet. */
export const INITIATIVE_QUIET_MEETING_DAYS = 21;

// --- raw work signals --------------------------------------------------------

const SETTLED = new Set(["COMPLETE", "DROPPED"]);

export type InitiativeWorkSignals = {
  totalActions: number;
  openActions: number;
  completedActions: number;
  droppedActions: number;
  overdueActions: number;
  blockedActions: number;
  unassignedActions: number;
  staleActions: number;
  dueSoonActions: number;
  highPriorityOpen: number;
  /** Completed within the momentum window (recent wins). */
  recentlyCompletedActions: number;
  /** Created within the momentum window (recent intake). */
  recentlyCreatedActions: number;
  /** Latest of any action create/update — null when no work. */
  lastActivityAt: Date | null;
  /** Latest completion timestamp — null when nothing completed. */
  lastCompletionAt: Date | null;
  meetingCount: number;
  recentMeetings: number;
  upcomingMeetings: number;
  openFollowUps: number;
  overdueFollowUps: number;
  daysSinceLastMeeting: number | null;
  decisionCount: number;
  recentDecisions: number;
  decisionsWithoutAction: number;
};

function isUnassigned(item: ActionItemWithRelations): boolean {
  return !item.assignments.some((a) => a.role === "EXECUTING");
}

function completionTime(item: ActionItemWithRelations): Date {
  return item.completedAt ?? item.updatedAt;
}

/**
 * Reduce one initiative's classified work to the raw signal counts every
 * downstream read consumes. One pass over each list; pure.
 */
export function computeInitiativeWorkSignals(input: {
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  now?: Date;
}): InitiativeWorkSignals {
  const now = input.now ?? new Date();
  const todayStart = startOfDay(now).getTime();
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  const momentumCutoff = addDays(now, -INITIATIVE_MOMENTUM_WINDOW_DAYS).getTime();
  const dueSoonEnd = startOfDay(addDays(now, INITIATIVE_DUE_SOON_DAYS)).getTime();
  const highWeight = ACTION_PRIORITY_WEIGHT.HIGH;

  let openActions = 0;
  let completedActions = 0;
  let droppedActions = 0;
  let overdueActions = 0;
  let blockedActions = 0;
  let unassignedActions = 0;
  let staleActions = 0;
  let dueSoonActions = 0;
  let highPriorityOpen = 0;
  let recentlyCompletedActions = 0;
  let recentlyCreatedActions = 0;
  let lastActivityAt: number | null = null;
  let lastCompletionAt: number | null = null;

  for (const a of input.actions) {
    const status = effectiveStatus(a, now);
    const updated = a.updatedAt.getTime();
    if (lastActivityAt == null || updated > lastActivityAt) lastActivityAt = updated;
    if (a.createdAt.getTime() >= momentumCutoff) recentlyCreatedActions += 1;

    if (status === "COMPLETE") {
      completedActions += 1;
      const t = completionTime(a).getTime();
      if (lastCompletionAt == null || t > lastCompletionAt) lastCompletionAt = t;
      if (t >= momentumCutoff) recentlyCompletedActions += 1;
      continue;
    }
    if (status === "DROPPED") {
      droppedActions += 1;
      continue;
    }

    openActions += 1;
    if (status === "BLOCKED") blockedActions += 1;
    if (isUnassigned(a)) unassignedActions += 1;
    if (a.updatedAt.getTime() < staleCutoff) staleActions += 1;
    if (ACTION_PRIORITY_WEIGHT[a.priority] >= highWeight) highPriorityOpen += 1;
    if (isActionOverdue(a, now)) {
      overdueActions += 1;
    } else if (startOfDay(effectiveDeadline(a)).getTime() <= dueSoonEnd) {
      dueSoonActions += 1;
    }
  }

  let recentMeetings = 0;
  let upcomingMeetings = 0;
  let openFollowUps = 0;
  let overdueFollowUps = 0;
  let lastMeetingTime: number | null = null;
  const recentMeetingCutoff = addDays(now, -INITIATIVE_MOMENTUM_WINDOW_DAYS).getTime();
  for (const m of input.meetings) {
    openFollowUps += m.openFollowUps;
    overdueFollowUps += m.overdueFollowUps;
    const start = new Date(m.startISO).getTime();
    if (m.effectiveStatus !== "canceled" && start >= todayStart) {
      upcomingMeetings += 1;
    }
    if (start < todayStart) {
      if (lastMeetingTime == null || start > lastMeetingTime) lastMeetingTime = start;
      if (start >= recentMeetingCutoff) recentMeetings += 1;
    }
  }

  let recentDecisions = 0;
  let decisionsWithoutAction = 0;
  const recentDecisionCutoff = addDays(now, -INITIATIVE_MOMENTUM_WINDOW_DAYS).getTime();
  for (const d of input.decisions) {
    if (d.createdAt.getTime() >= recentDecisionCutoff) recentDecisions += 1;
    if (!d.hasLinkedAction) decisionsWithoutAction += 1;
  }

  return {
    totalActions: input.actions.length,
    openActions,
    completedActions,
    droppedActions,
    overdueActions,
    blockedActions,
    unassignedActions,
    staleActions,
    dueSoonActions,
    highPriorityOpen,
    recentlyCompletedActions,
    recentlyCreatedActions,
    lastActivityAt: lastActivityAt == null ? null : new Date(lastActivityAt),
    lastCompletionAt: lastCompletionAt == null ? null : new Date(lastCompletionAt),
    meetingCount: input.meetings.length,
    recentMeetings,
    upcomingMeetings,
    openFollowUps,
    overdueFollowUps,
    daysSinceLastMeeting:
      lastMeetingTime == null ? null : (daysUntil(new Date(lastMeetingTime), now) ?? 0) * -1,
    decisionCount: input.decisions.length,
    recentDecisions,
    decisionsWithoutAction,
  };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

// --- progress ----------------------------------------------------------------

export type InitiativeProgress = {
  /** 0–100 share of tracked (completed + open) work that is complete. */
  percent: number;
  completedActions: number;
  openActions: number;
  totalTracked: number;
  completedMilestones: number;
  totalMilestones: number;
  /** 0–100 milestone completion, or null when the initiative has no milestones. */
  milestonePercent: number | null;
  /** What the headline percent was computed from, for the explanation. */
  basis: "actions" | "no_work";
};

/**
 * Share of an initiative's tracked work that is done. Dropped actions are
 * excluded (they were never "to do"). Milestone completion is reported alongside
 * (a milestone is complete when it has work and all of it is done). Pure.
 */
export function deriveInitiativeProgress(
  signals: InitiativeWorkSignals,
  milestones: { completed: number; total: number }
): InitiativeProgress {
  const totalTracked = signals.completedActions + signals.openActions;
  const percent = totalTracked === 0 ? 0 : Math.round((signals.completedActions / totalTracked) * 100);
  return {
    percent,
    completedActions: signals.completedActions,
    openActions: signals.openActions,
    totalTracked,
    completedMilestones: milestones.completed,
    totalMilestones: milestones.total,
    milestonePercent:
      milestones.total === 0 ? null : Math.round((milestones.completed / milestones.total) * 100),
    basis: totalTracked === 0 ? "no_work" : "actions",
  };
}

// --- momentum ----------------------------------------------------------------

export type InitiativeMomentumLevel = "accelerating" | "steady" | "slowing" | "stalled";

export type InitiativeMomentum = {
  level: InitiativeMomentumLevel;
  /** 0–100, higher = more energy. */
  score: number;
  recentlyCompleted: number;
  recentlyCreated: number;
  recentMeetings: number;
  daysSinceLastActivity: number | null;
  reasons: string[];
};

export const INITIATIVE_MOMENTUM_META: Record<
  InitiativeMomentumLevel,
  { label: string; tone: "success" | "info" | "warning" | "overdue"; rank: number }
> = {
  accelerating: { label: "Accelerating", tone: "success", rank: 0 },
  steady: { label: "Steady", tone: "info", rank: 1 },
  slowing: { label: "Slowing", tone: "warning", rank: 2 },
  stalled: { label: "Stalled", tone: "overdue", rank: 3 },
};

/**
 * How much energy an initiative has RIGHT NOW, from real recent activity in the
 * momentum window: completions (wins), new intake, and meetings.
 *
 *   - stalled       — open work exists but nothing has moved in the window.
 *   - slowing       — there is intake / meetings but no completions while work is open.
 *   - accelerating  — at least two recent wins, keeping pace with intake.
 *   - steady        — otherwise active.
 *
 * Pure + unit-tested.
 */
export function deriveInitiativeMomentum(
  signals: InitiativeWorkSignals,
  now: Date = new Date()
): InitiativeMomentum {
  const completed = signals.recentlyCompletedActions;
  const created = signals.recentlyCreatedActions;
  const meetings = signals.recentMeetings;
  const open = signals.openActions;
  const daysSinceLastActivity =
    signals.lastActivityAt == null
      ? null
      : (daysUntil(signals.lastActivityAt, now) ?? 0) * -1;

  const anyActivity = completed > 0 || created > 0 || meetings > 0;

  let level: InitiativeMomentumLevel;
  const reasons: string[] = [];
  if (!anyActivity && open > 0) {
    level = "stalled";
    reasons.push(
      daysSinceLastActivity == null
        ? "no recent activity on open work"
        : `nothing has moved in ${daysSinceLastActivity} days`
    );
  } else if (!anyActivity) {
    // No open work and no activity — calm, not stalled.
    level = "steady";
  } else if (completed >= 2 && completed >= created) {
    level = "accelerating";
    reasons.push(`${plural(completed, "win")} in the last ${INITIATIVE_MOMENTUM_WINDOW_DAYS} days`);
  } else if (completed === 0 && open > 0) {
    level = "slowing";
    if (created > 0) reasons.push(`${plural(created, "new action")} but no completions yet`);
    else if (meetings > 0) reasons.push("meetings happening but no completions");
    else reasons.push("no recent completions on open work");
  } else {
    level = "steady";
    if (completed > 0) reasons.push(`${plural(completed, "recent completion")}`);
  }

  if (meetings > 0 && level !== "stalled") {
    reasons.push(`${plural(meetings, "recent meeting")}`);
  }

  // Score: wins lift, intake-without-wins and staleness drag. Clamped 0–100.
  let score = 50;
  score += Math.min(completed, 6) * 9;
  score += Math.min(meetings, 3) * 3;
  if (completed === 0 && open > 0) score -= 20;
  if (!anyActivity && open > 0) score -= 25;
  if (created > completed) score -= Math.min(created - completed, 5) * 3;
  if (daysSinceLastActivity != null && daysSinceLastActivity > INITIATIVE_MOMENTUM_WINDOW_DAYS) {
    score -= 10;
  }
  score = Math.max(0, Math.min(100, score));

  return {
    level,
    score,
    recentlyCompleted: completed,
    recentlyCreated: created,
    recentMeetings: meetings,
    daysSinceLastActivity,
    reasons,
  };
}

// --- risk --------------------------------------------------------------------

export type InitiativeRiskLevel = "low" | "moderate" | "elevated" | "high";

export type InitiativeRiskFactor = {
  key: string;
  label: string;
  /** Points this factor contributed to the risk score. */
  weight: number;
};

export type InitiativeRisk = {
  level: InitiativeRiskLevel;
  /** 0–100, higher = more at risk. */
  score: number;
  factors: InitiativeRiskFactor[];
};

export const INITIATIVE_RISK_META: Record<
  InitiativeRiskLevel,
  { label: string; tone: "success" | "info" | "warning" | "overdue"; rank: number }
> = {
  low: { label: "Low risk", tone: "success", rank: 0 },
  moderate: { label: "Moderate risk", tone: "info", rank: 1 },
  elevated: { label: "Elevated risk", tone: "warning", rank: 2 },
  high: { label: "High risk", tone: "overdue", rank: 3 },
};

export type InitiativeRiskContext = {
  /** Milestones whose target date has passed while still incomplete. */
  milestonesBehindSchedule?: number;
  /** Entities inside the initiative whose operational health is critical. */
  criticalEntities?: number;
  /** True when the initiative's own target date has passed and it is not complete. */
  pastTargetDate?: boolean;
  momentum?: InitiativeMomentum;
};

/**
 * A deterministic, additive risk score from the things that actually threaten
 * delivery: overdue + blocked work, unowned work, stale work, decisions that
 * never became action, schedule slippage, quiet execution, critical entities,
 * and stalled momentum. Every contributing factor is returned so the score is
 * fully explainable. Pure + unit-tested.
 */
export function deriveInitiativeRisk(
  signals: InitiativeWorkSignals,
  context: InitiativeRiskContext = {}
): InitiativeRisk {
  const factors: InitiativeRiskFactor[] = [];
  const add = (key: string, label: string, weight: number) => {
    if (weight > 0) factors.push({ key, label, weight });
  };

  add("overdue", `${plural(signals.overdueActions, "overdue action")}`, signals.overdueActions * 12);
  add("blocked", `${plural(signals.blockedActions, "blocked action")}`, signals.blockedActions * 8);
  add(
    "overdueFollowUps",
    `${plural(signals.overdueFollowUps, "overdue follow-up")}`,
    signals.overdueFollowUps * 8
  );
  add(
    "unassigned",
    `${plural(signals.unassignedActions, "action")} with no owner`,
    signals.unassignedActions * 5
  );
  add("stale", `${plural(signals.staleActions, "stale action")}`, signals.staleActions * 4);
  add(
    "decisions",
    `${plural(signals.decisionsWithoutAction, "decision")} not converted to action`,
    signals.decisionsWithoutAction * 4
  );

  const behind = Math.max(0, context.milestonesBehindSchedule ?? 0);
  add("milestones", `${plural(behind, "milestone")} behind schedule`, behind * 10);

  const critical = Math.max(0, context.criticalEntities ?? 0);
  add("criticalEntities", `${plural(critical, "critical entity", "critical entities")}`, critical * 10);

  if (context.pastTargetDate) add("pastTarget", "past its target date", 12);

  if (
    signals.openActions > 0 &&
    (signals.daysSinceLastMeeting == null || signals.daysSinceLastMeeting > INITIATIVE_QUIET_MEETING_DAYS)
  ) {
    add(
      "quiet",
      signals.daysSinceLastMeeting == null
        ? "no meeting on record while work is open"
        : `no meeting in ${signals.daysSinceLastMeeting} days`,
      8
    );
  }

  if (context.momentum?.level === "stalled" && signals.openActions > 0) {
    add("stalled", "momentum has stalled", 12);
  } else if (context.momentum?.level === "slowing" && signals.openActions > 0) {
    add("slowing", "momentum is slowing", 6);
  }

  const score = Math.max(0, Math.min(100, factors.reduce((s, f) => s + f.weight, 0)));
  factors.sort((a, b) => b.weight - a.weight);

  let level: InitiativeRiskLevel;
  if (score >= 45) level = "high";
  else if (score >= 22) level = "elevated";
  else if (score >= 8) level = "moderate";
  else level = "low";

  return { level, score, factors };
}

// --- ownership ---------------------------------------------------------------

export type InitiativeOwnershipClarity = "clear" | "shared" | "unclear" | "unowned";

export type InitiativeOwnership = {
  clarity: InitiativeOwnershipClarity;
  /** The accountable owner: the declared owner, else the dominant action lead. */
  ownerName: string | null;
  /** True when the owner came from the initiative config (vs derived from leads). */
  ownerDeclared: boolean;
  /** Distinct leads across open actions. */
  leadCount: number;
  /** Open actions with no EXECUTING owner. */
  unassignedOpen: number;
  /** Leads ranked by how many open actions they carry. */
  topLeads: Array<{ name: string; openActions: number }>;
  reason: string;
};

export const INITIATIVE_OWNERSHIP_META: Record<
  InitiativeOwnershipClarity,
  { label: string; tone: "success" | "info" | "warning" | "overdue" }
> = {
  clear: { label: "Clear ownership", tone: "success" },
  shared: { label: "Shared ownership", tone: "info" },
  unclear: { label: "Unclear ownership", tone: "warning" },
  unowned: { label: "Unowned", tone: "overdue" },
};

/**
 * How clearly an initiative is owned. A declared owner (or a single lead who
 * carries most of the open work) reads as CLEAR; a couple of even leads as
 * SHARED; many scattered leads with no anchor as UNCLEAR; open work nobody is
 * executing as UNOWNED. Pure + unit-tested.
 */
export function deriveInitiativeOwnership(
  actions: ActionItemWithRelations[],
  def: Pick<StrategicInitiativeDef, "owner">,
  now: Date = new Date()
): InitiativeOwnership {
  const leadCounts = new Map<string, number>();
  let openCount = 0;
  let unassignedOpen = 0;
  for (const a of actions) {
    const status = effectiveStatus(a, now);
    if (SETTLED.has(status)) continue;
    openCount += 1;
    if (isUnassigned(a)) unassignedOpen += 1;
    const lead = a.lead?.name ?? a.lead?.email ?? null;
    if (lead) leadCounts.set(lead, (leadCounts.get(lead) ?? 0) + 1);
  }
  const topLeads = [...leadCounts.entries()]
    .map(([name, openActions]) => ({ name, openActions }))
    .sort((a, b) => b.openActions - a.openActions || a.name.localeCompare(b.name));
  const leadCount = topLeads.length;
  const declared = def.owner?.trim() || null;

  let clarity: InitiativeOwnershipClarity;
  let ownerName: string | null;
  let ownerDeclared = false;
  let reason: string;

  if (openCount === 0) {
    clarity = declared ? "clear" : "clear";
    ownerName = declared ?? (topLeads[0]?.name ?? null);
    ownerDeclared = Boolean(declared);
    reason = declared
      ? `Owned by ${declared}`
      : "No open work to own right now";
  } else if (declared) {
    ownerName = declared;
    ownerDeclared = true;
    if (unassignedOpen >= Math.ceil(openCount / 2)) {
      clarity = "unclear";
      reason = `${declared} owns the initiative but ${plural(unassignedOpen, "open action")} have no executor`;
    } else {
      clarity = "clear";
      reason = `Owned by ${declared}`;
    }
  } else if (leadCount === 0) {
    clarity = "unowned";
    ownerName = null;
    reason = `${plural(openCount, "open action")} with no owner`;
  } else {
    const dominant = topLeads[0];
    ownerName = dominant.name;
    if (dominant.openActions >= Math.ceil(openCount * 0.6)) {
      clarity = "clear";
      reason = `${dominant.name} leads most of the open work`;
    } else if (leadCount <= 3) {
      clarity = "shared";
      reason = `Shared across ${plural(leadCount, "lead")} — no single accountable owner`;
    } else {
      clarity = "unclear";
      reason = `Spread across ${plural(leadCount, "lead")} with no clear owner`;
    }
  }

  if (clarity !== "unowned" && unassignedOpen === openCount && openCount > 0 && !declared) {
    clarity = "unowned";
    ownerName = null;
    reason = `${plural(openCount, "open action")} with no executor`;
  }

  return {
    clarity,
    ownerName,
    ownerDeclared,
    leadCount,
    unassignedOpen,
    topLeads: topLeads.slice(0, 4),
    reason,
  };
}

// --- composite health --------------------------------------------------------

export type InitiativeHealthLevel =
  | "healthy"
  | "drifting"
  | "at_risk"
  | "critical"
  | "completed"
  | "archived";

export type InitiativeHealthTone = "success" | "info" | "warning" | "overdue" | "neutral";

export const INITIATIVE_HEALTH_META: Record<
  InitiativeHealthLevel,
  { label: string; tone: InitiativeHealthTone; rank: number }
> = {
  // rank: higher = more concerning (terminal states sort calm, below healthy).
  archived: { label: "Archived", tone: "neutral", rank: -2 },
  completed: { label: "Completed", tone: "success", rank: -1 },
  healthy: { label: "Healthy", tone: "success", rank: 0 },
  drifting: { label: "Drifting", tone: "info", rank: 1 },
  at_risk: { label: "At risk", tone: "warning", rank: 2 },
  critical: { label: "Critical", tone: "overdue", rank: 3 },
};

export type InitiativeHealth = {
  level: InitiativeHealthLevel;
  label: string;
  tone: InitiativeHealthTone;
  /** 0–100, 100 = perfectly healthy. */
  score: number;
  reasons: string[];
};

export type DeriveInitiativeHealthInput = {
  status: InitiativeStatus;
  signals: InitiativeWorkSignals;
  risk: InitiativeRisk;
  momentum: InitiativeMomentum;
  ownership: InitiativeOwnership;
  /** Milestones whose target date has passed while incomplete. */
  milestonesBehindSchedule?: number;
  /** Entities inside the initiative whose operational health is critical. */
  criticalEntities?: number;
};

/**
 * The composite, deterministic initiative health. Terminal statuses
 * (completed / archived) short-circuit to a calm terminal read. Otherwise the
 * level is derived from the same overdue/blocked/stale signals the rest of the
 * OS uses, sharpened by risk, momentum, and ownership:
 *
 *   - critical — 3+ overdue, or overdue while 2+ blocked, or 2+ critical
 *                entities, or high risk with stalled momentum.
 *   - at risk  — any overdue / blocked / overdue follow-up, 3+ stale, unowned
 *                open work, a milestone behind schedule, or elevated+ risk.
 *   - drifting — open work that is quiet / slowing / has unconverted decisions /
 *                unowned tail / no recent meeting (moving, but losing the thread).
 *   - healthy  — open work moving well, or nothing concerning.
 *
 * Pure + unit-tested.
 */
export function deriveInitiativeHealth(
  input: DeriveInitiativeHealthInput
): InitiativeHealth {
  const { status, signals, risk, momentum, ownership } = input;
  if (isTerminalStatus(status)) {
    const meta = INITIATIVE_HEALTH_META[status === "completed" ? "completed" : "archived"];
    return {
      level: status === "completed" ? "completed" : "archived",
      label: meta.label,
      tone: meta.tone,
      score: status === "completed" ? 100 : 0,
      reasons: [],
    };
  }

  const behind = Math.max(0, input.milestonesBehindSchedule ?? 0);
  const critical = Math.max(0, input.criticalEntities ?? 0);
  const hasOpen = signals.openActions > 0;

  const reasons: string[] = [];
  if (signals.overdueActions > 0) reasons.push(`${plural(signals.overdueActions, "overdue action")}`);
  if (signals.blockedActions > 0) reasons.push(`${plural(signals.blockedActions, "blocked action")}`);
  if (signals.overdueFollowUps > 0) {
    reasons.push(`${plural(signals.overdueFollowUps, "overdue follow-up")}`);
  }
  if (behind > 0) reasons.push(`${plural(behind, "milestone")} behind schedule`);
  if (critical > 0) reasons.push(`${plural(critical, "critical entity", "critical entities")}`);
  if (ownership.clarity === "unowned") reasons.push("open work with no owner");
  if (signals.staleActions > 0) reasons.push(`${plural(signals.staleActions, "stale action")}`);
  if (signals.decisionsWithoutAction > 0) {
    reasons.push(`${plural(signals.decisionsWithoutAction, "decision")} not yet actioned`);
  }
  if (momentum.level === "stalled" && hasOpen) reasons.push("momentum stalled");
  else if (momentum.level === "slowing" && hasOpen) reasons.push("momentum slowing");
  if (
    hasOpen &&
    (signals.daysSinceLastMeeting == null ||
      signals.daysSinceLastMeeting > INITIATIVE_QUIET_MEETING_DAYS)
  ) {
    reasons.push(
      signals.daysSinceLastMeeting == null
        ? "no meeting on record"
        : `no meeting in ${signals.daysSinceLastMeeting} days`
    );
  }

  let level: InitiativeHealthLevel;
  if (
    signals.overdueActions >= 3 ||
    signals.overdueFollowUps >= 3 ||
    (signals.overdueActions >= 1 && signals.blockedActions >= 2) ||
    critical >= 2 ||
    (risk.level === "high" && momentum.level === "stalled")
  ) {
    level = "critical";
  } else if (
    signals.overdueActions >= 1 ||
    signals.blockedActions >= 1 ||
    signals.overdueFollowUps >= 1 ||
    signals.staleActions >= 3 ||
    behind >= 1 ||
    critical >= 1 ||
    (ownership.clarity === "unowned" && hasOpen) ||
    risk.level === "elevated" ||
    risk.level === "high"
  ) {
    level = "at_risk";
  } else if (
    hasOpen &&
    (momentum.level === "stalled" ||
      momentum.level === "slowing" ||
      signals.decisionsWithoutAction > 0 ||
      signals.unassignedActions > 0 ||
      signals.staleActions > 0 ||
      signals.daysSinceLastMeeting == null ||
      signals.daysSinceLastMeeting > INITIATIVE_QUIET_MEETING_DAYS)
  ) {
    level = "drifting";
  } else if (!hasOpen && signals.totalActions === 0 && status === "active") {
    // Active but no tracked work yet — quietly drifting (nothing is moving).
    level = "drifting";
    if (reasons.length === 0) reasons.push("no tracked work yet");
  } else {
    level = "healthy";
  }

  // Score: start full, subtract a blended penalty from risk + momentum drag.
  let score = 100 - Math.round(risk.score * 0.7);
  if (momentum.level === "stalled" && hasOpen) score -= 15;
  else if (momentum.level === "slowing" && hasOpen) score -= 8;
  if (momentum.level === "accelerating") score += 5;
  score = Math.max(0, Math.min(100, score));

  const meta = INITIATIVE_HEALTH_META[level];
  return {
    level,
    label: meta.label,
    tone: meta.tone,
    score,
    reasons: level === "healthy" ? [] : reasons,
  };
}

/** Compare two initiative healths worst (most concerning) first. */
export function compareInitiativeHealth(a: InitiativeHealth, b: InitiativeHealth): number {
  const byRank = INITIATIVE_HEALTH_META[b.level].rank - INITIATIVE_HEALTH_META[a.level].rank;
  if (byRank !== 0) return byRank;
  return a.score - b.score;
}

// --- explanation -------------------------------------------------------------

export type InitiativeHealthExplanation = {
  level: InitiativeHealthLevel;
  /** One sentence: "At risk because 2 actions are overdue and momentum is slowing." */
  headline: string;
  reasons: string[];
  suggestedNextSteps: string[];
};

const LEVEL_WORD: Record<InitiativeHealthLevel, string> = {
  healthy: "Healthy",
  drifting: "Drifting",
  at_risk: "At risk",
  critical: "Critical",
  completed: "Completed",
  archived: "Archived",
};

function joinReasons(reasons: string[]): string {
  if (reasons.length === 0) return "there is open work";
  if (reasons.length === 1) return reasons[0];
  return `${reasons.slice(0, -1).join(", ")} and ${reasons[reasons.length - 1]}`;
}

/**
 * Turn an initiative's health + its derived reads into a short, deterministic
 * explanation: a one-line headline, the contributing reasons, and concrete next
 * steps. Never AI-generated — same inputs, same words.
 */
export function explainInitiativeHealth(
  health: InitiativeHealth,
  input: Pick<DeriveInitiativeHealthInput, "signals" | "risk" | "momentum" | "ownership"> & {
    milestonesBehindSchedule?: number;
  }
): InitiativeHealthExplanation {
  const { signals, momentum, ownership } = input;

  if (health.level === "completed") {
    return {
      level: health.level,
      headline: "Completed — this initiative is done.",
      reasons: [],
      suggestedNextSteps: ["Capture the lessons learned and archive when ready"],
    };
  }
  if (health.level === "archived") {
    return {
      level: health.level,
      headline: "Archived — no longer active.",
      reasons: [],
      suggestedNextSteps: [],
    };
  }

  const steps: string[] = [];
  if (signals.overdueActions > 0 || signals.blockedActions > 0) {
    steps.push("Reassign, reschedule, or unblock the overdue work");
  }
  if (ownership.clarity === "unowned" || ownership.clarity === "unclear") {
    steps.push("Name a clear owner for the open work");
  }
  if (signals.decisionsWithoutAction > 0) {
    steps.push("Convert open decisions into tracked actions");
  }
  if (signals.overdueFollowUps > 0 || signals.openFollowUps > 0) {
    steps.push("Close out the open meeting follow-ups");
  }
  if (
    signals.openActions > 0 &&
    (signals.daysSinceLastMeeting == null ||
      signals.daysSinceLastMeeting > INITIATIVE_QUIET_MEETING_DAYS)
  ) {
    steps.push(
      signals.upcomingMeetings > 0
        ? "Use the upcoming meeting to get this back on track"
        : "Schedule a working session — nothing is on the calendar"
    );
  }
  if ((input.milestonesBehindSchedule ?? 0) > 0) {
    steps.push("Re-plan the milestones that have slipped past their target date");
  }
  if (momentum.level === "stalled" && signals.openActions > 0 && steps.length === 0) {
    steps.push("Pick one open action and drive it to done to restart momentum");
  }
  if (steps.length === 0) {
    steps.push(
      signals.upcomingMeetings > 0
        ? "Keep the rhythm — the next meeting is already scheduled"
        : "Keep the momentum going and schedule the next review"
    );
  }

  const word = LEVEL_WORD[health.level];
  const topReasons = health.reasons.slice(0, 2);
  const headline =
    health.level === "healthy" && health.reasons.length === 0
      ? "Healthy — work is moving and nothing is overdue."
      : `${word} because ${joinReasons(topReasons)}.`;

  return {
    level: health.level,
    headline,
    reasons: health.reasons,
    suggestedNextSteps: steps,
  };
}
