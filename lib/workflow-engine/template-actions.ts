"use server";

// ============================================================================
// Universal Workflow Engine — template builder server actions
// ============================================================================
//
// CRUD for the structured builder (Stage → Steps → Automation → Exit Criteria →
// Assignments → Notifications). Pattern: validate (zod) → authorize (guard) →
// write (prisma) → revalidate. Mirrors lib/weekly-meetings/*-actions.ts.

import { revalidatePath } from "next/cache";
import type { WorkflowStepKind } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireTemplateManager } from "@/lib/workflow-engine/permissions";
import { installBlueprintDefinition } from "@/lib/workflow-engine/seed";
import { blueprintByKey } from "@/lib/workflow-engine/blueprints";
import {
  AddAutomationRuleSchema,
  AddStageSchema,
  AddStepSchema,
  AddTransitionSchema,
  AutomationRuleIdSchema,
  CreateTemplateSchema,
  InstallBlueprintSchema,
  ReorderStagesSchema,
  ReorderStepsSchema,
  SetTemplateStatusSchema,
  StageIdSchema,
  StepIdSchema,
  TemplateIdSchema,
  TransitionIdSchema,
  UpdateAutomationRuleSchema,
  UpdateStageSchema,
  UpdateStepSchema,
  UpdateTemplateSchema,
} from "@/lib/workflow-engine/schemas";
import { slugify } from "@/lib/workflow-engine/slug";

function revalidateTemplate(id?: string) {
  revalidatePath("/admin/workflow-templates");
  if (id) revalidatePath(`/admin/workflow-templates/${id}`);
  revalidatePath("/workflows/new");
}

const asJson = (v: unknown) => (v == null ? undefined : (v as object));

// --- Templates -------------------------------------------------------------

export async function createTemplate(input: unknown) {
  const viewer = await requireTemplateManager();
  const data = CreateTemplateSchema.parse(input);

  const base = slugify(data.name) || "workflow";
  let key = base;
  for (let i = 2; await prisma.workflowTemplate.findUnique({ where: { key } }); i++) {
    key = `${base}-${i}`;
  }

  const template = await prisma.workflowTemplate.create({
    data: {
      key,
      name: data.name,
      description: data.description,
      domain: data.domain,
      defaultOwnerRole: data.defaultOwnerRole,
      defaultOwnerSubtype: data.defaultOwnerSubtype,
      followUpCadenceHours: data.followUpCadenceHours ?? null,
      escalateAfterHours: data.escalateAfterHours ?? null,
      createdById: viewer.id,
    },
    select: { id: true },
  });
  revalidateTemplate(template.id);
  return { ok: true, id: template.id };
}

export async function updateTemplate(input: unknown) {
  await requireTemplateManager();
  const data = UpdateTemplateSchema.parse(input);
  await prisma.workflowTemplate.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      description: data.description,
      domain: data.domain,
      defaultOwnerRole: data.defaultOwnerRole,
      defaultOwnerSubtype: data.defaultOwnerSubtype,
      followUpCadenceHours: data.followUpCadenceHours ?? null,
      escalateAfterHours: data.escalateAfterHours ?? null,
    },
  });
  revalidateTemplate(data.id);
  return { ok: true };
}

export async function setTemplateStatus(input: unknown) {
  await requireTemplateManager();
  const data = SetTemplateStatusSchema.parse(input);
  await prisma.workflowTemplate.update({
    where: { id: data.id },
    data: { status: data.status },
  });
  revalidateTemplate(data.id);
  return { ok: true };
}

export async function deleteTemplate(input: unknown) {
  await requireTemplateManager();
  const data = TemplateIdSchema.parse(input);
  const instanceCount = await prisma.workflowInstance.count({ where: { templateId: data.id } });
  if (instanceCount > 0) {
    throw new Error(
      "Archive this template instead — it has running or historical instances."
    );
  }
  await prisma.workflowTemplate.delete({ where: { id: data.id } });
  revalidateTemplate();
  return { ok: true };
}

// --- Stages ----------------------------------------------------------------

async function nextStageOrder(templateId: string): Promise<number> {
  const last = await prisma.workflowTemplateStage.findFirst({
    where: { templateId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

async function uniqueStageKey(templateId: string, name: string): Promise<string> {
  const base = slugify(name) || "stage";
  let key = base;
  for (
    let i = 2;
    await prisma.workflowTemplateStage.findFirst({ where: { templateId, key } });
    i++
  ) {
    key = `${base}-${i}`;
  }
  return key;
}

export async function addStage(input: unknown) {
  await requireTemplateManager();
  const data = AddStageSchema.parse(input);
  const key = await uniqueStageKey(data.templateId, data.name);
  await prisma.workflowTemplateStage.create({
    data: {
      templateId: data.templateId,
      key,
      name: data.name,
      description: data.description,
      order: await nextStageOrder(data.templateId),
      slaHours: data.slaHours ?? null,
      isInitial: data.isInitial ?? false,
      isTerminal: data.isTerminal ?? false,
      exitCriteria: asJson(data.exitCriteria),
    },
  });
  revalidateTemplate(data.templateId);
  return { ok: true };
}

export async function updateStage(input: unknown) {
  await requireTemplateManager();
  const data = UpdateStageSchema.parse(input);
  const stage = await prisma.workflowTemplateStage.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      description: data.description,
      slaHours: data.slaHours ?? null,
      ...(data.isInitial !== undefined ? { isInitial: data.isInitial } : {}),
      ...(data.isTerminal !== undefined ? { isTerminal: data.isTerminal } : {}),
      exitCriteria: asJson(data.exitCriteria),
    },
    select: { templateId: true },
  });
  revalidateTemplate(stage.templateId);
  return { ok: true };
}

export async function reorderStages(input: unknown) {
  await requireTemplateManager();
  const data = ReorderStagesSchema.parse(input);
  await prisma.$transaction(
    data.orderedStageIds.map((id, i) =>
      prisma.workflowTemplateStage.update({ where: { id }, data: { order: i } })
    )
  );
  revalidateTemplate(data.templateId);
  return { ok: true };
}

export async function deleteStage(input: unknown) {
  await requireTemplateManager();
  const data = StageIdSchema.parse(input);
  const stage = await prisma.workflowTemplateStage.delete({
    where: { id: data.id },
    select: { templateId: true },
  });
  revalidateTemplate(stage.templateId);
  return { ok: true };
}

// --- Steps -----------------------------------------------------------------

async function nextStepOrder(stageId: string): Promise<number> {
  const last = await prisma.workflowTemplateStep.findFirst({
    where: { stageId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return (last?.order ?? -1) + 1;
}

async function uniqueStepKey(stageId: string, name: string): Promise<string> {
  const base = slugify(name) || "step";
  let key = base;
  for (
    let i = 2;
    await prisma.workflowTemplateStep.findFirst({ where: { stageId, key } });
    i++
  ) {
    key = `${base}-${i}`;
  }
  return key;
}

async function templateIdForStage(stageId: string): Promise<string | null> {
  const stage = await prisma.workflowTemplateStage.findUnique({
    where: { id: stageId },
    select: { templateId: true },
  });
  return stage?.templateId ?? null;
}

export async function addStep(input: unknown) {
  await requireTemplateManager();
  const data = AddStepSchema.parse(input);
  const key = await uniqueStepKey(data.stageId, data.name);
  await prisma.workflowTemplateStep.create({
    data: {
      stageId: data.stageId,
      key,
      name: data.name,
      description: data.description,
      order: await nextStepOrder(data.stageId),
      kind: (data.kind ?? "TASK") as WorkflowStepKind,
      isRequired: data.isRequired ?? true,
      assigneeMode: data.assigneeMode ?? null,
      assigneeRole: data.assigneeRole,
      assigneeSubtype: data.assigneeSubtype,
      dueOffsetHours: data.dueOffsetHours ?? null,
      config: asJson(data.config),
    },
  });
  revalidateTemplate((await templateIdForStage(data.stageId)) ?? undefined);
  return { ok: true };
}

export async function updateStep(input: unknown) {
  await requireTemplateManager();
  const data = UpdateStepSchema.parse(input);
  const step = await prisma.workflowTemplateStep.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      description: data.description,
      ...(data.kind !== undefined ? { kind: data.kind as WorkflowStepKind } : {}),
      ...(data.isRequired !== undefined ? { isRequired: data.isRequired } : {}),
      assigneeMode: data.assigneeMode ?? null,
      assigneeRole: data.assigneeRole,
      assigneeSubtype: data.assigneeSubtype,
      dueOffsetHours: data.dueOffsetHours ?? null,
      config: asJson(data.config),
    },
    select: { stage: { select: { templateId: true } } },
  });
  revalidateTemplate(step.stage.templateId);
  return { ok: true };
}

export async function reorderSteps(input: unknown) {
  await requireTemplateManager();
  const data = ReorderStepsSchema.parse(input);
  await prisma.$transaction(
    data.orderedStepIds.map((id, i) =>
      prisma.workflowTemplateStep.update({ where: { id }, data: { order: i } })
    )
  );
  revalidateTemplate((await templateIdForStage(data.stageId)) ?? undefined);
  return { ok: true };
}

export async function deleteStep(input: unknown) {
  await requireTemplateManager();
  const data = StepIdSchema.parse(input);
  const step = await prisma.workflowTemplateStep.delete({
    where: { id: data.id },
    select: { stage: { select: { templateId: true } } },
  });
  revalidateTemplate(step.stage.templateId);
  return { ok: true };
}

// --- Transitions -----------------------------------------------------------

export async function addTransition(input: unknown) {
  await requireTemplateManager();
  const data = AddTransitionSchema.parse(input);
  const last = await prisma.workflowTransition.findFirst({
    where: { templateId: data.templateId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.workflowTransition.create({
    data: {
      templateId: data.templateId,
      fromStageId: data.fromStageId,
      toStageId: data.toStageId,
      label: data.label,
      isAutomatic: data.isAutomatic ?? true,
      isDefault: data.isDefault ?? true,
      order: (last?.order ?? -1) + 1,
    },
  });
  revalidateTemplate(data.templateId);
  return { ok: true };
}

export async function deleteTransition(input: unknown) {
  await requireTemplateManager();
  const data = TransitionIdSchema.parse(input);
  const t = await prisma.workflowTransition.delete({
    where: { id: data.id },
    select: { templateId: true },
  });
  revalidateTemplate(t.templateId);
  return { ok: true };
}

// --- Automation rules ------------------------------------------------------

export async function addAutomationRule(input: unknown) {
  await requireTemplateManager();
  const data = AddAutomationRuleSchema.parse(input);
  const last = await prisma.workflowAutomationRule.findFirst({
    where: { templateId: data.templateId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  await prisma.workflowAutomationRule.create({
    data: {
      templateId: data.templateId,
      name: data.name,
      trigger: data.trigger as never,
      action: data.action as never,
      stageId: data.stageId ?? null,
      stepKey: data.stepKey,
      config: asJson(data.config),
      order: (last?.order ?? -1) + 1,
    },
  });
  revalidateTemplate(data.templateId);
  return { ok: true };
}

export async function updateAutomationRule(input: unknown) {
  await requireTemplateManager();
  const data = UpdateAutomationRuleSchema.parse(input);
  const rule = await prisma.workflowAutomationRule.update({
    where: { id: data.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.trigger !== undefined ? { trigger: data.trigger as never } : {}),
      ...(data.action !== undefined ? { action: data.action as never } : {}),
      ...(data.stageId !== undefined ? { stageId: data.stageId } : {}),
      stepKey: data.stepKey,
      ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      config: asJson(data.config),
    },
    select: { templateId: true },
  });
  revalidateTemplate(rule.templateId);
  return { ok: true };
}

export async function deleteAutomationRule(input: unknown) {
  await requireTemplateManager();
  const data = AutomationRuleIdSchema.parse(input);
  const rule = await prisma.workflowAutomationRule.delete({
    where: { id: data.id },
    select: { templateId: true },
  });
  revalidateTemplate(rule.templateId);
  return { ok: true };
}

// --- Blueprint install -----------------------------------------------------

export async function installBlueprint(input: unknown) {
  const viewer = await requireTemplateManager();
  const data = InstallBlueprintSchema.parse(input);
  const bp = blueprintByKey(data.blueprintKey);
  if (!bp) throw new Error("Unknown blueprint.");
  const result = await installBlueprintDefinition(bp, {
    createdById: viewer.id,
    publish: true,
  });
  revalidateTemplate(result.templateId);
  return { ok: true, id: result.templateId, created: result.created };
}
