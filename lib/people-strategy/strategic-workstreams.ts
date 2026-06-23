import type { ActionItemWithRelations } from "./action-queries";
import type { MeetingCardDTO } from "./meeting-card-types";
import type { RelatedEntitySummary } from "./connections";
import {
  deriveOperationalEntities,
  type DigestDecisionInput,
  type OperationalEntityLite,
} from "./operational-digest";
import {
  computeInitiativeWorkSignals,
  deriveInitiativeHealth,
  deriveInitiativeMomentum,
  deriveInitiativeOwnership,
  deriveInitiativeProgress,
  deriveInitiativeRisk,
  explainInitiativeHealth,
  type InitiativeHealth,
  type InitiativeMomentum,
  type InitiativeOwnership,
  type InitiativeProgress,
  type InitiativeRisk,
} from "./strategic-initiative-health";
import {
  deriveMilestone,
  summarizeMilestones,
  type InitiativeMilestoneSummary,
} from "./strategic-milestones";
import {
  deriveInitiativeRecommendations,
  type InitiativeRecommendation,
} from "./strategic-recommendations";
import {
  deriveStrategicTimeline,
  initiativeHref,
  type StrategicTimelineEvent,
} from "./strategic-timeline";
import {
  actionToMatchable,
  decisionToMatchable,
  matchWork,
  meetingToMatchable,
  type StrategicInitiativeDef,
  type WorkstreamDef,
} from "./strategic-initiatives";

/**
 * YPP Execution OS — WORKSTREAM ENGINE (Phase B).
 *
 * Workstreams are the PRIMARY MANAGEMENT UNIT inside an initiative. An initiative
 * the size of "Summer Camps 2026" is really seven parallel programs; a workstream
 * is one of them (Partnership Development, Curriculum Development, …). This module
 * turns one workstream's match into a complete, leadership-grade read by REUSING
 * the exact same engines the whole initiative uses — so a workstream's "health",
 * "momentum", "risk", and "ownership" mean precisely what they do one level up,
 * just scoped to the workstream's slice of the work. Pure (only the injected
 * `now`); never touches the DB.
 *
 *   Initiative → Workstream → Milestone → Action
 */

export type WorkstreamSummary = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  owner: string | null;
  ownerDeclared: boolean;
  targetDateISO: string | null;
  pastTargetDate: boolean;
  /** Anchor link into the initiative detail page. */
  href: string;

  health: InitiativeHealth;
  healthHeadline: string;
  momentum: InitiativeMomentum;
  risk: InitiativeRisk;
  progress: InitiativeProgress;
  ownership: InitiativeOwnership;

  totalActions: number;
  openActions: number;
  overdueActions: number;
  blockedActions: number;
  completedActions: number;
  meetingCount: number;
  decisionCount: number;
  openFollowUps: number;
  decisionsWithoutAction: number;
  milestonesComplete: number;
  milestonesTotal: number;
  criticalEntities: number;

  milestones: InitiativeMilestoneSummary[];
  keyMoments: StrategicTimelineEvent[];
  nextSteps: string[];
  recommendations: InitiativeRecommendation[];
  relatedEntities: OperationalEntityLite[];
  /** Stable action ids in this workstream (for the execution graph). */
  actionIds: string[];
  /** How many declared dependencies are scoped to this workstream. */
  dependencyCount: number;
};

export type DeriveWorkstreamsInput = {
  def: StrategicInitiativeDef;
  /** The initiative's ALREADY-classified work (the matcher already ran). */
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: ReadonlyMap<string, RelatedEntitySummary>;
  /** Count of declared dependencies per workstream id (Phase G), for context. */
  dependencyCounts?: ReadonlyMap<string, number>;
  now?: Date;
};

const startOfDayMs = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Build the complete summary for ONE workstream from the initiative's work. Pure. */
export function deriveWorkstream(input: {
  def: StrategicInitiativeDef;
  ws: WorkstreamDef;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: ReadonlyMap<string, RelatedEntitySummary>;
  dependencyCount?: number;
  now?: Date;
}): WorkstreamSummary {
  const now = input.now ?? new Date();
  const { def, ws } = input;

  // Classify the initiative's work into this workstream by its own match.
  const actions = input.actions.filter((a) => matchWork(actionToMatchable(a), ws.match).matched);
  const meetings = input.meetings.filter((m) => matchWork(meetingToMatchable(m), ws.match).matched);
  const decisions = input.decisions.filter(
    (d) => matchWork(decisionToMatchable(d), ws.match).matched
  );

  // Milestones assigned to this workstream (by workstreamId), in roadmap order.
  const milestones = def.milestones
    .filter((m) => m.workstreamId === ws.id)
    .map((mdef) => deriveMilestone({ def: mdef, actions, meetings, decisions, now }))
    .sort((a, b) => a.order - b.order);
  const msSummary = summarizeMilestones(milestones);

  const signals = computeInitiativeWorkSignals({ actions, meetings, decisions, now });

  const relatedEntities = deriveOperationalEntities({
    actions,
    meetings,
    decisions,
    labels: input.labels,
    now,
  });
  const criticalEntities = relatedEntities.filter((e) => e.health.level === "critical").length;

  const pastTargetDate =
    Boolean(ws.targetDateISO) &&
    new Date(ws.targetDateISO as string).getTime() < startOfDayMs(now);

  const progress = deriveInitiativeProgress(signals, {
    completed: msSummary.completed,
    total: msSummary.total,
  });
  const momentum = deriveInitiativeMomentum(signals, now);
  const ownership = deriveInitiativeOwnership(actions, { owner: ws.owner }, now);
  const risk = deriveInitiativeRisk(signals, {
    milestonesBehindSchedule: msSummary.behindSchedule,
    criticalEntities,
    pastTargetDate,
    momentum,
  });
  // A workstream is never terminal on its own — it inherits the initiative's
  // status for the calm-read short-circuit only.
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
  for (const [key, summary] of input.labels) entityLabels.set(key, summary.label);

  const timeline = deriveStrategicTimeline({
    def,
    actions,
    meetings,
    decisions,
    milestones,
    entityLabels,
    now,
    limit: 0,
    keyMomentsLimit: 5,
  });

  // Reuse the recommendation engine on the workstream slice, then namespace the
  // ids so several workstreams' recommendations never collide on a page.
  const recommendations = deriveInitiativeRecommendations({
    def,
    signals,
    health,
    risk,
    momentum,
    ownership,
    milestones,
    limit: 4,
  }).map((r) => ({ ...r, id: `${ws.id}:${r.id}` }));

  return {
    id: ws.id,
    title: ws.title,
    description: ws.description ?? null,
    order: ws.order,
    owner: ownership.ownerName,
    ownerDeclared: ownership.ownerDeclared,
    targetDateISO: ws.targetDateISO ?? null,
    pastTargetDate,
    href: `${initiativeHref(def.id)}#workstream-${ws.id}`,
    health,
    healthHeadline: healthExplanation.headline,
    momentum,
    risk,
    progress,
    ownership,
    totalActions: signals.totalActions,
    openActions: signals.openActions,
    overdueActions: signals.overdueActions,
    blockedActions: signals.blockedActions,
    completedActions: signals.completedActions,
    meetingCount: signals.meetingCount,
    decisionCount: signals.decisionCount,
    openFollowUps: signals.openFollowUps,
    decisionsWithoutAction: signals.decisionsWithoutAction,
    milestonesComplete: msSummary.completed,
    milestonesTotal: msSummary.total,
    criticalEntities,
    milestones,
    keyMoments: timeline.keyMoments,
    nextSteps: healthExplanation.suggestedNextSteps,
    recommendations,
    relatedEntities,
    actionIds: actions.map((a) => a.id),
    dependencyCount: input.dependencyCount ?? 0,
  };
}

/** All of an initiative's workstreams, in display order. Pure. */
export function deriveWorkstreams(input: DeriveWorkstreamsInput): WorkstreamSummary[] {
  const now = input.now ?? new Date();
  const defs = input.def.workstreams ?? [];
  return defs
    .map((ws) =>
      deriveWorkstream({
        def: input.def,
        ws,
        actions: input.actions,
        meetings: input.meetings,
        decisions: input.decisions,
        labels: input.labels,
        dependencyCount: input.dependencyCounts?.get(ws.id) ?? 0,
        now,
      })
    )
    .sort((a, b) => a.order - b.order);
}

/** Worst-health-first ordering of workstreams (for "needs attention" lists). */
export function compareWorkstreamsByConcern(a: WorkstreamSummary, b: WorkstreamSummary): number {
  const rank: Record<string, number> = {
    archived: -2,
    completed: -1,
    healthy: 0,
    drifting: 1,
    at_risk: 2,
    critical: 3,
  };
  return (
    (rank[b.health.level] ?? 0) - (rank[a.health.level] ?? 0) ||
    b.risk.score - a.risk.score ||
    b.overdueActions - a.overdueActions ||
    a.order - b.order
  );
}
