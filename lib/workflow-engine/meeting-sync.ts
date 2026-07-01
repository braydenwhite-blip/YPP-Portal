// ============================================================================
// Universal Workflow Engine — Meeting <-> Workflow sync (server-only)
// ============================================================================
//
// The reverse direction from lib/workflow-engine/engine.ts's CREATE_MEETING
// automation: Meeting stays the real meetings system (lib/weekly-meetings),
// and this module reacts to a Meeting's lifecycle (manual scheduling from a
// step, completion) by nudging the linked WorkflowStepExecution (found via
// linkedMeetingId, or the Meeting's own sourceType/sourceId as a fallback)
// forward. Side-effects are best-effort — never let a failure here propagate
// back into the caller's own Meeting mutation.

import "server-only";

import { MeetingType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { completeStep, addInstanceNote } from "@/lib/workflow-engine/engine";

const MEETING_TYPES = new Set<string>(Object.values(MeetingType));
function asMeetingType(s: string | null | undefined): MeetingType {
  return s && MEETING_TYPES.has(s) ? (s as MeetingType) : "GENERIC";
}

// ---------------------------------------------------------------------------
// getWorkflowContextForMeeting
// ---------------------------------------------------------------------------

export type WorkflowMeetingContext = {
  instanceId: string;
  instanceTitle: string;
  templateName: string;
  stageKey: string | null;
  stageName: string | null;
  stepExecutionId: string | null;
  stepTitle: string | null;
  openActionsCount: number;
  blockedStepsCount: number;
  guidance: string | null;
};

/**
 * Resolve the workflow instance (and, when known, the specific step) a
 * meeting is linked to. Tries the precise WorkflowStepExecution.linkedMeetingId
 * link first; falls back to the Meeting's own sourceType/sourceId (older
 * meetings created before per-step linking existed), degrading stepExecutionId
 * /stepTitle/guidance to null in that case. Returns null when the meeting
 * isn't workflow-linked at all.
 */
export async function getWorkflowContextForMeeting(
  meetingId: string
): Promise<WorkflowMeetingContext | null> {
  const linkedExecution = await prisma.workflowStepExecution.findFirst({
    where: { linkedMeetingId: meetingId },
    select: { id: true, title: true, stageKey: true, stepId: true, instanceId: true },
  });

  let instanceId: string | null = linkedExecution?.instanceId ?? null;
  if (!instanceId) {
    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { sourceType: true, sourceId: true },
    });
    if (meeting?.sourceType === "WorkflowInstance" && meeting.sourceId) {
      instanceId = meeting.sourceId;
    }
  }
  if (!instanceId) return null;

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    select: {
      id: true,
      title: true,
      template: { select: { name: true } },
      currentStage: { select: { key: true, name: true } },
      executions: { select: { linkedActionItemId: true, state: true } },
    },
  });
  if (!instance) return null;

  const actionItemIds = instance.executions
    .map((e) => e.linkedActionItemId)
    .filter((id): id is string => !!id);
  const openActionsCount = actionItemIds.length
    ? await prisma.actionItem.count({
        where: { id: { in: actionItemIds }, status: { not: "COMPLETE" } },
      })
    : 0;
  const blockedStepsCount = instance.executions.filter((e) => e.state === "BLOCKED").length;

  let stepExecutionId: string | null = null;
  let stepTitle: string | null = null;
  let guidance: string | null = null;
  if (linkedExecution) {
    stepExecutionId = linkedExecution.id;
    stepTitle = linkedExecution.title;
    if (linkedExecution.stepId) {
      const step = await prisma.workflowTemplateStep.findUnique({
        where: { id: linkedExecution.stepId },
        select: { description: true },
      });
      guidance = step?.description ?? null;
    }
  }

  return {
    instanceId: instance.id,
    instanceTitle: instance.title,
    templateName: instance.template.name,
    stageKey: instance.currentStage?.key ?? null,
    stageName: instance.currentStage?.name ?? null,
    stepExecutionId,
    stepTitle,
    openActionsCount,
    blockedStepsCount,
    guidance,
  };
}

// ---------------------------------------------------------------------------
// createMeetingFromWorkflowStep
// ---------------------------------------------------------------------------

export type CreateMeetingFromWorkflowStepInput = {
  stepExecutionId: string;
  meetingType?: string;
  scheduledAt: Date;
  facilitatorId?: string | null;
  actorId?: string | null;
};

/**
 * MANUAL/ad-hoc counterpart to the engine's CREATE_MEETING automation effect —
 * for a step whose kind is "MEETING" but which has no meeting yet, or when a
 * user wants to schedule one early. Creates the Meeting the same way
 * effectCreateMeeting does (status SCHEDULED, sourceType "WorkflowInstance",
 * sourceId: instance id), links it back onto the step execution, and notes it
 * on the instance's timeline.
 */
export async function createMeetingFromWorkflowStep(
  input: CreateMeetingFromWorkflowStepInput
): Promise<{ meetingId: string }> {
  const exec = await prisma.workflowStepExecution.findUnique({
    where: { id: input.stepExecutionId },
    select: { id: true, title: true, instanceId: true },
  });
  if (!exec) throw new Error("Step execution not found.");

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: exec.instanceId },
    select: { id: true, title: true, chapterId: true, ownerId: true },
  });
  if (!instance) throw new Error("Workflow instance not found.");

  const facilitatorId = input.facilitatorId ?? instance.ownerId ?? null;
  const meeting = await prisma.meeting.create({
    data: {
      type: asMeetingType(input.meetingType),
      status: "SCHEDULED",
      title: exec.title,
      scheduledAt: input.scheduledAt,
      facilitatorId,
      chapterId: instance.chapterId,
      sourceType: "WorkflowInstance",
      sourceId: instance.id,
      createdById: input.actorId ?? null,
    },
    select: { id: true },
  });

  await prisma.workflowStepExecution.update({
    where: { id: exec.id },
    data: { linkedMeetingId: meeting.id },
  });

  await addInstanceNote(
    instance.id,
    `Meeting “${exec.title}” manually scheduled from this step.`,
    input.actorId ?? null
  );

  return { meetingId: meeting.id };
}

// ---------------------------------------------------------------------------
// syncMeetingOutcomeToWorkflow
// ---------------------------------------------------------------------------

/**
 * Call this when a Meeting's status transitions to "COMPLETED". Best-effort —
 * never throws. Resolves the workflow context; if a specific step is linked,
 * completes it (which re-runs automations and attempts stage advance), then
 * leaves a short note on the instance's timeline referencing the meeting.
 */
export async function syncMeetingOutcomeToWorkflow(
  meetingId: string,
  actorId: string | null,
  now?: Date
): Promise<void> {
  try {
    const context = await getWorkflowContextForMeeting(meetingId);
    if (!context) return;

    const meeting = await prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { title: true },
    });

    if (context.stepExecutionId) {
      await completeStep(context.stepExecutionId, { actorId, now });
    }
    await addInstanceNote(
      context.instanceId,
      `Meeting completed: ${meeting?.title ?? context.instanceTitle}.`,
      actorId
    );
  } catch (err) {
    console.error("[workflow-engine] syncMeetingOutcomeToWorkflow failed", err);
  }
}

// ---------------------------------------------------------------------------
// carryForwardWorkflowItems
// ---------------------------------------------------------------------------

/**
 * Find open/unresolved MeetingFollowUp (OPEN/IN_PROGRESS) and OfficerTopic
 * (OPEN/DEFERRED) rows on this meeting and note each one on the associated
 * workflow instance's timeline, so unresolved items stay visible in the
 * workflow even though this pass does not re-parent them onto a future
 * meeting.
 *
 * Scope decision: physically re-parenting these rows onto a specific "next"
 * meeting is out of scope here — there's no single deterministic "next
 * meeting" to carry into without product input on meeting cadence pairing.
 */
export async function carryForwardWorkflowItems(
  meetingId: string
): Promise<{ carriedCount: number }> {
  const context = await getWorkflowContextForMeeting(meetingId);
  if (!context) return { carriedCount: 0 };

  const [followUps, topics] = await Promise.all([
    prisma.meetingFollowUp.findMany({
      where: { meetingId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      select: { id: true, title: true },
    }),
    prisma.officerTopic.findMany({
      where: { meetingId, status: { in: ["OPEN", "DEFERRED"] } },
      select: { id: true, title: true },
    }),
  ]);

  let carriedCount = 0;
  for (const followUp of followUps) {
    await addInstanceNote(
      context.instanceId,
      `Unresolved follow-up carried forward: “${followUp.title}”.`,
      null
    );
    carriedCount += 1;
  }
  for (const topic of topics) {
    await addInstanceNote(
      context.instanceId,
      `Unresolved topic carried forward: “${topic.title}”.`,
      null
    );
    carriedCount += 1;
  }

  return { carriedCount };
}
