import type {
  ActionItemStatus,
  AgendaItemKind,
  PreparedPresentationStatus,
  PresentationExpectationKind,
  Prisma,
  TeamMeetingStatus,
  WeeklyBriefStatus,
} from "@prisma/client";

import { isWeeklyTeamBriefsEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

import type { ActionViewer } from "./action-permissions";
import {
  canEditWeeklyBriefOverall,
  canViewWeeklyBrief,
  type WeeklyBriefAccessShape,
  type WeeklyBriefTaskAccess,
} from "./weekly-brief-permissions";
import {
  actionToMatchable,
  getInitiativeDef,
  getWorkstreamDef,
  listInitiativeDefs,
  matchWork,
  type StrategicInitiativeDef,
  type WorkstreamDef,
} from "./strategic-initiatives";

const PERSON_SELECT = { id: true, name: true, email: true } as const;
const ACTIVE_STATUSES: ActionItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "OVERDUE",
  "BLOCKED",
];

const ACTION_FOR_BRIEF_INCLUDE = {
  lead: { select: PERSON_SELECT },
  assignments: { select: { userId: true, role: true } },
  fileLinks: { orderBy: [{ addedAt: "desc" }, { id: "desc" }] },
} satisfies Prisma.ActionItemInclude;

const BRIEF_INCLUDE = {
  teamLead: { select: PERSON_SELECT },
  officerMeeting: { select: { id: true, title: true, date: true } },
  teamMeeting: {
    include: {
      teamLead: { select: PERSON_SELECT },
      targetOfficerMeeting: { select: { id: true, title: true, date: true } },
    },
  },
  taskUpdates: {
    include: {
      actionItem: { include: ACTION_FOR_BRIEF_INCLUDE },
      teamMeetingPresenter: { select: PERSON_SELECT },
      officerMeetingPresenter: { select: PERSON_SELECT },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  memberUpdates: {
    include: { user: { select: PERSON_SELECT } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  preparedPresentationItems: {
    include: {
      presenter: { select: PERSON_SELECT },
      actionItem: { select: { id: true, title: true, status: true } },
      presentationExpectation: { select: { id: true, kind: true, prompt: true } },
      targetOfficerMeeting: { select: { id: true, title: true, date: true } },
      agendaItem: { select: { id: true, officerMeetingId: true, status: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  followUps: {
    include: { owner: { select: PERSON_SELECT }, sourceAction: { select: { id: true, title: true } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  },
} satisfies Prisma.WeeklyTeamBriefInclude;

const EXPECTATION_INCLUDE = {
  presenter: { select: PERSON_SELECT },
  actionItem: { select: { id: true, title: true, status: true } },
  sourceMeeting: { select: { id: true, title: true, date: true } },
  targetOfficerMeeting: { select: { id: true, title: true, date: true } },
} satisfies Prisma.TeamPresentationExpectationInclude;

type ActionForBrief = Prisma.ActionItemGetPayload<{
  include: typeof ACTION_FOR_BRIEF_INCLUDE;
}>;

export type BriefPersonDTO = { id: string; name: string };

export type BriefMeetingDTO = { id: string; title: string; dateISO: string };

export type BriefDeliverableDTO = {
  id: string;
  label: string;
  url: string;
  addedAtISO: string;
};

export type WeeklyBriefTaskUpdateDTO = {
  id: string;
  actionItemId: string | null;
  taskTitle: string;
  liveStatus: ActionItemStatus | null;
  deadlineISO: string | null;
  owner: BriefPersonDTO | null;
  commitment: string | null;
  statusNarrative: string | null;
  workCompleted: string | null;
  currentResult: string | null;
  remainingWork: string | null;
  blockerNote: string | null;
  explanation: string | null;
  decisionNeeded: string | null;
  nextAction: string | null;
  teamMeetingReady: boolean;
  officerMeetingReady: boolean;
  escalationNeeded: boolean;
  officerReviewRequested: boolean;
  teamMeetingPresenter: BriefPersonDTO | null;
  officerMeetingPresenter: BriefPersonDTO | null;
  deliverables: BriefDeliverableDTO[];
  allDeliverables: BriefDeliverableDTO[];
  expectationIds: string[];
  /** Last week promised a next step on this task and it is still open. */
  carriedForward?: boolean;
};

/**
 * One person's Weekly Impact form inside a team brief: their Section 1 (objective
 * + deliverable + target date) and Section 4 (input needed) header, plus the
 * Section 2/3 task rows they own (grouped from the brief's task updates).
 */
export type WeeklyMemberFormDTO = {
  id: string;
  user: BriefPersonDTO;
  /** True when this form belongs to the viewer (drives "My Weekly Impact"). */
  isSelf: boolean;
  status: WeeklyBriefStatus;
  submittedAtISO: string | null;
  personalObjective: string | null;
  personalDeliverable: string | null;
  targetDateISO: string | null;
  inputNeeded: string | null;
  inputNeededFrom: string | null;
  inputNeededByISO: string | null;
  /** This week's Input Needed was carried forward from last week (still open). */
  inputNeededCarried: boolean;
  carriedForwardFromId: string | null;
  taskUpdates: WeeklyBriefTaskUpdateDTO[];
};

export type WeeklyBriefWorkspace = {
  id: string;
  initiativeId: string;
  initiativeTitle: string;
  initiativeLeadNames: string[];
  workstreamId: string;
  workstreamTitle: string;
  workstreamDescription: string | null;
  weekStartISO: string;
  weekEndISO: string;
  weekKey: string;
  status: WeeklyBriefStatus;
  teamObjective: string | null;
  overallStatus: string | null;
  lastCommitments: string | null;
  blockersSummary: string | null;
  decisionsNeeded: string | null;
  nextActionsSummary: string | null;
  nextCycleCommitments: string | null;
  readyForTeamMeeting: boolean;
  readyForOfficerMeeting: boolean;
  teamLead: BriefPersonDTO | null;
  officerMeeting: BriefMeetingDTO | null;
  teamMeeting: {
    id: string;
    title: string;
    status: TeamMeetingStatus;
    targetOfficerMeeting: BriefMeetingDTO | null;
    finalizedAtISO: string | null;
  } | null;
  taskUpdates: WeeklyBriefTaskUpdateDTO[];
  members: WeeklyMemberFormDTO[];
  expectations: Array<{
    id: string;
    kind: PresentationExpectationKind;
    prompt: string;
    requiredQuestion: string | null;
    requiredDeliverable: string | null;
    actionItemId: string | null;
    actionTitle: string | null;
    presenter: BriefPersonDTO | null;
    dueDateISO: string | null;
    dueWeekStartISO: string | null;
    sourceMeeting: BriefMeetingDTO | null;
    targetOfficerMeeting: BriefMeetingDTO | null;
  }>;
  preparedPresentationItems: Array<{
    id: string;
    title: string;
    reasonForOfficerReview: string;
    statusSummary: string | null;
    requestedDecision: string | null;
    readiness: PreparedPresentationStatus;
    actionItemId: string | null;
    actionTitle: string | null;
    presenter: BriefPersonDTO | null;
    targetOfficerMeeting: BriefMeetingDTO | null;
    agendaItemId: string | null;
    deliverableLinkIds: string[];
    expectationPrompt: string | null;
  }>;
  followUps: Array<{
    id: string;
    title: string;
    description: string | null;
    status: string;
    owner: BriefPersonDTO | null;
    sourceActionTitle: string | null;
    dueDateISO: string | null;
  }>;
};

export type OfficerPreparedPresentation = {
  id: string;
  title: string;
  reasonForOfficerReview: string;
  statusSummary: string | null;
  requestedDecision: string | null;
  readiness: PreparedPresentationStatus;
  initiativeId: string;
  initiativeTitle: string;
  workstreamId: string;
  workstreamTitle: string;
  briefId: string;
  briefWeekKey: string;
  teamMeetingId: string | null;
  teamMeetingTitle: string;
  actionItemId: string | null;
  actionTitle: string | null;
  presenter: BriefPersonDTO | null;
  expectationPrompt: string | null;
  agendaItemId: string | null;
  deliverables: Array<{ id: string; label: string; url: string }>;
};

export function startOfUTCWeek(input: Date): Date {
  const day = input.getUTCDay();
  const diff = (day + 6) % 7;
  const d = new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  );
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

export function endOfUTCWeek(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setUTCDate(d.getUTCDate() + 6);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

export function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseWeekStart(value: string | Date): Date {
  if (value instanceof Date) return startOfUTCWeek(value);
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) throw new Error("A valid week is required");
  return startOfUTCWeek(parsed);
}

function ensureEnabled() {
  if (!isWeeklyTeamBriefsEnabled()) {
    throw new Error("Weekly Team Briefs are not enabled");
  }
}

function firstConfiguredLeadId(ws: WorkstreamDef): string | null {
  return ws.leadUserId ?? ws.leadUserIds?.[0] ?? null;
}

function workstreamLeadIds(ws: WorkstreamDef): string[] {
  return [ws.leadUserId, ...(ws.leadUserIds ?? [])].filter(
    (id): id is string => Boolean(id)
  );
}

function initiativeLeadIds(def: StrategicInitiativeDef): string[] {
  return def.leadUserIds ?? [];
}

function actionBelongsToInitiative(
  def: StrategicInitiativeDef,
  action: ActionForBrief
): boolean {
  if (action.strategicInitiativeId === def.id) return true;
  return matchWork(actionToMatchable(action), def.match).matched;
}

export function actionBelongsToWorkstream(
  def: StrategicInitiativeDef,
  ws: WorkstreamDef,
  action: ActionForBrief
): boolean {
  if (!actionBelongsToInitiative(def, action)) return false;
  return matchWork(actionToMatchable(action), ws.match).matched;
}

function taskAccess(action: ActionForBrief): WeeklyBriefTaskAccess {
  return {
    leadId: action.leadId,
    createdById: action.createdById,
    visibility: action.visibility,
    assignments: action.assignments.map((a) => ({
      userId: a.userId,
      role: a.role,
    })),
  };
}

function briefAccessShape(
  brief: Prisma.WeeklyTeamBriefGetPayload<{ include: typeof BRIEF_INCLUDE }>,
  def: StrategicInitiativeDef,
  ws: WorkstreamDef
): WeeklyBriefAccessShape {
  return {
    teamLeadId: brief.teamLeadId,
    workstreamLeadUserIds: workstreamLeadIds(ws),
    initiativeLeadUserIds: initiativeLeadIds(def),
    taskUpdates: brief.taskUpdates.map((u) => ({
      actionItem: u.actionItem ? taskAccess(u.actionItem) : null,
    })),
  };
}

async function findTargetOfficerMeeting(weekStart: Date, weekEnd: Date) {
  return prisma.officerMeeting.findFirst({
    where: {
      date: { gte: weekStart, lte: weekEnd },
      status: { not: "CANCELLED" },
    },
    orderBy: [{ date: "asc" }],
    select: { id: true },
  });
}

async function loadCandidateActions(weekStart: Date, weekEnd: Date) {
  return prisma.actionItem.findMany({
    where: {
      OR: [
        { status: { in: ACTIVE_STATUSES } },
        { completedAt: { gte: weekStart, lte: weekEnd } },
      ],
    },
    include: ACTION_FOR_BRIEF_INCLUDE,
    orderBy: [{ deadlineStart: "asc" }, { createdAt: "asc" }],
  });
}

export async function generateWeeklyTeamBriefs(
  now: Date = new Date(),
  opts: {
    initiativeId?: string;
    workstreamId?: string;
    createdById?: string | null;
    targetOfficerMeetingId?: string | null;
    forceEmptyTeam?: boolean;
  } = {}
) {
  if (!isWeeklyTeamBriefsEnabled()) {
    return {
      createdBriefs: 0,
      touchedBriefs: 0,
      seededTaskUpdates: 0,
      seededMemberUpdates: 0,
      createdTeamMeetings: 0,
    };
  }

  const weekStart = startOfUTCWeek(now);
  const weekEnd = endOfUTCWeek(weekStart);
  const targetMeeting =
    opts.targetOfficerMeetingId === undefined
      ? await findTargetOfficerMeeting(weekStart, weekEnd)
      : opts.targetOfficerMeetingId
        ? { id: opts.targetOfficerMeetingId }
        : null;

  const [actions, expectations, followUps] = await Promise.all([
    loadCandidateActions(weekStart, weekEnd),
    prisma.teamPresentationExpectation.findMany({
      where: {
        status: "OPEN",
        returnToNextAgenda: true,
        ...(opts.initiativeId ? { initiativeId: opts.initiativeId } : {}),
        ...(opts.workstreamId ? { workstreamId: opts.workstreamId } : {}),
        OR: [{ dueWeekStart: null }, { dueWeekStart: { lte: weekStart } }],
      },
    }),
    prisma.meetingFollowUp.findMany({
      where: {
        status: { not: "COMPLETED" },
        ...(opts.initiativeId ? { initiativeId: opts.initiativeId } : {}),
        ...(opts.workstreamId ? { workstreamId: opts.workstreamId } : {}),
      },
      select: { id: true, initiativeId: true, workstreamId: true, sourceActionId: true },
    }),
  ]);

  let createdBriefs = 0;
  let touchedBriefs = 0;
  let seededTaskUpdates = 0;
  let seededMemberUpdates = 0;
  let createdTeamMeetings = 0;

  for (const def of listInitiativeDefs()) {
    if (opts.initiativeId && def.id !== opts.initiativeId) continue;
    for (const ws of def.workstreams ?? []) {
      if (opts.workstreamId && ws.id !== opts.workstreamId) continue;
      const teamActions = actions.filter((action) => actionBelongsToWorkstream(def, ws, action));
      const teamExpectations = expectations.filter(
        (e) => e.initiativeId === def.id && e.workstreamId === ws.id
      );
      const teamFollowUps = followUps.filter(
        (f) => f.initiativeId === def.id && f.workstreamId === ws.id
      );
      if (
        !opts.forceEmptyTeam &&
        teamActions.length === 0 &&
        teamExpectations.length === 0 &&
        teamFollowUps.length === 0
      ) {
        continue;
      }

      const existing = await prisma.weeklyTeamBrief.findUnique({
        where: { initiativeId_workstreamId_weekStart: { initiativeId: def.id, workstreamId: ws.id, weekStart } },
        select: { id: true },
      });
      if (!existing) createdBriefs += 1;

      const brief = await prisma.weeklyTeamBrief.upsert({
        where: { initiativeId_workstreamId_weekStart: { initiativeId: def.id, workstreamId: ws.id, weekStart } },
        create: {
          initiativeId: def.id,
          workstreamId: ws.id,
          weekStart,
          weekEnd,
          teamObjective: ws.description ?? def.description,
          teamLeadId: firstConfiguredLeadId(ws),
          officerMeetingId: targetMeeting?.id ?? null,
          createdById: opts.createdById ?? null,
        },
        update: {
          officerMeetingId: targetMeeting?.id ?? undefined,
        },
        select: { id: true, status: true },
      });
      touchedBriefs += 1;

      const existingMeeting = await prisma.teamMeeting.findUnique({
        where: { briefId: brief.id },
        select: { id: true },
      });
      if (!existingMeeting) createdTeamMeetings += 1;
      await prisma.teamMeeting.upsert({
        where: { briefId: brief.id },
        create: {
          initiativeId: def.id,
          workstreamId: ws.id,
          weekStart,
          weekEnd,
          title: `${ws.title} Team Meeting`,
          briefId: brief.id,
          teamLeadId: firstConfiguredLeadId(ws),
          targetOfficerMeetingId: targetMeeting?.id ?? null,
          createdById: opts.createdById ?? null,
        },
        update: {
          targetOfficerMeetingId: targetMeeting?.id ?? undefined,
        },
      });

      if (brief.status === "FINALIZED") continue;

      // Load last week's brief once so this week's forms can carry forward
      // unfinished commitments (Section 3 next steps) and unanswered input
      // (Section 4) — the accountability the paper form can't enforce.
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setUTCDate(prevWeekStart.getUTCDate() - 7);
      const prevBrief = await prisma.weeklyTeamBrief.findUnique({
        where: {
          initiativeId_workstreamId_weekStart: {
            initiativeId: def.id,
            workstreamId: ws.id,
            weekStart: prevWeekStart,
          },
        },
        select: {
          taskUpdates: { select: { actionItemId: true, nextAction: true } },
          memberUpdates: {
            select: {
              id: true,
              userId: true,
              inputNeeded: true,
              inputNeededFrom: true,
              inputNeededBy: true,
            },
          },
        },
      });
      const prevNextActionByAction = new Map<string, string>();
      for (const prev of prevBrief?.taskUpdates ?? []) {
        if (prev.actionItemId && prev.nextAction?.trim()) {
          prevNextActionByAction.set(prev.actionItemId, prev.nextAction);
        }
      }

      for (const action of teamActions) {
        const matchingExpectationIds = teamExpectations
          .filter((e) => !e.actionItemId || e.actionItemId === action.id)
          .map((e) => e.id);
        const updateExists = await prisma.weeklyTaskUpdate.findUnique({
          where: { briefId_actionItemId: { briefId: brief.id, actionItemId: action.id } },
          select: { id: true },
        });
        if (!updateExists) seededTaskUpdates += 1;
        // Carry forward: last week promised a next step on this task and the task
        // is still open → flag it so the form shows "carried from last week".
        const carriedForward =
          Boolean(prevNextActionByAction.get(action.id)) &&
          ACTIVE_STATUSES.includes(action.status);
        await prisma.weeklyTaskUpdate.upsert({
          where: { briefId_actionItemId: { briefId: brief.id, actionItemId: action.id } },
          create: {
            briefId: brief.id,
            actionItemId: action.id,
            taskTitleSnapshot: action.title,
            commitmentSnapshot: action.successDefinition,
            blockerNote: action.blockedReason,
            currentResult: action.completionNote,
            deliverableLinkIds: action.fileLinks.map((link) => link.id),
            expectationIds: matchingExpectationIds,
            officerReviewRequested: matchingExpectationIds.length > 0,
            escalationNeeded: action.status === "BLOCKED",
            carriedForward,
          },
          update: {
            expectationIds: { set: matchingExpectationIds },
            escalationNeeded: action.status === "BLOCKED",
          },
        });
      }

      // Per-person ("Both") seeding: every person on the team this week gets
      // exactly one Weekly Impact form header, pre-seeded with last week's
      // unanswered Input Needed. Existing rows are never overwritten, so the
      // generator stays idempotent and never clobbers typed content.
      const teamPeople = new Set<string>(workstreamLeadIds(ws));
      for (const action of teamActions) {
        if (action.leadId) teamPeople.add(action.leadId);
        for (const assignment of action.assignments) teamPeople.add(assignment.userId);
      }
      const prevMemberByUser = new Map(
        (prevBrief?.memberUpdates ?? []).map((m) => [m.userId, m])
      );
      for (const userId of teamPeople) {
        const memberExists = await prisma.weeklyMemberUpdate.findUnique({
          where: { briefId_userId: { briefId: brief.id, userId } },
          select: { id: true },
        });
        if (memberExists) continue;
        seededMemberUpdates += 1;
        const prevMember = prevMemberByUser.get(userId);
        const carryInput = Boolean(prevMember?.inputNeeded?.trim());
        await prisma.weeklyMemberUpdate.create({
          data: {
            briefId: brief.id,
            userId,
            createdById: opts.createdById ?? null,
            inputNeeded: carryInput ? prevMember?.inputNeeded ?? null : null,
            inputNeededFrom: carryInput ? prevMember?.inputNeededFrom ?? null : null,
            inputNeededBy: carryInput ? prevMember?.inputNeededBy ?? null : null,
            inputNeededCarried: carryInput,
            carriedForwardFromId: carryInput ? prevMember?.id ?? null : null,
          },
        });
      }
    }
  }

  return {
    createdBriefs,
    touchedBriefs,
    seededTaskUpdates,
    seededMemberUpdates,
    createdTeamMeetings,
  };
}

export async function loadWeeklyBriefWorkspace(input: {
  initiativeId: string;
  workstreamId: string;
  weekStart: string | Date;
  viewer: ActionViewer;
  autoGenerate?: boolean;
}) {
  if (!isWeeklyTeamBriefsEnabled()) return null;
  const def = getInitiativeDef(input.initiativeId);
  const ws = getWorkstreamDef(input.initiativeId, input.workstreamId);
  if (!def || !ws) return null;

  const weekStart = parseWeekStart(input.weekStart);
  if (input.autoGenerate) {
    const seedAccess: WeeklyBriefAccessShape = {
      teamLeadId: firstConfiguredLeadId(ws),
      workstreamLeadUserIds: workstreamLeadIds(ws),
      initiativeLeadUserIds: initiativeLeadIds(def),
      taskUpdates: [],
    };
    if (canEditWeeklyBriefOverall(input.viewer, seedAccess)) {
      await generateWeeklyTeamBriefs(weekStart, {
        initiativeId: def.id,
        workstreamId: ws.id,
        createdById: input.viewer.id,
        forceEmptyTeam: true,
      });
    }
  }

  const brief = await prisma.weeklyTeamBrief.findUnique({
    where: { initiativeId_workstreamId_weekStart: { initiativeId: def.id, workstreamId: ws.id, weekStart } },
    include: BRIEF_INCLUDE,
  });
  if (!brief) return null;
  const access = briefAccessShape(brief, def, ws);
  if (!canViewWeeklyBrief(input.viewer, access)) return null;

  const expectations = await prisma.teamPresentationExpectation.findMany({
    where: {
      initiativeId: def.id,
      workstreamId: ws.id,
      status: "OPEN",
      returnToNextAgenda: true,
      OR: [{ dueWeekStart: null }, { dueWeekStart: { lte: weekStart } }],
    },
    include: EXPECTATION_INCLUDE,
    orderBy: [{ dueWeekStart: "asc" }, { createdAt: "asc" }],
  });

  return mapBriefWorkspace(brief, def, ws, expectations, input.viewer, access);
}

export async function loadPreparedPresentationsForOfficerMeeting(
  officerMeetingId: string
): Promise<OfficerPreparedPresentation[]> {
  if (!isWeeklyTeamBriefsEnabled()) return [];
  const items = await prisma.preparedPresentationItem.findMany({
    where: {
      OR: [
        { targetOfficerMeetingId: officerMeetingId },
        { agendaItem: { officerMeetingId } },
      ],
      readiness: { in: ["READY", "SUBMITTED", "ACCEPTED", "REVISION_REQUESTED"] },
    },
    include: {
      brief: { select: { id: true, initiativeId: true, workstreamId: true, weekStart: true } },
      teamMeeting: { select: { id: true, title: true, status: true } },
      actionItem: { select: { id: true, title: true, status: true, fileLinks: { select: { id: true, label: true, url: true } } } },
      presenter: { select: PERSON_SELECT },
      presentationExpectation: { select: { id: true, kind: true, prompt: true } },
      agendaItem: { select: { id: true, status: true, officerMeetingId: true } },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return items.map((item) => {
    const def = getInitiativeDef(item.initiativeId);
    const ws = getWorkstreamDef(item.initiativeId, item.workstreamId);
    const deliverableIds = new Set(item.deliverableLinkIds);
    return {
      id: item.id,
      title: item.title,
      reasonForOfficerReview: item.reasonForOfficerReview,
      statusSummary: item.statusSummary,
      requestedDecision: item.requestedDecision,
      readiness: item.readiness,
      initiativeId: item.initiativeId,
      initiativeTitle: def?.title ?? item.initiativeId,
      workstreamId: item.workstreamId,
      workstreamTitle: ws?.title ?? item.workstreamId,
      briefId: item.briefId,
      briefWeekKey: dateKey(item.brief.weekStart),
      teamMeetingId: item.teamMeetingId,
      teamMeetingTitle: item.teamMeeting?.title ?? "Team Meeting",
      actionItemId: item.actionItemId,
      actionTitle: item.actionItem?.title ?? null,
      presenter: personDTO(item.presenter),
      expectationPrompt: item.presentationExpectation?.prompt ?? null,
      agendaItemId: item.agendaItem?.id ?? null,
      deliverables: (item.actionItem?.fileLinks ?? [])
        .filter((link) => deliverableIds.size === 0 || deliverableIds.has(link.id))
        .map((link) => ({ id: link.id, label: link.label, url: link.url })),
    };
  });
}

export async function loadInitiativeWeeklyBriefSummaries(
  initiativeId: string,
  now: Date = new Date()
) {
  if (!isWeeklyTeamBriefsEnabled()) return [];
  const def = getInitiativeDef(initiativeId);
  if (!def) return [];
  const weekStart = startOfUTCWeek(now);
  await generateWeeklyTeamBriefs(weekStart, { initiativeId });
  const briefs = await prisma.weeklyTeamBrief.findMany({
    where: { initiativeId, weekStart },
    include: {
      taskUpdates: { select: { id: true, teamMeetingReady: true, officerMeetingReady: true, escalationNeeded: true } },
      preparedPresentationItems: { select: { id: true, readiness: true } },
      teamMeeting: { select: { id: true, status: true } },
    },
  });
  const byWorkstream = new Map(briefs.map((brief) => [brief.workstreamId, brief]));
  return (def.workstreams ?? []).map((ws) => {
    const brief = byWorkstream.get(ws.id);
    const readyTasks = brief?.taskUpdates.filter((u) => u.teamMeetingReady).length ?? 0;
    const officerReady = brief?.taskUpdates.filter((u) => u.officerMeetingReady).length ?? 0;
    const blockers = brief?.taskUpdates.filter((u) => u.escalationNeeded).length ?? 0;
    return {
      workstreamId: ws.id,
      workstreamTitle: ws.title,
      workstreamDescription: ws.description ?? null,
      weekKey: dateKey(weekStart),
      href: `/operations/initiatives/${initiativeId}/teams/${ws.id}/brief/${dateKey(weekStart)}`,
      status: brief?.status ?? "NOT_GENERATED",
      teamMeetingStatus: brief?.teamMeeting?.status ?? null,
      taskCount: brief?.taskUpdates.length ?? 0,
      readyTasks,
      officerReady,
      blockers,
      preparedCount: brief?.preparedPresentationItems.length ?? 0,
    };
  });
}

function personDTO(p: { id: string; name: string | null; email: string | null } | null) {
  if (!p) return null;
  return { id: p.id, name: p.name ?? p.email ?? "Unknown" };
}

function serializeMeeting(m: { id: string; title: string | null; date: Date } | null) {
  if (!m) return null;
  return {
    id: m.id,
    title: m.title ?? "Officer Meeting",
    dateISO: m.date.toISOString(),
  };
}

type BriefWithIncludes = Prisma.WeeklyTeamBriefGetPayload<{ include: typeof BRIEF_INCLUDE }>;
type BriefTaskUpdateRow = BriefWithIncludes["taskUpdates"][number];
type BriefMemberRow = BriefWithIncludes["memberUpdates"][number];

function taskUpdateToDTO(u: BriefTaskUpdateRow): WeeklyBriefTaskUpdateDTO {
  return {
    id: u.id,
    actionItemId: u.actionItemId,
    taskTitle: u.taskTitleSnapshot,
    liveStatus: u.actionItem?.status ?? null,
    deadlineISO: u.actionItem?.deadlineStart.toISOString() ?? null,
    owner: personDTO(u.actionItem?.lead ?? null),
    commitment: u.commitmentSnapshot,
    statusNarrative: u.statusNarrative,
    workCompleted: u.workCompleted,
    currentResult: u.currentResult,
    remainingWork: u.remainingWork,
    blockerNote: u.blockerNote,
    explanation: u.explanation,
    decisionNeeded: u.decisionNeeded,
    nextAction: u.nextAction,
    teamMeetingReady: u.teamMeetingReady,
    officerMeetingReady: u.officerMeetingReady,
    escalationNeeded: u.escalationNeeded,
    officerReviewRequested: u.officerReviewRequested,
    teamMeetingPresenter: personDTO(u.teamMeetingPresenter),
    officerMeetingPresenter: personDTO(u.officerMeetingPresenter),
    deliverables: u.actionItem ? deliverablesForIds(u.deliverableLinkIds, u.actionItem.fileLinks) : [],
    allDeliverables: (u.actionItem?.fileLinks ?? []).map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      addedAtISO: link.addedAt.toISOString(),
    })),
    expectationIds: u.expectationIds,
    carriedForward: u.carriedForward,
  };
}

function memberFormToDTO(
  m: BriefMemberRow,
  tasks: BriefTaskUpdateRow[],
  viewerId: string
): WeeklyMemberFormDTO {
  return {
    id: m.id,
    user: personDTO(m.user) ?? { id: m.userId, name: "Unknown" },
    isSelf: m.userId === viewerId,
    status: m.status,
    submittedAtISO: m.submittedAt?.toISOString() ?? null,
    personalObjective: m.personalObjective,
    personalDeliverable: m.personalDeliverable,
    targetDateISO: m.targetDate?.toISOString() ?? null,
    inputNeeded: m.inputNeeded,
    inputNeededFrom: m.inputNeededFrom,
    inputNeededByISO: m.inputNeededBy?.toISOString() ?? null,
    inputNeededCarried: m.inputNeededCarried,
    carriedForwardFromId: m.carriedForwardFromId,
    taskUpdates: tasks.map(taskUpdateToDTO),
  };
}

export type MyWeeklyImpactTeamForm = {
  briefId: string;
  initiativeId: string;
  workstreamId: string;
  workstreamTitle: string;
  weekKey: string;
  briefStatus: WeeklyBriefStatus;
  officerMeeting: BriefMeetingDTO | null;
  form: WeeklyMemberFormDTO;
};

export type MyWeeklyImpact = {
  weekKey: string;
  weekStartISO: string;
  initiativeId: string;
  initiativeTitle: string;
  forms: MyWeeklyImpactTeamForm[];
  /** Impact teams the viewer is not on yet — offered as one-click "start my form". */
  joinableTeams: Array<{ workstreamId: string; title: string }>;
};

/**
 * The signed-in person's own Weekly Impact forms for the current week, one per
 * team they're on (their Section 1/4 header + the Section 2/3 task rows they
 * lead). Generates this week's team briefs first (idempotent) so anyone with
 * matched work already has a pre-filled form, and lists the teams they could
 * still join. Powers the `/my-weekly-impact` surface.
 */
export async function loadMyWeeklyImpact(input: {
  initiativeId: string;
  viewer: ActionViewer;
  now?: Date;
}): Promise<MyWeeklyImpact | null> {
  if (!isWeeklyTeamBriefsEnabled()) return null;
  const def = getInitiativeDef(input.initiativeId);
  if (!def) return null;
  const weekStart = startOfUTCWeek(input.now ?? new Date());

  await generateWeeklyTeamBriefs(weekStart, {
    initiativeId: input.initiativeId,
    createdById: input.viewer.id,
    forceEmptyTeam: true,
  });

  const briefs = await prisma.weeklyTeamBrief.findMany({
    where: { initiativeId: input.initiativeId, weekStart },
    include: BRIEF_INCLUDE,
  });

  const forms: MyWeeklyImpactTeamForm[] = [];
  const myTeamIds = new Set<string>();
  for (const brief of briefs) {
    const ws = getWorkstreamDef(input.initiativeId, brief.workstreamId);
    if (!ws) continue;
    const mine = brief.memberUpdates.find((m) => m.userId === input.viewer.id);
    if (!mine) continue;
    myTeamIds.add(brief.workstreamId);
    const myTasks = brief.taskUpdates.filter(
      (u) => u.actionItem?.leadId === input.viewer.id
    );
    forms.push({
      briefId: brief.id,
      initiativeId: input.initiativeId,
      workstreamId: brief.workstreamId,
      workstreamTitle: ws.title,
      weekKey: dateKey(brief.weekStart),
      briefStatus: brief.status,
      officerMeeting: serializeMeeting(brief.officerMeeting),
      form: memberFormToDTO(mine, myTasks, input.viewer.id),
    });
  }
  forms.sort((a, b) => a.workstreamTitle.localeCompare(b.workstreamTitle));

  const joinableTeams = (def.workstreams ?? [])
    .filter((ws) => !myTeamIds.has(ws.id))
    .map((ws) => ({ workstreamId: ws.id, title: ws.title }));

  return {
    weekKey: dateKey(weekStart),
    weekStartISO: weekStart.toISOString(),
    initiativeId: input.initiativeId,
    initiativeTitle: def.title,
    forms,
    joinableTeams,
  };
}

function deliverablesForIds(
  ids: string[],
  links: Array<{ id: string; label: string; url: string; addedAt: Date }>
) {
  const wanted = new Set(ids);
  return links
    .filter((link) => wanted.size === 0 || wanted.has(link.id))
    .map((link) => ({
      id: link.id,
      label: link.label,
      url: link.url,
      addedAtISO: link.addedAt.toISOString(),
    }));
}

function mapBriefWorkspace(
  brief: Prisma.WeeklyTeamBriefGetPayload<{ include: typeof BRIEF_INCLUDE }>,
  def: StrategicInitiativeDef,
  ws: WorkstreamDef,
  expectations: Array<Prisma.TeamPresentationExpectationGetPayload<{ include: typeof EXPECTATION_INCLUDE }>>,
  viewer: ActionViewer,
  access: WeeklyBriefAccessShape
): WeeklyBriefWorkspace {
  const viewerCanSeeAll =
    canViewWeeklyBrief(viewer, { ...access, taskUpdates: [] }) ||
    access.teamLeadId === viewer.id;
  const visibleTaskUpdates = viewerCanSeeAll
    ? brief.taskUpdates
    : brief.taskUpdates.filter((u) => u.actionItem && canViewWeeklyBrief(viewer, { ...access, taskUpdates: [{ actionItem: taskAccess(u.actionItem) }] }));

  const taskUpdateDTOs = visibleTaskUpdates.map(taskUpdateToDTO);

  // Per-person forms: leads/officers see everyone; an individual contributor
  // sees only their own Section 1/4 header (their tasks were already visibility-
  // filtered above). Each member's Section 2/3 detail is the task rows they lead.
  const visibleMembers = viewerCanSeeAll
    ? brief.memberUpdates
    : brief.memberUpdates.filter((m) => m.userId === viewer.id);
  const members: WeeklyMemberFormDTO[] = visibleMembers.map((m) =>
    memberFormToDTO(
      m,
      visibleTaskUpdates.filter((u) => u.actionItem?.leadId === m.userId),
      viewer.id
    )
  );

  return {
    id: brief.id,
    initiativeId: def.id,
    initiativeTitle: def.title,
    initiativeLeadNames: def.leads ?? (def.owner ? [def.owner] : []),
    workstreamId: ws.id,
    workstreamTitle: ws.title,
    workstreamDescription: ws.description ?? null,
    weekStartISO: brief.weekStart.toISOString(),
    weekEndISO: brief.weekEnd.toISOString(),
    weekKey: dateKey(brief.weekStart),
    status: brief.status,
    teamObjective: brief.teamObjective,
    overallStatus: brief.overallStatus,
    lastCommitments: brief.lastCommitments,
    blockersSummary: brief.blockersSummary,
    decisionsNeeded: brief.decisionsNeeded,
    nextActionsSummary: brief.nextActionsSummary,
    nextCycleCommitments: brief.nextCycleCommitments,
    readyForTeamMeeting: brief.readyForTeamMeeting,
    readyForOfficerMeeting: brief.readyForOfficerMeeting,
    teamLead: personDTO(brief.teamLead),
    officerMeeting: serializeMeeting(brief.officerMeeting),
    teamMeeting: brief.teamMeeting
      ? {
          id: brief.teamMeeting.id,
          title: brief.teamMeeting.title ?? `${ws.title} Team Meeting`,
          status: brief.teamMeeting.status,
          targetOfficerMeeting: serializeMeeting(brief.teamMeeting.targetOfficerMeeting),
          finalizedAtISO: brief.teamMeeting.finalizedAt?.toISOString() ?? null,
        }
      : null,
    taskUpdates: taskUpdateDTOs,
    members,
    expectations: expectations.map((e) => ({
      id: e.id,
      kind: e.kind,
      prompt: e.prompt,
      requiredQuestion: e.requiredQuestion,
      requiredDeliverable: e.requiredDeliverable,
      actionItemId: e.actionItemId,
      actionTitle: e.actionItem?.title ?? null,
      presenter: personDTO(e.presenter),
      dueDateISO: e.dueDate?.toISOString() ?? null,
      dueWeekStartISO: e.dueWeekStart?.toISOString() ?? null,
      sourceMeeting: serializeMeeting(e.sourceMeeting),
      targetOfficerMeeting: serializeMeeting(e.targetOfficerMeeting),
    })),
    preparedPresentationItems: brief.preparedPresentationItems.map((item) => ({
      id: item.id,
      title: item.title,
      reasonForOfficerReview: item.reasonForOfficerReview,
      statusSummary: item.statusSummary,
      requestedDecision: item.requestedDecision,
      readiness: item.readiness,
      actionItemId: item.actionItemId,
      actionTitle: item.actionItem?.title ?? null,
      presenter: personDTO(item.presenter),
      targetOfficerMeeting: serializeMeeting(item.targetOfficerMeeting),
      agendaItemId: item.agendaItem?.id ?? null,
      deliverableLinkIds: item.deliverableLinkIds,
      expectationPrompt: item.presentationExpectation?.prompt ?? null,
    })),
    followUps: brief.followUps.map((f) => ({
      id: f.id,
      title: f.title,
      description: f.description,
      status: f.status,
      owner: personDTO(f.owner),
      sourceActionTitle: f.sourceAction?.title ?? null,
      dueDateISO: f.dueDate?.toISOString() ?? null,
    })),
  };
}

export async function getBriefForMutation(briefId: string) {
  const brief = await prisma.weeklyTeamBrief.findUnique({
    where: { id: briefId },
    include: BRIEF_INCLUDE,
  });
  if (!brief) throw new Error("Weekly brief not found");
  const def = getInitiativeDef(brief.initiativeId);
  const ws = getWorkstreamDef(brief.initiativeId, brief.workstreamId);
  if (!def || !ws) throw new Error("Initiative team config not found");
  return { brief, def, ws, access: briefAccessShape(brief, def, ws) };
}

export function buildPreparedItemDedupeKey(input: {
  teamMeetingId: string;
  weeklyTaskUpdateId?: string | null;
  expectationId?: string | null;
  reason: string;
}) {
  return [
    "team-meeting",
    input.teamMeetingId,
    "task",
    input.weeklyTaskUpdateId ?? "team",
    "expectation",
    input.expectationId ?? "none",
    input.reason.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80),
  ].join(":");
}

export function agendaKindForPreparedItem(input: {
  requestedDecision?: string | null;
  deliverableLinkIds?: string[] | null;
  reasonForOfficerReview: string;
  expectationKind?: PresentationExpectationKind | null;
}): AgendaItemKind {
  if (input.requestedDecision?.trim()) return "DECISION";
  if (
    input.expectationKind === "PRESENT_DELIVERABLE" ||
    (input.deliverableLinkIds?.length ?? 0) > 0
  ) {
    return "DELIVERABLE_REVIEW";
  }
  const reason = input.reasonForOfficerReview.toLowerCase();
  if (reason.includes("blocker") || reason.includes("blocked")) return "ESCALATED_BLOCKER";
  if (reason.includes("cross-team") || reason.includes("coordination")) {
    return "CROSS_TEAM_COORDINATION";
  }
  if (reason.includes("input")) return "LEADERSHIP_INPUT";
  return "TEAM_STATUS";
}

export async function createPreparedPresentationFromUpdate(input: {
  weeklyTaskUpdateId: string;
  reasonForOfficerReview: string;
  title?: string | null;
  statusSummary?: string | null;
  requestedDecision?: string | null;
  presenterId?: string | null;
  targetOfficerMeetingId?: string | null;
  readiness?: PreparedPresentationStatus;
  createdById?: string | null;
}) {
  ensureEnabled();
  const update = await prisma.weeklyTaskUpdate.findUnique({
    where: { id: input.weeklyTaskUpdateId },
    include: {
      brief: { include: { teamMeeting: true } },
      actionItem: { include: ACTION_FOR_BRIEF_INCLUDE },
    },
  });
  if (!update) throw new Error("Task update not found");
  if (!update.brief.teamMeeting) throw new Error("Team Meeting not found");

  const deliverableIds = update.deliverableLinkIds.length
    ? update.deliverableLinkIds
    : update.actionItem?.fileLinks.map((link) => link.id) ?? [];
  const expectationId = update.expectationIds[0] ?? null;
  const dedupeKey = buildPreparedItemDedupeKey({
    teamMeetingId: update.brief.teamMeeting.id,
    weeklyTaskUpdateId: update.id,
    expectationId,
    reason: input.reasonForOfficerReview,
  });

  return prisma.preparedPresentationItem.upsert({
    where: { dedupeKey },
    create: {
      initiativeId: update.brief.initiativeId,
      workstreamId: update.brief.workstreamId,
      dedupeKey,
      briefId: update.briefId,
      teamMeetingId: update.brief.teamMeeting.id,
      weeklyTaskUpdateId: update.id,
      actionItemId: update.actionItemId,
      presentationExpectationId: expectationId,
      targetOfficerMeetingId:
        input.targetOfficerMeetingId ?? update.brief.teamMeeting.targetOfficerMeetingId,
      reasonForOfficerReview: input.reasonForOfficerReview,
      title: input.title?.trim() || update.taskTitleSnapshot,
      statusSummary: input.statusSummary ?? update.statusNarrative ?? update.currentResult,
      requestedDecision: input.requestedDecision ?? update.decisionNeeded,
      readiness: input.readiness ?? "READY",
      deliverableLinkIds: deliverableIds,
      presenterId:
        input.presenterId ??
        update.officerMeetingPresenterId ??
        update.teamMeetingPresenterId ??
        null,
      createdById: input.createdById ?? null,
      submittedAt: input.readiness === "SUBMITTED" ? new Date() : null,
    },
    update: {
      targetOfficerMeetingId:
        input.targetOfficerMeetingId ?? update.brief.teamMeeting.targetOfficerMeetingId,
      title: input.title?.trim() || update.taskTitleSnapshot,
      statusSummary: input.statusSummary ?? update.statusNarrative ?? update.currentResult,
      requestedDecision: input.requestedDecision ?? update.decisionNeeded,
      readiness: input.readiness ?? "READY",
      deliverableLinkIds: { set: deliverableIds },
      presenterId:
        input.presenterId ??
        update.officerMeetingPresenterId ??
        update.teamMeetingPresenterId ??
        null,
      submittedAt: input.readiness === "SUBMITTED" ? new Date() : undefined,
    },
  });
}

export async function promotePreparedPresentationToOfficerAgenda(input: {
  preparedPresentationItemId: string;
  officerMeetingId?: string | null;
}) {
  ensureEnabled();
  const item = await prisma.preparedPresentationItem.findUnique({
    where: { id: input.preparedPresentationItemId },
    include: {
      presentationExpectation: true,
      brief: true,
      teamMeeting: true,
      actionItem: { select: { id: true, title: true } },
    },
  });
  if (!item) throw new Error("Prepared presentation item not found");
  const officerMeetingId = input.officerMeetingId ?? item.targetOfficerMeetingId;
  if (!officerMeetingId) throw new Error("Choose an Officer Meeting first");

  const max = await prisma.meetingAgendaItem.aggregate({
    where: { officerMeetingId },
    _max: { sortOrder: true },
  });
  const itemKind = agendaKindForPreparedItem({
    requestedDecision: item.requestedDecision,
    deliverableLinkIds: item.deliverableLinkIds,
    reasonForOfficerReview: item.reasonForOfficerReview,
    expectationKind: item.presentationExpectation?.kind ?? null,
  });

  const agenda = await prisma.meetingAgendaItem.upsert({
    where: { preparedPresentationItemId: item.id },
    create: {
      officerMeetingId,
      title: item.title,
      description: item.statusSummary,
      notes: null,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      ownerId: item.presenterId,
      presenterId: item.presenterId,
      itemKind,
      sourceInitiativeId: item.initiativeId,
      sourceWorkstreamId: item.workstreamId,
      briefId: item.briefId,
      teamMeetingId: item.teamMeetingId,
      preparedPresentationItemId: item.id,
      sourceActionId: item.actionItemId,
      presentationExpectationId: item.presentationExpectationId,
      requestedDecision: item.requestedDecision,
      readinessState: item.readiness,
    },
    update: {
      officerMeetingId,
      presenterId: item.presenterId,
      ownerId: item.presenterId,
      itemKind,
      readinessState: item.readiness,
    },
    select: { id: true },
  });

  await prisma.preparedPresentationItem.update({
    where: { id: item.id },
    data: {
      readiness: "ACCEPTED",
      acceptedAt: new Date(),
      targetOfficerMeetingId: officerMeetingId,
    },
  });

  await prisma.weeklyTeamBrief.update({
    where: { id: item.briefId },
    data: { officerMeetingId, readyForOfficerMeeting: true },
  });
  if (item.teamMeetingId) {
    await prisma.teamMeeting.update({
      where: { id: item.teamMeetingId },
      data: { targetOfficerMeetingId: officerMeetingId },
    });
  }

  return agenda;
}

export async function snapshotAndFinalizeTeamMeeting(briefId: string) {
  ensureEnabled();
  const { brief } = await getBriefForMutation(briefId);
  const snapshot = {
    finalizedAt: new Date().toISOString(),
    initiativeId: brief.initiativeId,
    workstreamId: brief.workstreamId,
    weekStart: brief.weekStart.toISOString(),
    overallStatus: brief.overallStatus,
    memberUpdates: brief.memberUpdates.map((m) => ({
      id: m.id,
      userId: m.userId,
      status: m.status,
      personalObjective: m.personalObjective,
      personalDeliverable: m.personalDeliverable,
      targetDate: m.targetDate?.toISOString() ?? null,
      inputNeeded: m.inputNeeded,
      inputNeededFrom: m.inputNeededFrom,
      inputNeededBy: m.inputNeededBy?.toISOString() ?? null,
    })),
    taskUpdates: brief.taskUpdates.map((u) => ({
      id: u.id,
      actionItemId: u.actionItemId,
      title: u.taskTitleSnapshot,
      liveStatusAtSnapshot: u.actionItem?.status ?? null,
      statusNarrative: u.statusNarrative,
      workCompleted: u.workCompleted,
      currentResult: u.currentResult,
      blockerNote: u.blockerNote,
      decisionNeeded: u.decisionNeeded,
      nextAction: u.nextAction,
      teamMeetingReady: u.teamMeetingReady,
      officerMeetingReady: u.officerMeetingReady,
      presenterId: u.officerMeetingPresenterId ?? u.teamMeetingPresenterId,
      deliverables: u.actionItem
        ? deliverablesForIds(u.deliverableLinkIds, u.actionItem.fileLinks)
        : [],
    })),
    preparedPresentationItems: brief.preparedPresentationItems.map((item) => ({
      id: item.id,
      title: item.title,
      reasonForOfficerReview: item.reasonForOfficerReview,
      requestedDecision: item.requestedDecision,
      readiness: item.readiness,
      presenterId: item.presenterId,
      targetOfficerMeetingId: item.targetOfficerMeetingId,
      agendaItemId: item.agendaItem?.id ?? null,
    })),
  };

  await prisma.$transaction([
    prisma.weeklyTeamBrief.update({
      where: { id: briefId },
      data: {
        status: "FINALIZED",
        finalizedAt: new Date(),
        snapshotJson: snapshot,
      },
    }),
    prisma.teamMeeting.updateMany({
      where: { briefId },
      data: { status: "FINALIZED", finalizedAt: new Date(), agendaSnapshotJson: snapshot },
    }),
  ]);
}
