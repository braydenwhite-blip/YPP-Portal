"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOfficer, requireSessionUser } from "@/lib/authorization";
import { isWeeklyTeamBriefsEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

import type { ActionViewer } from "./action-permissions";
import { validateMemberSubmission, type TaggedImpactIssue } from "./impact-specificity";
import { getInitiativeDef, getWorkstreamDef } from "./strategic-initiatives";
import {
  canEditWeeklyBriefOverall,
  canEditWeeklyTaskUpdate,
  canFinalizeTeamMeeting,
  canManageOfficerMeetingOutputs,
  canPrepareOfficerPresentation,
} from "./weekly-brief-permissions";
import {
  createPreparedPresentationFromUpdate,
  dateKey,
  generateWeeklyTeamBriefs,
  getBriefForMutation,
  parseWeekStart,
  promotePreparedPresentationToOfficerAgenda,
  snapshotAndFinalizeTeamMeeting,
  startOfUTCWeek,
} from "./weekly-team-briefs";

const NonEmptyString = z.string().trim().min(1);
const OptionalText = z
  .string()
  .trim()
  .max(20_000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));
const OptionalId = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : null));
const OptionalDate = z
  .string()
  .optional()
  .transform((v) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
      ? new Date(`${v.trim()}T00:00:00.000Z`)
      : null
  );

function ensureEnabled() {
  if (!isWeeklyTeamBriefsEnabled()) {
    throw new Error("Weekly Team Briefs are not enabled");
  }
}

function viewerFromSession(session: Awaited<ReturnType<typeof requireSessionUser>>): ActionViewer {
  return {
    id: session.id,
    roles: session.roles,
    primaryRole: session.primaryRole,
    adminSubtypes: session.adminSubtypes,
  };
}

function briefPath(input: { initiativeId: string; workstreamId: string; weekStart: Date }) {
  return `/operations/initiatives/${input.initiativeId}/teams/${input.workstreamId}/brief/${dateKey(input.weekStart)}`;
}

function revalidateBrief(input: { initiativeId: string; workstreamId: string; weekStart: Date; officerMeetingId?: string | null }) {
  revalidatePath(briefPath(input));
  revalidatePath(`/operations/initiatives/${input.initiativeId}`);
  revalidatePath("/operations/weekly-execution");
  revalidatePath("/work");
  revalidatePath("/my-weekly-impact");
  revalidatePath("/impact-meetings");
  if (input.officerMeetingId) {
    revalidatePath(`/actions/meetings/${input.officerMeetingId}`);
    revalidatePath(`/impact-meetings/${input.officerMeetingId}`);
    revalidatePath(`/impact-meetings/${input.officerMeetingId}/agenda`);
    revalidatePath(`/impact-meetings/${input.officerMeetingId}/presentation`);
    revalidatePath(`/impact-meetings/${input.officerMeetingId}/live`);
    revalidatePath(`/impact-meetings/${input.officerMeetingId}/summary`);
  }
  revalidatePath("/actions/meetings");
}

function configuredBriefAccess(initiativeId: string, workstreamId: string) {
  const def = getInitiativeDef(initiativeId);
  const ws = getWorkstreamDef(initiativeId, workstreamId);
  if (!def || !ws) throw new Error("Initiative team config not found");
  return {
    teamLeadId: ws.leadUserId ?? ws.leadUserIds?.[0] ?? null,
    workstreamLeadUserIds: [ws.leadUserId, ...(ws.leadUserIds ?? [])].filter(
      (id): id is string => Boolean(id)
    ),
    initiativeLeadUserIds: def.leadUserIds ?? [],
    taskUpdates: [],
  };
}

async function requireBriefMutationAccess(briefId: string) {
  ensureEnabled();
  const session = await requireSessionUser();
  const viewer = viewerFromSession(session);
  const loaded = await getBriefForMutation(briefId);
  return { ...loaded, session, viewer };
}

const GenerateBriefSchema = z.object({
  initiativeId: NonEmptyString,
  workstreamId: NonEmptyString,
  weekStart: NonEmptyString,
  targetOfficerMeetingId: OptionalId,
});

export async function generateTeamBriefForWeek(
  input: z.input<typeof GenerateBriefSchema>
) {
  ensureEnabled();
  const session = await requireSessionUser();
  const viewer = viewerFromSession(session);
  const data = GenerateBriefSchema.parse(input);
  if (!canEditWeeklyBriefOverall(viewer, configuredBriefAccess(data.initiativeId, data.workstreamId))) {
    throw new Error("Unauthorized");
  }
  const weekStart = parseWeekStart(data.weekStart);
  await generateWeeklyTeamBriefs(weekStart, {
    initiativeId: data.initiativeId,
    workstreamId: data.workstreamId,
    targetOfficerMeetingId: data.targetOfficerMeetingId,
    createdById: session.id,
    forceEmptyTeam: true,
  });
  revalidateBrief({
    initiativeId: data.initiativeId,
    workstreamId: data.workstreamId,
    weekStart,
    officerMeetingId: data.targetOfficerMeetingId,
  });
}

const UpdateBriefSchema = z.object({
  briefId: NonEmptyString,
  teamObjective: OptionalText,
  overallStatus: OptionalText,
  lastCommitments: OptionalText,
  blockersSummary: OptionalText,
  decisionsNeeded: OptionalText,
  nextActionsSummary: OptionalText,
  nextCycleCommitments: OptionalText,
});

export async function updateWeeklyBriefOverall(
  input: z.input<typeof UpdateBriefSchema>
) {
  const { brief, access, viewer } = await requireBriefMutationAccess(input.briefId);
  if (!canEditWeeklyBriefOverall(viewer, access)) throw new Error("Unauthorized");
  if (brief.status === "FINALIZED") throw new Error("Finalized briefs must be reopened first");

  const data = UpdateBriefSchema.parse(input);
  await prisma.weeklyTeamBrief.update({
    where: { id: data.briefId },
    data: {
      teamObjective: data.teamObjective,
      overallStatus: data.overallStatus,
      lastCommitments: data.lastCommitments,
      blockersSummary: data.blockersSummary,
      decisionsNeeded: data.decisionsNeeded,
      nextActionsSummary: data.nextActionsSummary,
      nextCycleCommitments: data.nextCycleCommitments,
    },
  });
  revalidateBrief(brief);
}

const UpdateTaskSchema = z.object({
  updateId: NonEmptyString,
  statusNarrative: OptionalText,
  workCompleted: OptionalText,
  currentResult: OptionalText,
  remainingWork: OptionalText,
  blockerNote: OptionalText,
  explanation: OptionalText,
  decisionNeeded: OptionalText,
  nextAction: OptionalText,
  teamMeetingPresenterId: OptionalId,
  officerMeetingPresenterId: OptionalId,
  teamMeetingReady: z.boolean().optional().default(false),
  officerMeetingReady: z.boolean().optional().default(false),
  escalationNeeded: z.boolean().optional().default(false),
  officerReviewRequested: z.boolean().optional().default(false),
});

export async function updateWeeklyTaskUpdate(input: z.input<typeof UpdateTaskSchema>) {
  ensureEnabled();
  const session = await requireSessionUser();
  const viewer = viewerFromSession(session);
  const data = UpdateTaskSchema.parse(input);
  const update = await prisma.weeklyTaskUpdate.findUnique({
    where: { id: data.updateId },
    include: {
      brief: true,
      actionItem: { include: { assignments: { select: { userId: true, role: true } } } },
    },
  });
  if (!update || !update.actionItem) throw new Error("Task update not found");
  const loaded = await getBriefForMutation(update.briefId);
  const taskAccess = {
    leadId: update.actionItem.leadId,
    createdById: update.actionItem.createdById,
    visibility: update.actionItem.visibility,
    assignments: update.actionItem.assignments,
  };
  if (
    !canEditWeeklyBriefOverall(viewer, loaded.access) &&
    !canEditWeeklyTaskUpdate(viewer, taskAccess)
  ) {
    throw new Error("Unauthorized");
  }
  if (loaded.brief.status === "FINALIZED") throw new Error("Finalized briefs must be reopened first");

  await prisma.$transaction(async (tx) => {
    await tx.weeklyTaskUpdate.update({
      where: { id: data.updateId },
      data: {
        statusNarrative: data.statusNarrative,
        workCompleted: data.workCompleted,
        currentResult: data.currentResult,
        remainingWork: data.remainingWork,
        blockerNote: data.blockerNote,
        explanation: data.explanation,
        decisionNeeded: data.decisionNeeded,
        nextAction: data.nextAction,
        teamMeetingPresenterId: data.teamMeetingPresenterId,
        officerMeetingPresenterId: data.officerMeetingPresenterId,
        teamMeetingReady: data.teamMeetingReady,
        officerMeetingReady: data.officerMeetingReady,
        escalationNeeded: data.escalationNeeded,
        officerReviewRequested: data.officerReviewRequested,
      },
    });
    if (data.blockerNote) {
      await tx.actionItem.update({
        where: { id: update.actionItemId ?? "" },
        data: { status: "BLOCKED", blockedReason: data.blockerNote },
      });
    }
  });
  revalidateBrief(loaded.brief);
}

const DeliverableSchema = z.object({
  updateId: NonEmptyString,
  label: NonEmptyString.max(300),
  url: z
    .string()
    .trim()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "URL must start with http(s)://"),
});

export async function addWeeklyTaskDeliverable(input: z.input<typeof DeliverableSchema>) {
  ensureEnabled();
  const session = await requireSessionUser();
  const viewer = viewerFromSession(session);
  const data = DeliverableSchema.parse(input);
  const update = await prisma.weeklyTaskUpdate.findUnique({
    where: { id: data.updateId },
    include: {
      actionItem: { include: { assignments: { select: { userId: true, role: true } } } },
      brief: true,
    },
  });
  if (!update || !update.actionItemId || !update.actionItem) {
    throw new Error("Task update not found");
  }
  const loaded = await getBriefForMutation(update.briefId);
  const taskAccess = {
    leadId: update.actionItem.leadId,
    createdById: update.actionItem.createdById,
    visibility: update.actionItem.visibility,
    assignments: update.actionItem.assignments,
  };
  if (
    !canEditWeeklyBriefOverall(viewer, loaded.access) &&
    !canEditWeeklyTaskUpdate(viewer, taskAccess)
  ) {
    throw new Error("Unauthorized");
  }
  if (loaded.brief.status === "FINALIZED") throw new Error("Finalized briefs must be reopened first");

  const link = await prisma.actionFileLink.create({
    data: {
      actionItemId: update.actionItemId,
      label: data.label,
      url: data.url,
      addedById: session.id,
    },
    select: { id: true },
  });
  await prisma.weeklyTaskUpdate.update({
    where: { id: update.id },
    data: {
      deliverableLinkIds: { set: Array.from(new Set([...update.deliverableLinkIds, link.id])) },
    },
  });
  revalidateBrief(update.brief);
  return link;
}

const SubmitBriefSchema = z.object({ briefId: NonEmptyString });

export async function submitWeeklyBrief(input: z.input<typeof SubmitBriefSchema>) {
  const { brief, access, viewer } = await requireBriefMutationAccess(input.briefId);
  if (!canEditWeeklyBriefOverall(viewer, access)) throw new Error("Unauthorized");
  await prisma.weeklyTeamBrief.update({
    where: { id: brief.id },
    data: {
      status: "SUBMITTED",
      readyForTeamMeeting: true,
      submittedAt: new Date(),
    },
  });
  await prisma.teamMeeting.updateMany({
    where: { briefId: brief.id, status: "DRAFT" },
    data: { status: "IN_PROGRESS", startedAt: new Date() },
  });
  revalidateBrief(brief);
}

const PrepareSchema = z.object({
  weeklyTaskUpdateId: NonEmptyString,
  reasonForOfficerReview: NonEmptyString.max(2000),
  title: OptionalText,
  statusSummary: OptionalText,
  requestedDecision: OptionalText,
  presenterId: OptionalId,
  targetOfficerMeetingId: OptionalId,
  submit: z.boolean().optional().default(false),
});

export async function prepareTaskForOfficerReview(input: z.input<typeof PrepareSchema>) {
  ensureEnabled();
  const session = await requireSessionUser();
  const viewer = viewerFromSession(session);
  const data = PrepareSchema.parse(input);
  const update = await prisma.weeklyTaskUpdate.findUnique({
    where: { id: data.weeklyTaskUpdateId },
    include: {
      actionItem: { include: { assignments: { select: { userId: true, role: true } } } },
      brief: true,
    },
  });
  if (!update) throw new Error("Task update not found");
  const loaded = await getBriefForMutation(update.briefId);
  const actionAccess = update.actionItem
    ? {
        leadId: update.actionItem.leadId,
        createdById: update.actionItem.createdById,
        visibility: update.actionItem.visibility,
        assignments: update.actionItem.assignments,
      }
    : null;
  if (!canPrepareOfficerPresentation(viewer, loaded.access, actionAccess)) {
    throw new Error("Unauthorized");
  }
  if (loaded.brief.status === "FINALIZED") throw new Error("Finalized briefs must be reopened first");

  const item = await createPreparedPresentationFromUpdate({
    weeklyTaskUpdateId: data.weeklyTaskUpdateId,
    reasonForOfficerReview: data.reasonForOfficerReview,
    title: data.title,
    statusSummary: data.statusSummary,
    requestedDecision: data.requestedDecision,
    presenterId: data.presenterId,
    targetOfficerMeetingId: data.targetOfficerMeetingId,
    readiness: data.submit ? "SUBMITTED" : "READY",
    createdById: session.id,
  });
  await prisma.weeklyTaskUpdate.update({
    where: { id: update.id },
    data: {
      officerReviewRequested: true,
      officerMeetingReady: data.submit,
      officerMeetingPresenterId: data.presenterId ?? update.officerMeetingPresenterId,
    },
  });
  revalidateBrief(loaded.brief);
  return { id: item.id };
}

const AcceptPreparedSchema = z.object({
  preparedPresentationItemId: NonEmptyString,
  officerMeetingId: OptionalId,
});

export async function acceptPreparedPresentationForOfficerMeeting(
  input: z.input<typeof AcceptPreparedSchema>
) {
  ensureEnabled();
  const session = await requireOfficer();
  if (!canManageOfficerMeetingOutputs(viewerFromSession(session))) throw new Error("Unauthorized");
  const data = AcceptPreparedSchema.parse(input);
  const agenda = await promotePreparedPresentationToOfficerAgenda(data);
  revalidatePath("/actions/meetings");
  if (data.officerMeetingId) revalidatePath(`/actions/meetings/${data.officerMeetingId}`);
  return agenda;
}

const ExpectationSchema = z.object({
  initiativeId: NonEmptyString,
  workstreamId: NonEmptyString,
  actionItemId: OptionalId,
  kind: z.enum(["PRESENT_DELIVERABLE", "SHOW_STATUS", "ANSWER_QUESTION", "MAKE_DECISION"]),
  prompt: NonEmptyString.max(4000),
  requiredQuestion: OptionalText,
  requiredDeliverable: OptionalText,
  responsibleOwnerId: OptionalId,
  presenterId: OptionalId,
  dueDate: z.string().optional(),
  targetOfficerMeetingId: OptionalId,
  sourceMeetingId: OptionalId,
  returnToNextAgenda: z.boolean().optional().default(true),
});

export async function createTeamPresentationExpectation(
  input: z.input<typeof ExpectationSchema>
) {
  ensureEnabled();
  const session = await requireOfficer();
  const data = ExpectationSchema.parse(input);
  const dueDate =
    data.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(data.dueDate)
      ? new Date(`${data.dueDate}T00:00:00.000Z`)
      : null;
  const expectation = await prisma.teamPresentationExpectation.create({
    data: {
      initiativeId: data.initiativeId,
      workstreamId: data.workstreamId,
      actionItemId: data.actionItemId,
      kind: data.kind,
      prompt: data.prompt,
      requiredQuestion: data.requiredQuestion,
      requiredDeliverable: data.requiredDeliverable,
      responsibleOwnerId: data.responsibleOwnerId,
      presenterId: data.presenterId,
      dueDate,
      dueWeekStart: dueDate ? startOfUTCWeek(dueDate) : null,
      targetOfficerMeetingId: data.targetOfficerMeetingId,
      sourceMeetingId: data.sourceMeetingId,
      returnToNextAgenda: data.returnToNextAgenda,
      createdById: session.id,
    },
    select: { id: true },
  });
  if (dueDate) {
    await generateWeeklyTeamBriefs(startOfUTCWeek(dueDate), {
      initiativeId: data.initiativeId,
      workstreamId: data.workstreamId,
      createdById: session.id,
    });
  }
  revalidatePath(`/operations/initiatives/${data.initiativeId}`);
  if (data.sourceMeetingId) revalidatePath(`/actions/meetings/${data.sourceMeetingId}`);
  if (data.targetOfficerMeetingId) revalidatePath(`/actions/meetings/${data.targetOfficerMeetingId}`);
  return expectation;
}

const FinalizeSchema = z.object({ briefId: NonEmptyString });

export async function finalizeTeamMeetingAndBrief(input: z.input<typeof FinalizeSchema>) {
  const { brief, access, viewer } = await requireBriefMutationAccess(input.briefId);
  if (!canFinalizeTeamMeeting(viewer, access)) throw new Error("Unauthorized");
  await snapshotAndFinalizeTeamMeeting(brief.id);
  revalidateBrief(brief);
}

export async function reopenWeeklyBrief(input: z.input<typeof FinalizeSchema>) {
  const { brief } = await requireBriefMutationAccess(input.briefId);
  await requireOfficer();
  await prisma.weeklyTeamBrief.update({
    where: { id: brief.id },
    data: { status: "REOPENED", reopenedAt: new Date() },
  });
  await prisma.teamMeeting.updateMany({
    where: { briefId: brief.id, status: "FINALIZED" },
    data: { status: "IN_PROGRESS" },
  });
  revalidateBrief(brief);
}

// ---------------------------------------------------------------------------
// Per-person ("Both") Weekly Impact form: each person fills their own Section 1
// (objective + deliverable) and Section 4 (input needed) header and submits it.
// Their Section 2/3 detail lives in the WeeklyTaskUpdate rows they lead (edited
// via updateWeeklyTaskUpdate above). A person may always act on their own form;
// team leads / officers may act on any member's form on their team's brief.
// ---------------------------------------------------------------------------

async function loadMemberContext(memberUpdateId: string) {
  ensureEnabled();
  const session = await requireSessionUser();
  const viewer = viewerFromSession(session);
  const member = await prisma.weeklyMemberUpdate.findUnique({
    where: { id: memberUpdateId },
    select: { id: true, userId: true, briefId: true },
  });
  if (!member) throw new Error("Weekly Impact form not found");
  const loaded = await getBriefForMutation(member.briefId);
  const isSelf = member.userId === session.id;
  if (!isSelf && !canEditWeeklyBriefOverall(viewer, loaded.access)) {
    throw new Error("Unauthorized");
  }
  if (loaded.brief.status === "FINALIZED") {
    throw new Error("Finalized briefs must be reopened first");
  }
  return { member, session, viewer, ...loaded };
}

const StartMyImpactSchema = z.object({
  initiativeId: NonEmptyString,
  workstreamId: NonEmptyString,
});

/** Join an Impact team's weekly form for the current week — generates the team's
 *  brief if needed (idempotent) and ensures the signed-in person has their own
 *  blank form. Lets a contributor with no Action Items yet start participating. */
export async function startMyWeeklyImpact(input: z.input<typeof StartMyImpactSchema>) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = StartMyImpactSchema.parse(input);
  const def = getInitiativeDef(data.initiativeId);
  const ws = getWorkstreamDef(data.initiativeId, data.workstreamId);
  if (!def || !ws) throw new Error("Unknown Impact team");

  const weekStart = startOfUTCWeek(new Date());
  await generateWeeklyTeamBriefs(weekStart, {
    initiativeId: def.id,
    workstreamId: ws.id,
    createdById: session.id,
    forceEmptyTeam: true,
  });
  const brief = await prisma.weeklyTeamBrief.findUnique({
    where: {
      initiativeId_workstreamId_weekStart: {
        initiativeId: def.id,
        workstreamId: ws.id,
        weekStart,
      },
    },
    select: { id: true },
  });
  if (!brief) throw new Error("Could not start your weekly form");

  await prisma.weeklyMemberUpdate.upsert({
    where: { briefId_userId: { briefId: brief.id, userId: session.id } },
    create: { briefId: brief.id, userId: session.id, createdById: session.id },
    update: {},
  });
  revalidatePath("/my-weekly-impact");
  return { briefId: brief.id };
}

const EnsureMemberSchema = z.object({ briefId: NonEmptyString });

/** Give the signed-in person their own blank Weekly Impact form on this brief —
 *  covers people who have no Action Items yet, so their form is never missing. */
export async function ensureMyMemberUpdate(input: z.input<typeof EnsureMemberSchema>) {
  ensureEnabled();
  const session = await requireSessionUser();
  const data = EnsureMemberSchema.parse(input);
  const loaded = await getBriefForMutation(data.briefId);
  if (loaded.brief.status === "FINALIZED") {
    throw new Error("Finalized briefs must be reopened first");
  }
  const member = await prisma.weeklyMemberUpdate.upsert({
    where: { briefId_userId: { briefId: data.briefId, userId: session.id } },
    create: { briefId: data.briefId, userId: session.id, createdById: session.id },
    update: {},
    select: { id: true },
  });
  revalidateBrief(loaded.brief);
  return { id: member.id };
}

const UpdateMemberSchema = z.object({
  memberUpdateId: NonEmptyString,
  personalObjective: OptionalText,
  personalDeliverable: OptionalText,
  targetDate: OptionalDate,
  inputNeeded: OptionalText,
  inputNeededFrom: OptionalText,
  inputNeededBy: OptionalDate,
});

/** Save a draft of the person's Section 1/4 header. Drafts never run the
 *  specificity guard — only submit does — so saving partial work is friction-free. */
export async function updateMyMemberUpdate(input: z.input<typeof UpdateMemberSchema>) {
  const data = UpdateMemberSchema.parse(input);
  const { member, brief } = await loadMemberContext(data.memberUpdateId);
  await prisma.weeklyMemberUpdate.update({
    where: { id: member.id },
    data: {
      personalObjective: data.personalObjective,
      personalDeliverable: data.personalDeliverable,
      targetDate: data.targetDate,
      inputNeeded: data.inputNeeded,
      inputNeededFrom: data.inputNeededFrom,
      inputNeededBy: data.inputNeededBy,
      // Once a human edits the carried-forward input, it is no longer "auto-carried".
      inputNeededCarried: false,
    },
  });
  revalidateBrief(brief);
  return { ok: true as const };
}

const SubmitMemberSchema = z.object({ memberUpdateId: NonEmptyString });

export type SubmitMemberResult =
  | { ok: true }
  | { ok: false; issues: TaggedImpactIssue[] };

/** Submit the person's Weekly Impact form. Runs the specificity guard across
 *  their Section 1/4 header and the Section 2/3 task rows they lead; if anything
 *  is vague, returns the per-field issues (does NOT throw) so the form can show
 *  exactly what to fix and stays editable. */
export async function submitMyMemberUpdate(
  input: z.input<typeof SubmitMemberSchema>
): Promise<SubmitMemberResult> {
  const data = SubmitMemberSchema.parse(input);
  const { member, brief } = await loadMemberContext(data.memberUpdateId);

  const memberRow = await prisma.weeklyMemberUpdate.findUnique({
    where: { id: member.id },
    select: { personalObjective: true, personalDeliverable: true, inputNeeded: true },
  });
  // Section 2/3 detail: the task rows this person leads within the brief.
  const tasks = await prisma.weeklyTaskUpdate.findMany({
    where: { briefId: member.briefId, actionItem: { leadId: member.userId } },
    select: { id: true, workCompleted: true, currentResult: true, nextAction: true },
  });

  const issues = validateMemberSubmission({
    member: {
      personalObjective: memberRow?.personalObjective,
      personalDeliverable: memberRow?.personalDeliverable,
      inputNeeded: memberRow?.inputNeeded,
    },
    tasks: tasks.map((t) => ({
      taskUpdateId: t.id,
      workCompleted: t.workCompleted,
      currentResult: t.currentResult,
      nextAction: t.nextAction,
    })),
  });
  if (issues.length > 0) {
    return { ok: false, issues };
  }

  await prisma.weeklyMemberUpdate.update({
    where: { id: member.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  revalidateBrief(brief);
  return { ok: true };
}
