"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOfficer, requireSessionUser } from "@/lib/authorization";
import { isWeeklyTeamBriefsEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";

import type { ActionViewer } from "./action-permissions";
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
  if (input.officerMeetingId) revalidatePath(`/actions/meetings/${input.officerMeetingId}`);
  revalidatePath("/actions/meetings");
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
  const data = GenerateBriefSchema.parse(input);
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
