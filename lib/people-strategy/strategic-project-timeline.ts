import type { ActionItemWithRelations } from "./action-queries";
import type { RelatedEntitySummary } from "./connections";
import type { MeetingCardDTO } from "./meetings-queries";
import type { DigestDecisionInput } from "./operational-digest";
import type { InitiativeMilestoneSummary } from "./strategic-milestones";
import { projectHref } from "./strategic-project-registry";
import type { StrategicProjectDef } from "./strategic-projects";
import {
  deriveTouchpointTimeline,
  type TouchpointContext,
  type TouchpointTimeline,
} from "./strategic-touchpoint-timeline";

/**
 * YPP Execution OS — STRATEGIC PROJECT TIMELINE + INTELLIGENCE (3.0, Phase A/B).
 *
 * Project-scoped reads built on the shared {@link deriveTouchpointTimeline}
 * engine plus the project's classified work:
 *   - the grouped project timeline (overdue / upcoming / current / recent / past),
 *   - ACTION intelligence (open / overdue / completed / unowned / undated / from
 *     meetings, plus a recommended next action),
 *   - MEETING intelligence (connected / produced actions / produced decisions /
 *     no follow-up, plus a next-meeting recommendation),
 *   - the declared DEPENDENCY view.
 *
 * Pure: no DB, no React. Everything is derived from real work + declared config.
 */

// --- project timeline --------------------------------------------------------

export type DeriveProjectTimelineInput = {
  def: StrategicProjectDef;
  initiativeTitle: string;
  actions: ActionItemWithRelations[];
  meetings: MeetingCardDTO[];
  decisions: DigestDecisionInput[];
  linkedMilestones?: InitiativeMilestoneSummary[];
  labels?: ReadonlyMap<string, RelatedEntitySummary>;
  now?: Date;
};

/** The project's full touchpoint timeline, grouped for the detail page. */
export function deriveProjectTimeline(input: DeriveProjectTimelineInput): TouchpointTimeline {
  const context: TouchpointContext = {
    initiativeId: input.def.initiativeId,
    initiativeTitle: input.initiativeTitle,
    projectId: input.def.id,
    projectTitle: input.def.title,
    strategyHref: projectHref(input.def.id),
    entityLabels: input.labels,
  };
  return deriveTouchpointTimeline({
    context,
    actions: input.actions,
    meetings: input.meetings,
    decisions: input.decisions,
    milestones: input.linkedMilestones,
    now: input.now,
  });
}

// --- action intelligence -----------------------------------------------------

export type ProjectActionLite = {
  id: string;
  title: string;
  href: string;
  ownerName: string | null;
  status: string;
  dueISO: string | null;
  overdue: boolean;
  fromMeeting: boolean;
  priority: string;
};

export type ProjectActionIntelligence = {
  open: ProjectActionLite[];
  overdue: ProjectActionLite[];
  completed: ProjectActionLite[];
  unowned: ProjectActionLite[];
  noDueDate: ProjectActionLite[];
  fromMeetings: ProjectActionLite[];
  /** The single best next action to push, or null when there is nothing open. */
  recommendedNext: ProjectActionLite | null;
  counts: {
    total: number;
    open: number;
    overdue: number;
    completed: number;
    unowned: number;
    noDueDate: number;
    fromMeetings: number;
  };
};

const SETTLED = new Set(["COMPLETE", "DROPPED"]);
const PRIORITY_RANK: Record<string, number> = { URGENT: 3, HIGH: 2, MEDIUM: 1, LOW: 0 };

function toActionLite(a: ActionItemWithRelations, now: Date): ProjectActionLite {
  const overdue =
    !SETTLED.has(a.status) && !!a.deadlineStart && a.deadlineStart.getTime() < now.getTime();
  return {
    id: a.id,
    title: a.title,
    href: `/actions/${a.id}`,
    ownerName: a.lead?.name ?? null,
    status: a.status,
    dueISO: a.deadlineStart ? a.deadlineStart.toISOString() : null,
    overdue,
    fromMeeting: !!a.officerMeetingId,
    priority: a.priority,
  };
}

/**
 * Slice the project's actions into the operating views leadership reads, and pick
 * the single recommended next action (worst-first: overdue, then highest priority,
 * then soonest due). Pure.
 */
export function deriveProjectActionIntelligence(
  actions: ActionItemWithRelations[],
  now: Date = new Date()
): ProjectActionIntelligence {
  const lite = actions.map((a) => toActionLite(a, now));
  const open = lite.filter((a) => !SETTLED.has(a.status));
  const completed = lite.filter((a) => a.status === "COMPLETE");
  const overdue = open.filter((a) => a.overdue);
  const unowned = open.filter((a) => !a.ownerName);
  const noDueDate = open.filter((a) => !a.dueISO);
  const fromMeetings = lite.filter((a) => a.fromMeeting);

  const recommendedNext =
    [...open].sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      const pr = (PRIORITY_RANK[b.priority] ?? 0) - (PRIORITY_RANK[a.priority] ?? 0);
      if (pr !== 0) return pr;
      const ad = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    })[0] ?? null;

  return {
    open,
    overdue,
    completed,
    unowned,
    noDueDate,
    fromMeetings,
    recommendedNext,
    counts: {
      total: lite.length,
      open: open.length,
      overdue: overdue.length,
      completed: completed.length,
      unowned: unowned.length,
      noDueDate: noDueDate.length,
      fromMeetings: fromMeetings.length,
    },
  };
}

// --- meeting intelligence ----------------------------------------------------

export type ProjectMeetingLite = {
  id: string;
  title: string;
  href: string;
  startISO: string;
  decisionCount: number;
  linkedActionCount: number;
  openFollowUps: number;
  overdueFollowUps: number;
  producedFollowThrough: boolean;
};

export type ProjectMeetingIntelligence = {
  connected: ProjectMeetingLite[];
  producedActions: ProjectMeetingLite[];
  producedDecisions: ProjectMeetingLite[];
  noFollowUp: ProjectMeetingLite[];
  counts: {
    total: number;
    producedActions: number;
    producedDecisions: number;
    noFollowUp: number;
  };
  /** True when the project has open work but no recent meeting — recommend one. */
  nextMeetingRecommended: boolean;
};

const MEETING_RECENT_DAYS = 21;

function toMeetingLite(m: MeetingCardDTO): ProjectMeetingLite {
  return {
    id: m.id,
    title: m.title,
    href: `/meetings/${m.id}`,
    startISO: m.startISO,
    decisionCount: m.decisionCount,
    linkedActionCount: m.linkedActionCount,
    openFollowUps: m.openFollowUps,
    overdueFollowUps: m.overdueFollowUps,
    producedFollowThrough: m.decisionCount > 0 || m.linkedActionCount > 0,
  };
}

/**
 * Slice the project's meetings into the operating views, and recommend a next
 * meeting when there is open work but nothing has convened recently. Pure.
 */
export function deriveProjectMeetingIntelligence(
  meetings: MeetingCardDTO[],
  openActionCount: number,
  now: Date = new Date()
): ProjectMeetingIntelligence {
  const lite = meetings.map(toMeetingLite).sort((a, b) => b.startISO.localeCompare(a.startISO));
  const connected = lite;
  const producedActions = lite.filter((m) => m.linkedActionCount > 0);
  const producedDecisions = lite.filter((m) => m.decisionCount > 0);
  const noFollowUp = lite.filter(
    (m) => !m.producedFollowThrough && new Date(m.startISO).getTime() <= now.getTime()
  );

  const dayMs = 24 * 60 * 60 * 1000;
  const hasRecentMeeting = lite.some(
    (m) => (now.getTime() - new Date(m.startISO).getTime()) / dayMs <= MEETING_RECENT_DAYS &&
      new Date(m.startISO).getTime() <= now.getTime()
  );
  const nextMeetingRecommended = openActionCount > 0 && !hasRecentMeeting;

  return {
    connected,
    producedActions,
    producedDecisions,
    noFollowUp,
    counts: {
      total: lite.length,
      producedActions: producedActions.length,
      producedDecisions: producedDecisions.length,
      noFollowUp: noFollowUp.length,
    },
    nextMeetingRecommended,
  };
}

// --- dependency view ---------------------------------------------------------

export type ProjectDependencyView = {
  dependsOn: Array<{ label: string; atRisk: boolean }>;
  unlocks: string[];
  hasDeclaredDependencies: boolean;
  /** True when any observed (execution) or at-risk declared blocker exists. */
  blocked: boolean;
};

/** The project's declared dependency view (upstream waits, downstream unlocks). */
export function deriveProjectDependencyView(
  def: Pick<StrategicProjectDef, "dependsOn" | "unlocks">,
  options: { dependencyAtRisk?: boolean; observedBlockers?: number } = {}
): ProjectDependencyView {
  const dependsOn = (def.dependsOn ?? []).map((label) => ({
    label,
    atRisk: !!options.dependencyAtRisk,
  }));
  const unlocks = def.unlocks ?? [];
  return {
    dependsOn,
    unlocks,
    hasDeclaredDependencies: dependsOn.length > 0,
    blocked: (options.observedBlockers ?? 0) > 0 || dependsOn.some((d) => d.atRisk),
  };
}
