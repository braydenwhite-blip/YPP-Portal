"use server";

/**
 * Meeting Runner server actions (officer-tier). Covers meeting lifecycle,
 * attendance, officer topics, decisions, follow-ups, and inline curation of
 * presentation rows (decision-needed / send-to-board) from the runner.
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { syncMeetingOutcomeToWorkflow } from "@/lib/workflow-engine/meeting-sync";
import { requireMeetingRunner } from "./permissions";
import { parseWeekKey, weekStartFor } from "./week";
import {
  AddDecisionSchema,
  AddFollowUpSchema,
  AddTopicSchema,
  AttendeeIdSchema,
  AttendeeSchema,
  CreateMeetingSchema,
  DecisionIdSchema,
  FollowUpIdSchema,
  MeetingIdSchema,
  SetMeetingStatusSchema,
  SetPresentSchema,
  SetRowFlagSchema,
  SetTopicOwnersSchema,
  TopicIdSchema,
  UpdateFollowUpSchema,
  UpdateMeetingSchema,
  UpdateTopicSchema,
} from "./schemas";

function revalidateMeeting(id: string) {
  revalidatePath(`/meetings/${id}`);
  revalidatePath("/meetings");
}

export async function createMeeting(input: unknown) {
  const viewer = await requireMeetingRunner();
  const data = CreateMeetingSchema.parse(input);

  const scheduledAt = new Date(data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid scheduled date/time");

  const isImpact = data.type === "WEEKLY_TEAM_IMPACT" || data.type === "CHAPTER_IMPACT";
  const weekStart = isImpact
    ? (parseWeekKey(data.weekStart) ?? weekStartFor(scheduledAt))
    : null;

  const meeting = await prisma.meeting.create({
    data: {
      type: data.type,
      title: data.title,
      purpose: data.purpose,
      scheduledAt,
      facilitatorId: data.facilitatorId ?? viewer.id,
      teamId: data.type === "WEEKLY_TEAM_IMPACT" ? (data.teamId ?? null) : null,
      chapterId: data.type === "CHAPTER_IMPACT" ? (data.chapterId ?? null) : null,
      weekStart,
      createdById: viewer.id,
    },
  });
  revalidatePath("/meetings");
  return { ok: true, id: meeting.id };
}

export async function updateMeeting(input: unknown) {
  await requireMeetingRunner();
  const data = UpdateMeetingSchema.parse(input);
  await prisma.meeting.update({
    where: { id: data.meetingId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.purpose !== undefined ? { purpose: data.purpose } : {}),
      ...(data.notes !== undefined ? { notes: data.notes } : {}),
      ...(data.facilitatorId !== undefined ? { facilitatorId: data.facilitatorId } : {}),
      ...(data.scheduledAt
        ? (() => {
            const d = new Date(data.scheduledAt);
            return Number.isNaN(d.getTime()) ? {} : { scheduledAt: d };
          })()
        : {}),
    },
  });
  revalidateMeeting(data.meetingId);
  return { ok: true };
}

export async function setMeetingStatus(input: unknown) {
  const viewer = await requireMeetingRunner();
  const data = SetMeetingStatusSchema.parse(input);
  await prisma.meeting.update({ where: { id: data.meetingId }, data: { status: data.status } });
  if (data.status === "COMPLETED") {
    await syncMeetingOutcomeToWorkflow(data.meetingId, viewer.id);
  }
  revalidateMeeting(data.meetingId);
  return { ok: true };
}

export async function deleteMeeting(input: unknown) {
  await requireMeetingRunner();
  const { meetingId } = MeetingIdSchema.parse(input);
  await prisma.meeting.delete({ where: { id: meetingId } });
  revalidatePath("/meetings");
  return { ok: true };
}

// --- Attendance -------------------------------------------------------------
export async function addAttendee(input: unknown) {
  await requireMeetingRunner();
  const data = AttendeeSchema.parse(input);
  await prisma.meetingAttendee.upsert({
    where: { meetingId_userId: { meetingId: data.meetingId, userId: data.userId } },
    create: { meetingId: data.meetingId, userId: data.userId, isOptional: data.isOptional ?? false },
    update: {},
  });
  revalidateMeeting(data.meetingId);
  return { ok: true };
}

export async function setAttendeePresent(input: unknown) {
  await requireMeetingRunner();
  const data = SetPresentSchema.parse(input);
  const a = await prisma.meetingAttendee.update({
    where: { id: data.attendeeId },
    data: { present: data.present },
  });
  revalidateMeeting(a.meetingId);
  return { ok: true };
}

export async function removeAttendee(input: unknown) {
  await requireMeetingRunner();
  const { attendeeId } = AttendeeIdSchema.parse(input);
  const a = await prisma.meetingAttendee.delete({ where: { id: attendeeId } });
  revalidateMeeting(a.meetingId);
  return { ok: true };
}

// --- Officer Topics ---------------------------------------------------------
export async function addOfficerTopic(input: unknown) {
  const viewer = await requireMeetingRunner();
  const data = AddTopicSchema.parse(input);
  const max = await prisma.officerTopic.aggregate({
    where: { meetingId: data.meetingId },
    _max: { sortOrder: true },
  });
  await prisma.officerTopic.create({
    data: {
      meetingId: data.meetingId,
      title: data.title,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      createdById: viewer.id,
    },
  });
  revalidateMeeting(data.meetingId);
  return { ok: true };
}

export async function updateOfficerTopic(input: unknown) {
  await requireMeetingRunner();
  const data = UpdateTopicSchema.parse(input);
  const topic = await prisma.officerTopic.update({
    where: { id: data.topicId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.detail !== undefined ? { detail: data.detail } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.decisionNeeded !== undefined ? { decisionNeeded: data.decisionNeeded } : {}),
      ...(data.sendToBoard !== undefined ? { sendToBoard: data.sendToBoard } : {}),
      ...(data.decision !== undefined ? { decision: data.decision } : {}),
      ...(data.nextSteps !== undefined ? { nextSteps: data.nextSteps } : {}),
    },
  });
  revalidateMeeting(topic.meetingId);
  return { ok: true };
}

export async function setTopicOwners(input: unknown) {
  await requireMeetingRunner();
  const data = SetTopicOwnersSchema.parse(input);
  const topic = await prisma.officerTopic.findUnique({
    where: { id: data.topicId },
    select: { meetingId: true },
  });
  if (!topic) throw new Error("Topic not found");
  await prisma.$transaction([
    prisma.officerTopicOwner.deleteMany({ where: { topicId: data.topicId } }),
    prisma.officerTopicOwner.createMany({
      data: data.userIds.map((userId) => ({ topicId: data.topicId, userId })),
      skipDuplicates: true,
    }),
  ]);
  revalidateMeeting(topic.meetingId);
  return { ok: true };
}

export async function deleteOfficerTopic(input: unknown) {
  await requireMeetingRunner();
  const { topicId } = TopicIdSchema.parse(input);
  const topic = await prisma.officerTopic.delete({ where: { id: topicId } });
  revalidateMeeting(topic.meetingId);
  return { ok: true };
}

// --- Decisions --------------------------------------------------------------
export async function addDecision(input: unknown) {
  await requireMeetingRunner();
  const data = AddDecisionSchema.parse(input);
  await prisma.meetingDecision.create({
    data: {
      meetingId: data.meetingId,
      decision: data.decision,
      rationale: data.rationale,
      decidedById: data.decidedById ?? null,
    },
  });
  revalidateMeeting(data.meetingId);
  return { ok: true };
}

export async function deleteDecision(input: unknown) {
  await requireMeetingRunner();
  const { decisionId } = DecisionIdSchema.parse(input);
  const d = await prisma.meetingDecision.delete({ where: { id: decisionId } });
  revalidateMeeting(d.meetingId);
  return { ok: true };
}

// --- Follow-ups -------------------------------------------------------------
export async function addFollowUp(input: unknown) {
  await requireMeetingRunner();
  const data = AddFollowUpSchema.parse(input);
  await prisma.meetingFollowUp.create({
    data: {
      meetingId: data.meetingId,
      title: data.title,
      detail: data.detail,
      ownerId: data.ownerId ?? null,
      dueDate: data.dueDate,
    },
  });
  revalidateMeeting(data.meetingId);
  return { ok: true };
}

export async function setFollowUpStatus(input: unknown) {
  await requireMeetingRunner();
  const data = UpdateFollowUpSchema.parse(input);
  const f = await prisma.meetingFollowUp.update({
    where: { id: data.followUpId },
    data: { status: data.status },
  });
  revalidateMeeting(f.meetingId);
  return { ok: true };
}

export async function deleteFollowUp(input: unknown) {
  await requireMeetingRunner();
  const { followUpId } = FollowUpIdSchema.parse(input);
  const f = await prisma.meetingFollowUp.delete({ where: { id: followUpId } });
  revalidateMeeting(f.meetingId);
  return { ok: true };
}

// --- Inline presentation-row curation (from the runner) ---------------------
export async function setPresentationRowFlags(input: unknown) {
  await requireMeetingRunner();
  const data = SetRowFlagSchema.parse(input);
  const row = await prisma.weeklyImpactRow.update({
    where: { id: data.rowId },
    data: {
      ...(data.decisionNeeded !== undefined ? { decisionNeeded: data.decisionNeeded } : {}),
      ...(data.sendToBoard !== undefined ? { sendToBoard: data.sendToBoard } : {}),
    },
    select: { meetingId: true },
  });
  // Impact rows surface in meetings by week + scope (not a stored meetingId), so
  // refresh the runner the toggle came from; fall back to any pinned meeting.
  const meetingToRefresh = data.meetingId ?? row.meetingId;
  if (meetingToRefresh) revalidateMeeting(meetingToRefresh);
  revalidatePath("/meetings");
  revalidatePath("/my-weekly-impact");
  return { ok: true };
}
