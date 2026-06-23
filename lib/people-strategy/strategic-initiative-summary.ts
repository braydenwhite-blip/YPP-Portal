import { startOfDay, addDays } from "@/lib/leadership-action-center/dates";

import type { ActionItemWithRelations } from "./action-queries";
import { sortByDeadline } from "./my-actions-selectors";
import type { MeetingCardDTO } from "./meeting-card-types";
import type { RelatedEntitySummary } from "./connections";
import { operationalAreaLabel, type OperationalArea } from "./operational-context";
import {
  deriveOperationalEntities,
  type DigestDecisionInput,
  type OperationalEntityLite,
} from "./operational-digest";
import {
  compareInitiativeHealth,
  computeInitiativeWorkSignals,
  deriveInitiativeHealth,
  deriveInitiativeMomentum,
  deriveInitiativeOwnership,
  deriveInitiativeProgress,
  deriveInitiativeRisk,
  explainInitiativeHealth,
  type InitiativeHealth,
  type InitiativeHealthExplanation,
  type InitiativeMomentum,
  type InitiativeOwnership,
  type InitiativeProgress,
  type InitiativeRisk,
} from "./strategic-initiative-health";
import {
  deriveInitiativeMilestones,
  summarizeMilestones,
  type InitiativeMilestoneSummary,
} from "./strategic-milestones";
import {
  deriveInitiativeRecommendations,
  type InitiativeRecommendation,
} from "./strategic-recommendations";
import {
  deriveStrategicTimeline,
  deriveTimelineEvents,
  initiativeHref,
  type StrategicTimeline,
  type StrategicTimelineEvent,
} from "./strategic-timeline";
import {
  actionToMatchable,
  decisionToMatchable,
  getInitiativeDef,
  INITIATIVE_PRIORITY_WEIGHT,
  initiativePriorityLabel,
  initiativeStatusLabel,
  isTerminalStatus,
  matchesInitiative,
  meetingToMatchable,
  type InitiativePriority,
  type InitiativeStatus,
  type StrategicInitiativeDef,
} from "./strategic-initiatives";

/**
 * YPP Execution OS — Strategic Initiative SUMMARY assembly.
 *
 * The brain that turns ONE initiative's classified work (the actions, meetings,
 * and decisions the matcher assigned to it) into the complete, SERIALIZABLE
 * {@link InitiativeSummary} every surface renders: the command-center summary,
 * the 10x detail page, the executive dashboard, and the strategic map. It is the
 * single composition point for the health / milestone / timeline / recommendation
 * engines, so the same numbers appear everywhere. Pure (only the injected `now`).
 *
 * It also exports the cross-initiative SELECTORS the executive dashboard uses
 * ("needs attention", "at risk", "fastest moving", "leadership priorities",
 * recently-completed + upcoming milestones, strategic risks) — all deterministic.
 */

export type InitiativeCounts = {
  totalActions: number;
  openActions: number;
  overdueActions: number;
  blockedActions: number;
  unassignedActions: number;
  completedActions: number;
  meetingCount: number;
  upcomingMeetings: number;
  openFollowUps: number;
  decisionsWithoutAction: number;
  milestonesTotal: number;
  milestonesComplete: number;
  milestonesBehind: number;
  criticalEntities: number;
};

export type InitiativeSummary = {
  id: string;
  title: string;
  description: string;
  area: OperationalArea;
  areaLabel: string;
  status: InitiativeStatus;
  statusLabel: string;
  priority: InitiativePriority;
  priorityLabel: string;
  priorityWeight: number;
  owner: string | null;
  ownerDeclared: boolean;
  startDateISO: string | null;
  targetDateISO: string | null;
  pastTargetDate: boolean;
  href: string;

  health: InitiativeHealth;
  healthExplanation: InitiativeHealthExplanation;
  momentum: InitiativeMomentum;
  risk: InitiativeRisk;
  progress: InitiativeProgress;
  ownership: InitiativeOwnership;
  counts: InitiativeCounts;

  milestones: InitiativeMilestoneSummary[];
  recommendations: InitiativeRecommendation[];
  timeline: StrategicTimeline;
  /** All milestone_reached + target events (unbounded), for the dashboard rollups. */
  milestoneEvents: StrategicTimelineEvent[];
  relatedEntities: OperationalEntityLite[];
};

export type ClassifiedWork = {
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
};

/**
 * True when an action is explicitly linked to the initiative or matches its rules.
 */
export function actionBelongsToInitiative(
  action: ActionItemWithRelations,
  def: StrategicInitiativeDef
): boolean {
  if (action.strategicInitiativeId === def.id) return true;
  return matchesInitiative(actionToMatchable(action), def).matched;
}

/** Open actions that belong to one initiative, sorted by deadline. Pure. */
export function filterActionsByInitiative(
  items: ActionItemWithRelations[],
  initiativeId: string
): ActionItemWithRelations[] {
  const def = getInitiativeDef(initiativeId);
  if (!def) return [];
  return sortByDeadline(
    items.filter(
      (a) => a.status !== "DROPPED" && actionBelongsToInitiative(a, def)
    )
  );
}

export function classifyInitiativeWork(
  def: StrategicInitiativeDef,
  pool: ClassifiedWork
): ClassifiedWork {
  return {
    actions: pool.actions.filter((a) => actionBelongsToInitiative(a, def)),
    meetings: pool.meetings.filter((m) => matchesInitiative(meetingToMatchable(m), def).matched),
    decisions: pool.decisions.filter((d) => matchesInitiative(decisionToMatchable(d), def).matched),
  };
}

export type DeriveInitiativeSummaryInput = {
  def: StrategicInitiativeDef;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: ReadonlyMap<string, RelatedEntitySummary>;
  now?: Date;
  limits?: { timeline?: number; keyMoments?: number; recommendations?: number };
};

/** Build the complete summary for one initiative from its classified work. Pure. */
export function deriveInitiativeSummary(
  input: DeriveInitiativeSummaryInput
): InitiativeSummary {
  const now = input.now ?? new Date();
  const { def, actions, meetings, decisions, labels } = input;
  const limits = input.limits ?? {};

  const signals = computeInitiativeWorkSignals({ actions, meetings, decisions, now });
  const milestones = deriveInitiativeMilestones({ def, actions, meetings, decisions, now });
  const msSummary = summarizeMilestones(milestones);

  // Reuse the operational entity rollup so "related entities" + the critical-
  // entity health factor mean exactly what they do on the Command Center.
  const relatedEntities = deriveOperationalEntities({
    actions,
    meetings,
    decisions,
    labels,
    now,
  });
  const criticalEntities = relatedEntities.filter((e) => e.health.level === "critical").length;

  const pastTargetDate =
    !isTerminalStatus(def.status) &&
    Boolean(def.targetDateISO) &&
    new Date(def.targetDateISO as string).getTime() < startOfDay(now).getTime();

  const progress = deriveInitiativeProgress(signals, {
    completed: msSummary.completed,
    total: msSummary.total,
  });
  const momentum = deriveInitiativeMomentum(signals, now);
  const ownership = deriveInitiativeOwnership(actions, def, now);
  const risk = deriveInitiativeRisk(signals, {
    milestonesBehindSchedule: msSummary.behindSchedule,
    criticalEntities,
    pastTargetDate,
    momentum,
  });
  const health = deriveInitiativeHealth({
    status: def.status,
    signals,
    risk,
    momentum,
    ownership,
    milestonesBehindSchedule: msSummary.behindSchedule,
    criticalEntities,
  });
  const healthExplanation = explainInitiativeHealth(health, {
    signals,
    risk,
    momentum,
    ownership,
    milestonesBehindSchedule: msSummary.behindSchedule,
  });

  const entityLabels = new Map<string, string>();
  for (const [key, summary] of labels) entityLabels.set(key, summary.label);

  const timeline = deriveStrategicTimeline({
    def,
    actions,
    meetings,
    decisions,
    milestones,
    entityLabels,
    now,
    limit: limits.timeline ?? 40,
    keyMomentsLimit: limits.keyMoments ?? 6,
  });
  const milestoneEvents = deriveTimelineEvents({
    def,
    actions,
    meetings,
    decisions,
    milestones,
    entityLabels,
    now,
  }).filter((e) => e.type === "milestone_reached" || e.type === "target");

  const recommendations = deriveInitiativeRecommendations({
    def,
    signals,
    health,
    risk,
    momentum,
    ownership,
    milestones,
    limit: limits.recommendations ?? 6,
  });

  const counts: InitiativeCounts = {
    totalActions: signals.totalActions,
    openActions: signals.openActions,
    overdueActions: signals.overdueActions,
    blockedActions: signals.blockedActions,
    unassignedActions: signals.unassignedActions,
    completedActions: signals.completedActions,
    meetingCount: signals.meetingCount,
    upcomingMeetings: signals.upcomingMeetings,
    openFollowUps: signals.openFollowUps,
    decisionsWithoutAction: signals.decisionsWithoutAction,
    milestonesTotal: msSummary.total,
    milestonesComplete: msSummary.completed,
    milestonesBehind: msSummary.behindSchedule,
    criticalEntities,
  };

  return {
    id: def.id,
    title: def.title,
    description: def.description,
    area: def.area,
    areaLabel: operationalAreaLabel(def.area),
    status: def.status,
    statusLabel: initiativeStatusLabel(def.status),
    priority: def.priority,
    priorityLabel: initiativePriorityLabel(def.priority),
    priorityWeight: INITIATIVE_PRIORITY_WEIGHT[def.priority],
    owner: ownership.ownerName,
    ownerDeclared: ownership.ownerDeclared,
    startDateISO: def.startDateISO ?? null,
    targetDateISO: def.targetDateISO ?? null,
    pastTargetDate,
    href: initiativeHref(def.id),
    health,
    healthExplanation,
    momentum,
    risk,
    progress,
    ownership,
    counts,
    milestones,
    recommendations,
    timeline,
    milestoneEvents,
    relatedEntities,
  };
}

// --- cross-initiative selectors (Executive Dashboard, Phase F) --------------

/** Worst-health first, then by risk, then most overdue, then title. */
export function compareInitiativesByConcern(a: InitiativeSummary, b: InitiativeSummary): number {
  return (
    compareInitiativeHealth(a.health, b.health) ||
    b.risk.score - a.risk.score ||
    b.counts.overdueActions - a.counts.overdueActions ||
    a.title.localeCompare(b.title)
  );
}

/** Initiatives that are drifting / at risk / critical, worst first. */
export function selectInitiativesNeedingAttention(
  summaries: InitiativeSummary[]
): InitiativeSummary[] {
  return summaries
    .filter((s) => ["drifting", "at_risk", "critical"].includes(s.health.level))
    .sort(compareInitiativesByConcern);
}

/** Initiatives with elevated / high derived risk, worst first. */
export function selectAtRiskInitiatives(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return summaries
    .filter((s) => s.risk.level === "elevated" || s.risk.level === "high")
    .sort((a, b) => b.risk.score - a.risk.score || a.title.localeCompare(b.title));
}

/** Fastest-moving initiatives: accelerating / steady momentum, by momentum score. */
export function selectFastestMovingInitiatives(
  summaries: InitiativeSummary[]
): InitiativeSummary[] {
  return summaries
    .filter(
      (s) =>
        !isTerminalStatus(s.status) &&
        (s.momentum.level === "accelerating" || s.momentum.level === "steady") &&
        s.momentum.recentlyCompleted > 0
    )
    .sort((a, b) => b.momentum.score - a.momentum.score || a.title.localeCompare(b.title));
}

/** Leadership priorities: by configured priority weight, then health concern. */
export function selectLeadershipPriorities(summaries: InitiativeSummary[]): InitiativeSummary[] {
  return [...summaries]
    .filter((s) => !isTerminalStatus(s.status))
    .sort(
      (a, b) =>
        b.priorityWeight - a.priorityWeight ||
        compareInitiativesByConcern(a, b)
    );
}

export type RecentMilestone = {
  initiativeId: string;
  initiativeTitle: string;
  title: string;
  occurredAtISO: string;
  href: string;
};

/** Milestones reached across all initiatives within the last `days`, newest first. */
export function selectRecentlyCompletedMilestones(
  summaries: InitiativeSummary[],
  now: Date = new Date(),
  days = 30
): RecentMilestone[] {
  const cutoff = addDays(now, -days).getTime();
  const out: RecentMilestone[] = [];
  for (const s of summaries) {
    for (const e of s.milestoneEvents) {
      if (e.type !== "milestone_reached") continue;
      if (new Date(e.occurredAtISO).getTime() < cutoff) continue;
      out.push({
        initiativeId: s.id,
        initiativeTitle: s.title,
        title: e.title,
        occurredAtISO: e.occurredAtISO,
        href: e.href,
      });
    }
  }
  return out.sort(
    (a, b) => new Date(b.occurredAtISO).getTime() - new Date(a.occurredAtISO).getTime()
  );
}

export type UpcomingMilestone = {
  initiativeId: string;
  initiativeTitle: string;
  title: string;
  targetDateISO: string;
  behindSchedule: boolean;
  href: string;
};

/** Upcoming (and overdue) milestone target dates across all initiatives, soonest first. */
export function selectUpcomingMilestones(
  summaries: InitiativeSummary[],
  now: Date = new Date(),
  daysAhead = 60
): UpcomingMilestone[] {
  const horizon = addDays(now, daysAhead).getTime();
  const out: UpcomingMilestone[] = [];
  for (const s of summaries) {
    for (const ms of s.milestones) {
      if (!ms.targetDateISO || ms.status === "complete") continue;
      const t = new Date(ms.targetDateISO).getTime();
      if (t > horizon) continue;
      out.push({
        initiativeId: s.id,
        initiativeTitle: s.title,
        title: ms.title,
        targetDateISO: ms.targetDateISO,
        behindSchedule: ms.behindSchedule,
        href: `${s.href}#milestone-${ms.id}`,
      });
    }
  }
  return out.sort(
    (a, b) => new Date(a.targetDateISO).getTime() - new Date(b.targetDateISO).getTime()
  );
}

export type StrategicRisk = {
  initiativeId: string;
  initiativeTitle: string;
  level: InitiativeRisk["level"];
  score: number;
  topFactor: string;
  href: string;
};

/** The top strategic risks across initiatives (elevated/high), worst first. */
export function selectStrategicRisks(summaries: InitiativeSummary[]): StrategicRisk[] {
  return summaries
    .filter((s) => s.risk.level === "elevated" || s.risk.level === "high")
    .map((s) => ({
      initiativeId: s.id,
      initiativeTitle: s.title,
      level: s.risk.level,
      score: s.risk.score,
      topFactor: s.risk.factors[0]?.label ?? "elevated risk",
      href: s.href,
    }))
    .sort((a, b) => b.score - a.score || a.initiativeTitle.localeCompare(b.initiativeTitle));
}

/** Org-wide portfolio counts for the executive header. */
export type PortfolioStats = {
  total: number;
  active: number;
  healthy: number;
  needsAttention: number;
  atRisk: number;
  critical: number;
  completed: number;
  overdueActions: number;
  openActions: number;
  milestonesComplete: number;
  milestonesTotal: number;
};

export function derivePortfolioStats(summaries: InitiativeSummary[]): PortfolioStats {
  const stats: PortfolioStats = {
    total: summaries.length,
    active: 0,
    healthy: 0,
    needsAttention: 0,
    atRisk: 0,
    critical: 0,
    completed: 0,
    overdueActions: 0,
    openActions: 0,
    milestonesComplete: 0,
    milestonesTotal: 0,
  };
  for (const s of summaries) {
    if (!isTerminalStatus(s.status)) stats.active += 1;
    if (s.health.level === "healthy") stats.healthy += 1;
    if (s.health.level === "drifting") stats.needsAttention += 1;
    if (s.health.level === "at_risk") stats.atRisk += 1;
    if (s.health.level === "critical") stats.critical += 1;
    if (s.health.level === "completed") stats.completed += 1;
    stats.overdueActions += s.counts.overdueActions;
    stats.openActions += s.counts.openActions;
    stats.milestonesComplete += s.counts.milestonesComplete;
    stats.milestonesTotal += s.counts.milestonesTotal;
  }
  return stats;
}
