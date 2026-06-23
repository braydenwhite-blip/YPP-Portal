import { actionPrefillToQuery, type ActionPrefill } from "./action-prefill";
import type { ActionItemWithRelations } from "./action-queries";
import type { RelatedEntitySummary } from "./connections";
import type { MeetingCardDTO } from "./meeting-card-types";
import { operationalAreaLabel, type OperationalArea } from "./operational-context";
import type { DigestDecisionInput } from "./operational-digest";
import {
  deriveDecisionCenter,
  type DecisionCenter,
} from "./strategic-decision-center";
import {
  computeInitiativeWorkSignals,
  deriveInitiativeHealth,
  deriveInitiativeMomentum,
  deriveInitiativeOwnership,
  deriveInitiativeProgress,
  deriveInitiativeRisk,
  type InitiativeHealth,
  type InitiativeMomentum,
  type InitiativeOwnership,
  type InitiativeProgress,
  type InitiativeRisk,
} from "./strategic-initiative-health";
import type { ClassifiedWork, InitiativeCounts } from "./strategic-initiative-summary";
import {
  actionToMatchable,
  decisionToMatchable,
  INITIATIVE_PRIORITY_LABELS,
  INITIATIVE_PRIORITY_WEIGHT,
  INITIATIVE_STATUS_LABELS,
  isTerminalStatus,
  matchWork,
  meetingToMatchable,
  type InitiativePriority,
  type InitiativeStatus,
  type StrategicInitiativeDef,
} from "./strategic-initiatives";
import {
  summarizeMilestones,
  type InitiativeMilestoneSummary,
} from "./strategic-milestones";
import {
  deriveProjectBlockers,
  deriveProjectConfidence,
  deriveProjectFollowThrough,
  deriveProjectReviewNeed,
  explainProjectStatus,
  type ProjectBlocker,
  type ProjectConfidence,
  type ProjectFollowThrough,
  type ProjectReviewNeed,
  type ProjectStatusExplanation,
} from "./strategic-project-health";
import { projectHref } from "./strategic-project-registry";
import {
  deriveProjectActionIntelligence,
  deriveProjectDependencyView,
  deriveProjectMeetingIntelligence,
  deriveProjectTimeline,
  type ProjectActionIntelligence,
  type ProjectDependencyView,
  type ProjectMeetingIntelligence,
} from "./strategic-project-timeline";
import type { StrategicProjectDef, ProjectCharter } from "./strategic-projects";
import { initiativeHref } from "./strategic-timeline";
import type { TouchpointEvent, TouchpointTimeline } from "./strategic-touchpoint-timeline";

/**
 * YPP Execution OS — STRATEGIC PROJECT SUMMARY + DOSSIER (3.0, Phase A/B).
 *
 * Classifies a parent initiative's already-matched work down into a project, then
 * runs the 2.0 health / momentum / risk / ownership / progress engines on that
 * subset and layers on the project-specific intelligence (confidence, blockers,
 * follow-through, review need). The {@link ProjectSummary} backs cards + the index;
 * the {@link ProjectDossier} backs the detail page. Pure — no DB, no React.
 */

// --- classification ----------------------------------------------------------

/**
 * Classify the parent initiative's ALREADY-matched pool down into a project. An
 * item belongs to the project when it fires any of the project's match signals
 * (the pool is already initiative-scoped, so a keyword hit is precise). Reuses the
 * exact 2.0 matcher so membership stays explainable + consistent.
 */
export function classifyProjectWork(
  def: StrategicProjectDef,
  pool: ClassifiedWork
): ClassifiedWork {
  return {
    actions: pool.actions.filter((a) => matchWork(actionToMatchable(a), def.match).matched),
    meetings: pool.meetings.filter((m) => matchWork(meetingToMatchable(m), def.match).matched),
    decisions: pool.decisions.filter((d) => matchWork(decisionToMatchable(d), def.match).matched),
  };
}

// --- summary -----------------------------------------------------------------

export type ProjectNextMove = {
  id: string;
  title: string;
  detail: string;
  href: string;
  severity: "critical" | "warning" | "watch" | "neutral";
};

export type ProjectSummary = {
  id: string;
  title: string;
  summary: string;
  href: string;

  // parent
  initiativeId: string;
  initiativeTitle: string;
  initiativeHref: string;
  area: OperationalArea;
  areaLabel: string;
  workstreamIds: string[];
  workstreamTitles: string[];

  // declared config
  owner: string | null;
  ownerDeclared: boolean;
  supporting: string[];
  status: InitiativeStatus;
  statusLabel: string;
  priority: InitiativePriority;
  priorityLabel: string;
  priorityWeight: number;
  startDateISO: string | null;
  targetDateISO: string | null;
  pastTargetDate: boolean;
  charter: ProjectCharter;

  // honesty
  hasWork: boolean;
  dataState: "tracked" | "no_work";

  // derived
  health: InitiativeHealth;
  momentum: InitiativeMomentum;
  risk: InitiativeRisk;
  progress: InitiativeProgress;
  ownership: InitiativeOwnership;
  confidence: ProjectConfidence;
  blockers: ProjectBlocker[];
  followThrough: ProjectFollowThrough;
  reviewNeed: ProjectReviewNeed;
  statusExplanation: ProjectStatusExplanation;
  counts: InitiativeCounts;

  // next moves
  nextMoves: ProjectNextMove[];
  newActionHref: string;

  // recent activity (light)
  lastMovementISO: string | null;
  recentTouchpoints: TouchpointEvent[];

  // linked structure (counts; full detail lives in the dossier)
  linkedMilestoneIds: string[];
};

export type DeriveProjectSummaryInput = {
  def: StrategicProjectDef;
  /** The parent initiative def (for area, workstream titles, action prefill). */
  initiative: StrategicInitiativeDef;
  /** The project's already-classified work. */
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  labels: ReadonlyMap<string, RelatedEntitySummary>;
  /** Parent-initiative milestones whose workstream belongs to this project. */
  linkedMilestones?: InitiativeMilestoneSummary[];
  /** True when a declared upstream dependency is currently unhealthy. */
  dependencyAtRisk?: boolean;
  now?: Date;
  limits?: { touchpoints?: number };
};

/** The goal category / keyword a new action should carry to join this project. */
export function buildProjectActionPrefill(
  def: StrategicProjectDef,
  initiative: StrategicInitiativeDef,
  overrides: Partial<ActionPrefill> = {}
): string {
  // `area` = the parent initiative's goal category, so the new action joins the
  // initiative; the title is seeded with the project name (which contains the
  // project's match keyword) so the project matcher catches it too. No migration.
  const prefill: ActionPrefill = {
    area: initiative.match.goalCategories?.[0] ?? initiative.title,
    title: `${def.title}: `,
    // Action 4.0: carry the EXPLICIT project + parent-initiative registry ids and
    // source so the new action is honestly linked (the area/title keep the
    // matcher in agreement, but the stored link is authoritative).
    sourceType: "PROJECT",
    strategicProjectId: def.id,
    strategicInitiativeId: initiative.id,
    ...overrides,
  };
  return actionPrefillToQuery(prefill);
}

function lastMovement(
  actions: ActionItemWithRelations[],
  meetings: MeetingCardDTO[]
): string | null {
  let latest = 0;
  for (const a of actions) {
    const t = (a.completedAt ?? a.updatedAt ?? a.createdAt)?.getTime() ?? 0;
    if (t > latest) latest = t;
  }
  for (const m of meetings) {
    const t = new Date(m.startISO).getTime();
    if (!Number.isNaN(t) && t > latest && t <= Date.now()) latest = t;
  }
  return latest > 0 ? new Date(latest).toISOString() : null;
}

function buildNextMoves(args: {
  def: StrategicProjectDef;
  initiative: StrategicInitiativeDef;
  actionIntel: ProjectActionIntelligence;
  followThrough: ProjectFollowThrough;
  reviewNeed: ProjectReviewNeed;
  blockers: ProjectBlocker[];
  hasWork: boolean;
  newActionHref: string;
}): ProjectNextMove[] {
  const moves: ProjectNextMove[] = [];
  const { actionIntel, followThrough, reviewNeed, blockers } = args;

  const observed = blockers.find((b) => b.kind === "observed");
  if (observed) {
    moves.push({
      id: "unblock",
      title: "Clear the blocker",
      detail: observed.label,
      href: actionIntel.overdue[0]?.href ?? "/actions/all",
      severity: "critical",
    });
  }
  if (actionIntel.recommendedNext) {
    moves.push({
      id: "next-action",
      title: actionIntel.recommendedNext.title,
      detail: actionIntel.recommendedNext.overdue
        ? "Overdue — push this next."
        : "Recommended next action.",
      href: actionIntel.recommendedNext.href,
      severity: actionIntel.recommendedNext.overdue ? "warning" : "watch",
    });
  }
  if (followThrough.decisionsWithoutAction > 0) {
    moves.push({
      id: "convert-decision",
      title: "Convert a decision into action",
      detail: `${followThrough.decisionsWithoutAction} decision${followThrough.decisionsWithoutAction === 1 ? "" : "s"} without follow-through.`,
      href: "/operations/command-center",
      severity: "warning",
    });
  }
  if (!args.hasWork) {
    moves.push({
      id: "kickoff",
      title: "Create the first linked action",
      detail: "No tracked work yet — give the project a first move.",
      href: args.newActionHref,
      severity: "watch",
    });
  }
  if (reviewNeed.needed && reviewNeed.urgency !== "routine") {
    moves.push({
      id: "review",
      title: "Put this on the leadership review",
      detail: reviewNeed.reason,
      href: "/operations/weekly-execution",
      severity: reviewNeed.urgency === "now" ? "warning" : "watch",
    });
  }
  return moves.slice(0, 4);
}

/** The complete derived summary for one project. Pure. */
export function deriveProjectSummary(input: DeriveProjectSummaryInput): ProjectSummary {
  const now = input.now ?? new Date();
  const { def, initiative } = input;
  const linkedMilestones = input.linkedMilestones ?? [];

  const signals = computeInitiativeWorkSignals({
    actions: input.actions,
    meetings: input.meetings,
    decisions: input.decisions,
    now,
  });

  const milestoneRollup = summarizeMilestones(linkedMilestones);
  const progress = deriveInitiativeProgress(signals, {
    completed: milestoneRollup.completed,
    total: milestoneRollup.total,
  });
  const momentum = deriveInitiativeMomentum(signals, now);
  const pastTargetDate =
    !!def.targetDateISO &&
    new Date(def.targetDateISO).getTime() < now.getTime() &&
    !isTerminalStatus(def.status);
  const risk = deriveInitiativeRisk(signals, {
    momentum,
    pastTargetDate,
    milestonesBehindSchedule: milestoneRollup.behindSchedule,
  });
  const ownership = deriveInitiativeOwnership(input.actions, { owner: def.owner }, now);
  const health = deriveInitiativeHealth({
    status: def.status,
    signals,
    risk,
    momentum,
    ownership,
    milestonesBehindSchedule: milestoneRollup.behindSchedule,
  });

  const hasWork = signals.totalActions > 0 || signals.meetingCount > 0 || signals.decisionCount > 0;
  const confidence = deriveProjectConfidence({ progress, momentum, risk, ownership, hasWork });
  const blockers = deriveProjectBlockers({
    signals,
    declaredDependsOn: def.dependsOn,
    dependencyAtRisk: input.dependencyAtRisk,
  });
  const followThrough = deriveProjectFollowThrough({ signals });
  const reviewNeed = deriveProjectReviewNeed({ health, momentum, signals, pastTargetDate, hasWork });
  const statusExplanation = explainProjectStatus({ health, confidence, blockers, hasWork });

  const actionIntel = deriveProjectActionIntelligence(input.actions, now);
  const newActionHref = buildProjectActionPrefill(def, initiative);

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
    milestonesTotal: milestoneRollup.total,
    milestonesComplete: milestoneRollup.completed,
    milestonesBehind: milestoneRollup.behindSchedule,
    criticalEntities: 0,
  };

  const workstreamTitles = (def.workstreamIds ?? [])
    .map((id) => (initiative.workstreams ?? []).find((w) => w.id === id)?.title)
    .filter((t): t is string => !!t);

  const timeline = deriveProjectTimeline({
    def,
    initiativeTitle: initiative.title,
    actions: input.actions,
    meetings: input.meetings,
    decisions: input.decisions,
    linkedMilestones,
    labels: input.labels,
    now,
  });

  return {
    id: def.id,
    title: def.title,
    summary: def.summary,
    href: projectHref(def.id),
    initiativeId: def.initiativeId,
    initiativeTitle: initiative.title,
    initiativeHref: initiativeHref(def.initiativeId),
    area: initiative.area,
    areaLabel: operationalAreaLabel(initiative.area),
    workstreamIds: def.workstreamIds ?? [],
    workstreamTitles,
    owner: def.owner ?? ownership.ownerName,
    ownerDeclared: !!def.owner,
    supporting: def.supporting ?? [],
    status: def.status,
    statusLabel: INITIATIVE_STATUS_LABELS[def.status],
    priority: def.priority,
    priorityLabel: INITIATIVE_PRIORITY_LABELS[def.priority],
    priorityWeight: INITIATIVE_PRIORITY_WEIGHT[def.priority],
    startDateISO: def.startDateISO ?? null,
    targetDateISO: def.targetDateISO ?? null,
    pastTargetDate,
    charter: def.charter,
    hasWork,
    dataState: hasWork ? "tracked" : "no_work",
    health,
    momentum,
    risk,
    progress,
    ownership,
    confidence,
    blockers,
    followThrough,
    reviewNeed,
    statusExplanation,
    counts,
    nextMoves: buildNextMoves({
      def,
      initiative,
      actionIntel,
      followThrough,
      reviewNeed,
      blockers,
      hasWork,
      newActionHref,
    }),
    newActionHref,
    lastMovementISO: lastMovement(input.actions, input.meetings),
    recentTouchpoints: timeline.all.slice(0, input.limits?.touchpoints ?? 6),
    linkedMilestoneIds: linkedMilestones.map((m) => m.id),
  };
}

// --- dossier (detail page) ---------------------------------------------------

export type ProjectDossier = {
  summary: ProjectSummary;
  timeline: TouchpointTimeline;
  decisionCenter: DecisionCenter;
  linkedMilestones: InitiativeMilestoneSummary[];
  actionIntelligence: ProjectActionIntelligence;
  meetingIntelligence: ProjectMeetingIntelligence;
  dependencies: ProjectDependencyView;
  relatedEntities: RelatedEntitySummary[];
};

/** The full project command-center read for the detail page. Pure. */
export function deriveProjectDossier(input: DeriveProjectSummaryInput): ProjectDossier {
  const now = input.now ?? new Date();
  const summary = deriveProjectSummary({ ...input, limits: { touchpoints: 8 } });
  const linkedMilestones = input.linkedMilestones ?? [];

  const timeline = deriveProjectTimeline({
    def: input.def,
    initiativeTitle: input.initiative.title,
    actions: input.actions,
    meetings: input.meetings,
    decisions: input.decisions,
    linkedMilestones,
    labels: input.labels,
    now,
  });

  const decisionCenter = deriveDecisionCenter(input.decisions, now);
  const actionIntelligence = deriveProjectActionIntelligence(input.actions, now);
  const meetingIntelligence = deriveProjectMeetingIntelligence(
    input.meetings,
    actionIntelligence.counts.open,
    now
  );
  const dependencies = deriveProjectDependencyView(input.def, {
    dependencyAtRisk: input.dependencyAtRisk,
    observedBlockers: summary.blockers.filter((b) => b.kind === "observed").length,
  });

  // Related entities: resolve the refs the work touches, worst/most-frequent first.
  const refCounts = new Map<string, number>();
  for (const a of input.actions) {
    if (a.relatedEntityType && a.relatedEntityId) {
      const key = `${a.relatedEntityType}:${a.relatedEntityId}`;
      refCounts.set(key, (refCounts.get(key) ?? 0) + 1);
    }
  }
  const relatedEntities = [...refCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => input.labels.get(key))
    .filter((s): s is RelatedEntitySummary => !!s)
    .slice(0, 10);

  return {
    summary,
    timeline,
    decisionCenter,
    linkedMilestones,
    actionIntelligence,
    meetingIntelligence,
    dependencies,
    relatedEntities,
  };
}

// --- portfolio selectors + stats ---------------------------------------------

const HEALTH_RANK: Record<string, number> = {
  archived: -2,
  completed: -1,
  healthy: 0,
  drifting: 1,
  at_risk: 2,
  critical: 3,
};

/** Worst-health first, then highest priority, then most overdue, then title. */
export function compareProjectsByConcern(a: ProjectSummary, b: ProjectSummary): number {
  const rank = (HEALTH_RANK[b.health.level] ?? 0) - (HEALTH_RANK[a.health.level] ?? 0);
  if (rank !== 0) return rank;
  return (
    b.priorityWeight - a.priorityWeight ||
    b.counts.overdueActions - a.counts.overdueActions ||
    a.title.localeCompare(b.title)
  );
}

function active(p: ProjectSummary): boolean {
  return !isTerminalStatus(p.status);
}

export function selectProjectsNeedingAttention(projects: ProjectSummary[]): ProjectSummary[] {
  return projects
    .filter(
      (p) =>
        active(p) &&
        (p.health.level === "critical" ||
          p.health.level === "at_risk" ||
          p.health.level === "drifting" ||
          (p.reviewNeed.needed && p.reviewNeed.urgency === "now"))
    )
    .sort(compareProjectsByConcern);
}

export function selectBlockedProjects(projects: ProjectSummary[]): ProjectSummary[] {
  return projects
    .filter(
      (p) =>
        active(p) &&
        p.blockers.some((b) => b.kind === "observed" || (b.kind === "declared" && b.severity === "high"))
    )
    .sort(compareProjectsByConcern);
}

export function selectStaleProjects(projects: ProjectSummary[]): ProjectSummary[] {
  return projects
    .filter((p) => active(p) && p.hasWork && p.momentum.level === "stalled")
    .sort(compareProjectsByConcern);
}

export function selectUnownedProjects(projects: ProjectSummary[]): ProjectSummary[] {
  return projects
    .filter((p) => active(p) && (p.ownership.clarity === "unowned" || p.ownership.clarity === "unclear"))
    .sort(compareProjectsByConcern);
}

export function selectFastestProjects(projects: ProjectSummary[]): ProjectSummary[] {
  return projects
    .filter((p) => active(p) && p.momentum.level === "accelerating")
    .sort((a, b) => b.momentum.score - a.momentum.score);
}

export type ProjectPortfolioStats = {
  total: number;
  active: number;
  healthy: number;
  needsAttention: number;
  atRisk: number;
  critical: number;
  blocked: number;
  unowned: number;
  noWork: number;
  completed: number;
  openActions: number;
  overdueActions: number;
};

export function deriveProjectPortfolioStats(projects: ProjectSummary[]): ProjectPortfolioStats {
  let healthy = 0;
  let needsAttention = 0;
  let atRisk = 0;
  let critical = 0;
  let blocked = 0;
  let unowned = 0;
  let noWork = 0;
  let completed = 0;
  let openActions = 0;
  let overdueActions = 0;
  let activeCount = 0;

  for (const p of projects) {
    if (active(p)) activeCount += 1;
    if (p.status === "completed") completed += 1;
    if (p.health.level === "healthy") healthy += 1;
    if (p.health.level === "at_risk") atRisk += 1;
    if (p.health.level === "critical") critical += 1;
    if (active(p) && (p.health.level === "at_risk" || p.health.level === "critical" || p.health.level === "drifting"))
      needsAttention += 1;
    if (p.blockers.some((b) => b.kind === "observed")) blocked += 1;
    if (p.ownership.clarity === "unowned") unowned += 1;
    if (!p.hasWork) noWork += 1;
    openActions += p.counts.openActions;
    overdueActions += p.counts.overdueActions;
  }

  return {
    total: projects.length,
    active: activeCount,
    healthy,
    needsAttention,
    atRisk,
    critical,
    blocked,
    unowned,
    noWork,
    completed,
    openActions,
    overdueActions,
  };
}
