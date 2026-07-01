"use server";

// ============================================================================
// Universal Workflow Engine — instance execution server actions
// ============================================================================
//
// The runner's mutations: start, complete/block/skip steps, advance, reassign,
// cancel, and note. Each validates (zod), authorizes (officer), delegates the
// real work to the engine core (lib/workflow-engine/engine.ts), then revalidates.

import { revalidatePath } from "next/cache";

import { requireWorkflowRunner } from "@/lib/workflow-engine/permissions";
import {
  advanceInstance as advanceInstanceCore,
  addInstanceNote as addInstanceNoteCore,
  blockStep as blockStepCore,
  cancelInstance as cancelInstanceCore,
  completeStep as completeStepCore,
  reassignStep as reassignStepCore,
  setInstanceOwner as setInstanceOwnerCore,
  skipStep as skipStepCore,
  startInstance as startInstanceCore,
  unblockStep as unblockStepCore,
} from "@/lib/workflow-engine/engine";
import { createMeetingFromWorkflowStep } from "@/lib/workflow-engine/meeting-sync";
import {
  AddInstanceNoteSchema,
  AdvanceInstanceSchema,
  BlockStepSchema,
  CancelInstanceSchema,
  CompleteStepSchema,
  CreateManualActionForStepSchema,
  EscalateWorkflowSchema,
  ExecutionIdSchema,
  InstanceIdSchema,
  ReassignStepSchema,
  ScheduleMeetingForStepSchema,
  SetInstanceOwnerSchema,
  StartInstanceSchema,
} from "@/lib/workflow-engine/schemas";

function revalidateInstance(id?: string) {
  revalidatePath("/workflows");
  if (id) revalidatePath(`/workflows/${id}`);
  revalidatePath("/workflows/analytics");
}

export async function startWorkflow(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = StartInstanceSchema.parse(input);
  const dueAt = data.dueAt ? new Date(data.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) throw new Error("Invalid due date.");

  const result = await startInstanceCore({
    templateId: data.templateId,
    title: data.title,
    subjectType: data.subjectType,
    subjectId: data.subjectId,
    chapterId: data.chapterId,
    ownerId: data.ownerId ?? viewer.id,
    startedById: viewer.id,
    dueAt,
  });
  revalidateInstance(result.id);
  return { ok: true, id: result.id };
}

export async function completeStep(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = CompleteStepSchema.parse(input);
  await completeStepCore(data.executionId, { actorId: viewer.id, output: data.output ?? null });
  const instanceId = await instanceIdForExecution(data.executionId);
  revalidateInstance(instanceId);
  return { ok: true };
}

export async function blockStep(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = BlockStepSchema.parse(input);
  await blockStepCore(data.executionId, data.reason, { actorId: viewer.id });
  revalidateInstance(await instanceIdForExecution(data.executionId));
  return { ok: true };
}

export async function unblockStep(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = ExecutionIdSchema.parse(input);
  await unblockStepCore(data.executionId, { actorId: viewer.id });
  revalidateInstance(await instanceIdForExecution(data.executionId));
  return { ok: true };
}

export async function skipStep(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = ExecutionIdSchema.parse(input);
  await skipStepCore(data.executionId, { actorId: viewer.id });
  revalidateInstance(await instanceIdForExecution(data.executionId));
  return { ok: true };
}

export async function reassignStep(input: unknown) {
  await requireWorkflowRunner();
  const data = ReassignStepSchema.parse(input);
  await reassignStepCore(data.executionId, data.ownerId);
  revalidateInstance(await instanceIdForExecution(data.executionId));
  return { ok: true };
}

export async function advanceWorkflow(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = AdvanceInstanceSchema.parse(input);
  await advanceInstanceCore(data.instanceId, {
    actorId: viewer.id,
    toStageId: data.toStageId ?? null,
  });
  revalidateInstance(data.instanceId);
  return { ok: true };
}

export async function setWorkflowOwner(input: unknown) {
  await requireWorkflowRunner();
  const data = SetInstanceOwnerSchema.parse(input);
  await setInstanceOwnerCore(data.instanceId, data.ownerId);
  revalidateInstance(data.instanceId);
  return { ok: true };
}

export async function cancelWorkflow(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = CancelInstanceSchema.parse(input);
  await cancelInstanceCore(data.instanceId, { actorId: viewer.id, reason: data.reason });
  revalidateInstance(data.instanceId);
  return { ok: true };
}

export async function addWorkflowNote(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = AddInstanceNoteSchema.parse(input);
  await addInstanceNoteCore(data.instanceId, data.body, viewer.id);
  revalidateInstance(data.instanceId);
  return { ok: true };
}

/** One-click "Escalate" from the runner header. Mirrors the two-field update
 *  + WorkflowEvent shape of the engine's own automation-driven effectEscalate
 *  (lib/workflow-engine/engine.ts), so a manual escalation looks identical to
 *  an automated one on the instance's timeline and in health.ts's scoring. */
export async function escalateWorkflow(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = EscalateWorkflowSchema.parse(input);
  const { prisma } = await import("@/lib/prisma");

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: data.instanceId },
    select: { title: true, escalatedAt: true },
  });
  if (!instance) throw new Error("Workflow instance not found.");

  const now = new Date();
  await prisma.workflowInstance.update({
    where: { id: data.instanceId },
    data: { escalatedAt: instance.escalatedAt ?? now, lastEscalationAt: now },
  });
  await prisma.workflowEvent.create({
    data: {
      instanceId: data.instanceId,
      kind: "ESCALATED",
      summary: "Escalated to leadership.",
      actorId: viewer.id,
    },
  });

  revalidateInstance(data.instanceId);
  return { ok: true };
}

/** One-click, AD-HOC "Create action" per step — distinct from the engine's
 *  CREATE_ACTION automation (ON_* triggered): this is a manual escape hatch a
 *  runner can use on any non-terminal step that doesn't already have one.
 *  Creates the ActionItem the same way engine.ts's effectCreateAction does
 *  (lead/creator = viewer, chapterId from the instance), tags its provenance
 *  as WORKFLOW_STEP (lib/people-strategy/action-source.ts), and links it back
 *  onto the step execution. */
export async function createManualActionForStep(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = CreateManualActionForStepSchema.parse(input);
  const { prisma } = await import("@/lib/prisma");

  const exec = await prisma.workflowStepExecution.findUnique({
    where: { id: data.executionId },
    select: { id: true, title: true, instanceId: true, linkedActionItemId: true },
  });
  if (!exec) throw new Error("Step not found.");
  if (exec.linkedActionItemId) throw new Error("This step already has a linked action.");

  const instance = await prisma.workflowInstance.findUnique({
    where: { id: exec.instanceId },
    select: { id: true, title: true, chapterId: true },
  });
  if (!instance) throw new Error("Workflow instance not found.");

  const title = data.title?.trim() || `Complete "${exec.title}"`;
  const now = new Date();
  const action = await prisma.actionItem.create({
    data: {
      title,
      description: `Manually created from workflow "${instance.title}".`,
      status: "NOT_STARTED",
      priority: "MEDIUM",
      visibility: "ALL_LEADERSHIP",
      deadlineStart: now,
      leadId: viewer.id,
      createdById: viewer.id,
      chapterId: instance.chapterId,
      sourceType: "WORKFLOW_STEP",
      sourceId: exec.id,
      assignments: {
        create: [
          { userId: viewer.id, role: "LEAD" },
          { userId: viewer.id, role: "EXECUTING" },
        ],
      },
    },
    select: { id: true },
  });

  await prisma.workflowStepExecution.update({
    where: { id: exec.id },
    data: { linkedActionItemId: action.id },
  });
  await addInstanceNoteCore(
    instance.id,
    `Action "${title}" manually created from this step.`,
    viewer.id
  );

  revalidateInstance(instance.id);
  return { ok: true, actionItemId: action.id };
}

/** One-click, AD-HOC "Schedule meeting" per MEETING-kind step — a thin
 *  "use server" wrapper so meeting-sync.ts's createMeetingFromWorkflowStep
 *  (which already does everything needed) is callable from a client button. */
export async function scheduleMeetingForStep(input: unknown) {
  const viewer = await requireWorkflowRunner();
  const data = ScheduleMeetingForStepSchema.parse(input);

  const scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(scheduledAt.getTime())) throw new Error("Invalid meeting time.");

  const result = await createMeetingFromWorkflowStep({
    stepExecutionId: data.executionId,
    meetingType: data.meetingType ?? undefined,
    scheduledAt,
    actorId: viewer.id,
  });

  revalidateInstance(await instanceIdForExecution(data.executionId));
  revalidatePath("/meetings");
  return { ok: true, meetingId: result.meetingId };
}

// Local import kept out of the module graph's top to avoid a server-only cycle.
async function instanceIdForExecution(executionId: string): Promise<string | undefined> {
  const { prisma } = await import("@/lib/prisma");
  const exec = await prisma.workflowStepExecution.findUnique({
    where: { id: executionId },
    select: { instanceId: true },
  });
  return exec?.instanceId;
}
