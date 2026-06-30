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
import {
  AddInstanceNoteSchema,
  AdvanceInstanceSchema,
  BlockStepSchema,
  CancelInstanceSchema,
  CompleteStepSchema,
  ExecutionIdSchema,
  InstanceIdSchema,
  ReassignStepSchema,
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

// Local import kept out of the module graph's top to avoid a server-only cycle.
async function instanceIdForExecution(executionId: string): Promise<string | undefined> {
  const { prisma } = await import("@/lib/prisma");
  const exec = await prisma.workflowStepExecution.findUnique({
    where: { id: executionId },
    select: { instanceId: true },
  });
  return exec?.instanceId;
}
