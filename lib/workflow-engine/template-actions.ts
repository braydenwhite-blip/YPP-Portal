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
import { toTemplateDefinition } from "@/lib/workflow-engine/definition";
import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";
import {
  AddAutomationRuleSchema,
  AddStageSchema,
  AddStepSchema,
  AddTransitionSchema,
  AutomationRuleIdSchema,
  CreateTemplateSchema,
  DuplicateTemplateSchema,
  InstallBlueprintSchema,
  ListTemplateVersionsSchema,
  MoveStepSchema,
  ReorderAutomationRulesSchema,
  ReorderStagesSchema,
  ReorderStepsSchema,
  RestoreTemplateVersionSchema,
  SetTemplateStatusSchema,
  StageIdSchema,
  StepIdSchema,
  TemplateIdSchema,
  TemplateVersionIdSchema,
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
  const viewer = await requireTemplateManager();
  const data = SetTemplateStatusSchema.parse(input);
  const updated = await prisma.workflowTemplate.update({
    where: { id: data.id },
    data: { status: data.status },
  });
  // Every publish captures a full-structure snapshot (Versions tab) — cheap
  // insurance, and the only way a "restore as draft" has something to restore.
  if (data.status === "PUBLISHED") {
    await snapshotTemplateVersion(data.id, viewer.id);
  }
  revalidateTemplate(data.id);
  return { ok: true };
}

async function snapshotTemplateVersion(templateId: string, publishedById: string | null): Promise<void> {
  const full = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
    include: {
      stages: { include: { steps: true }, orderBy: { order: "asc" } },
      transitions: true,
      automationRules: { orderBy: { order: "asc" } },
    },
  });
  if (!full) return;
  const definition = toTemplateDefinition(full);
  await prisma.workflowTemplateVersionSnapshot.create({
    data: {
      templateId,
      version: full.version,
      snapshot: definition as unknown as object,
      publishedById,
    },
  });
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

/** Move a step to a different stage in the same template (builder drag-drop
 *  across stage columns), appending it to the end of the target stage. */
export async function moveStep(input: unknown) {
  await requireTemplateManager();
  const data = MoveStepSchema.parse(input);
  const step = await prisma.workflowTemplateStep.findUnique({
    where: { id: data.id },
    select: { stage: { select: { id: true, templateId: true } } },
  });
  if (!step) throw new Error("Step not found.");
  const targetStage = await prisma.workflowTemplateStage.findUnique({
    where: { id: data.toStageId },
    select: { templateId: true },
  });
  if (!targetStage || targetStage.templateId !== step.stage.templateId) {
    throw new Error("Target stage is not in the same template.");
  }
  await prisma.workflowTemplateStep.update({
    where: { id: data.id },
    data: { stageId: data.toStageId, order: await nextStepOrder(data.toStageId) },
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

export async function reorderAutomationRules(input: unknown) {
  await requireTemplateManager();
  const data = ReorderAutomationRulesSchema.parse(input);
  await prisma.$transaction(
    data.orderedRuleIds.map((id, i) =>
      prisma.workflowAutomationRule.update({ where: { id }, data: { order: i } })
    )
  );
  revalidateTemplate(data.templateId);
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

// --- Duplicate ---------------------------------------------------------------

async function uniqueTemplateKey(base: string): Promise<string> {
  let key = base;
  for (let i = 2; await prisma.workflowTemplate.findUnique({ where: { key } }); i++) {
    key = `${base}-${i}`;
  }
  return key;
}

/** Deep-clone a template (stages, steps, transitions, automation rules) under
 *  a new key, reset to DRAFT — the builder's "Duplicate" action. Triggers and
 *  version snapshots are NOT copied (the duplicate starts with clean history
 *  and no auto-start wiring, since those are deliberate per-template decisions
 *  an author should re-opt-into, not silently inherit). */
export async function duplicateTemplate(input: unknown) {
  const viewer = await requireTemplateManager();
  const data = DuplicateTemplateSchema.parse(input);
  const source = await prisma.workflowTemplate.findUnique({
    where: { id: data.id },
    include: {
      stages: { include: { steps: true }, orderBy: { order: "asc" } },
      transitions: true,
      automationRules: { orderBy: { order: "asc" } },
    },
  });
  if (!source) throw new Error("Template not found.");

  const key = await uniqueTemplateKey(`${slugify(source.name) || "workflow"}-copy`);

  const newId = await prisma.$transaction(async (tx) => {
    const created = await tx.workflowTemplate.create({
      data: {
        key,
        name: `${source.name} (copy)`,
        description: source.description,
        domain: source.domain,
        status: "DRAFT",
        defaultOwnerRole: source.defaultOwnerRole,
        defaultOwnerSubtype: source.defaultOwnerSubtype,
        followUpCadenceHours: source.followUpCadenceHours,
        escalateAfterHours: source.escalateAfterHours,
        config: asJson(source.config),
        createdById: viewer.id,
      },
      select: { id: true },
    });

    const stageIdMap = new Map<string, string>();
    for (const stage of source.stages) {
      const newStage = await tx.workflowTemplateStage.create({
        data: {
          templateId: created.id,
          key: stage.key,
          name: stage.name,
          description: stage.description,
          order: stage.order,
          slaHours: stage.slaHours,
          isInitial: stage.isInitial,
          isTerminal: stage.isTerminal,
          exitCriteria: asJson(stage.exitCriteria),
          steps: {
            create: stage.steps.map((step) => ({
              key: step.key,
              name: step.name,
              description: step.description,
              order: step.order,
              kind: step.kind,
              isRequired: step.isRequired,
              assigneeMode: step.assigneeMode,
              assigneeRole: step.assigneeRole,
              assigneeSubtype: step.assigneeSubtype,
              dueOffsetHours: step.dueOffsetHours,
              config: asJson(step.config),
            })),
          },
        },
        select: { id: true },
      });
      stageIdMap.set(stage.id, newStage.id);
    }

    for (const t of source.transitions) {
      const fromId = stageIdMap.get(t.fromStageId);
      const toId = stageIdMap.get(t.toStageId);
      if (!fromId || !toId) continue;
      await tx.workflowTransition.create({
        data: {
          templateId: created.id,
          fromStageId: fromId,
          toStageId: toId,
          label: t.label,
          isAutomatic: t.isAutomatic,
          isDefault: t.isDefault,
          condition: asJson(t.condition),
          order: t.order,
        },
      });
    }

    for (const r of source.automationRules) {
      await tx.workflowAutomationRule.create({
        data: {
          templateId: created.id,
          name: r.name,
          trigger: r.trigger,
          action: r.action,
          stageId: r.stageId ? (stageIdMap.get(r.stageId) ?? null) : null,
          stepKey: r.stepKey,
          enabled: r.enabled,
          config: asJson(r.config),
          order: r.order,
        },
      });
    }

    return created.id;
  });

  revalidateTemplate(newId);
  return { ok: true, id: newId };
}

// --- Versions ----------------------------------------------------------------

export async function listTemplateVersions(input: unknown) {
  await requireTemplateManager();
  const data = ListTemplateVersionsSchema.parse(input);
  const versions = await prisma.workflowTemplateVersionSnapshot.findMany({
    where: { templateId: data.templateId },
    orderBy: { publishedAt: "desc" },
    select: { id: true, version: true, publishedAt: true, publishedById: true },
  });
  return versions;
}

export async function getTemplateVersionSnapshot(input: unknown) {
  await requireTemplateManager();
  const data = TemplateVersionIdSchema.parse(input);
  const row = await prisma.workflowTemplateVersionSnapshot.findUnique({
    where: { id: data.id },
  });
  if (!row) throw new Error("Version not found.");
  return {
    id: row.id,
    version: row.version,
    publishedAt: row.publishedAt,
    publishedById: row.publishedById,
    snapshot: row.snapshot as unknown as WorkflowTemplateDefinition,
  };
}

/** Restore a past snapshot's full structure into the template's CURRENT
 *  DRAFT state. Never mutates a live PUBLISHED template directly — if it's
 *  currently published, this forces it back to DRAFT first, so an admin must
 *  explicitly re-review and re-publish (same safety property as a force
 *  blueprint reinstall). Running WorkflowInstances are unaffected: they
 *  reference denormalized stageKey/stepKey on WorkflowStepExecution, not the
 *  template's live authoring rows. */
export async function restoreTemplateVersionAsDraft(input: unknown) {
  const viewer = await requireTemplateManager();
  const data = RestoreTemplateVersionSchema.parse(input);
  const snap = await prisma.workflowTemplateVersionSnapshot.findUnique({
    where: { id: data.versionId },
  });
  if (!snap) throw new Error("Version not found.");
  const definition = snap.snapshot as unknown as WorkflowTemplateDefinition;

  await prisma.$transaction(async (tx) => {
    await tx.workflowTemplateStage.deleteMany({ where: { templateId: snap.templateId } });
    await tx.workflowTransition.deleteMany({ where: { templateId: snap.templateId } });
    await tx.workflowAutomationRule.deleteMany({ where: { templateId: snap.templateId } });

    await tx.workflowTemplate.update({
      where: { id: snap.templateId },
      data: {
        name: definition.name,
        description: definition.description,
        domain: definition.domain,
        status: "DRAFT",
        defaultOwnerRole: definition.defaultOwnerRole,
        defaultOwnerSubtype: definition.defaultOwnerSubtype,
        followUpCadenceHours: definition.followUpCadenceHours,
        escalateAfterHours: definition.escalateAfterHours,
        updatedById: viewer.id,
      },
    });

    const stageIdByKey = new Map<string, string>();
    for (const stage of definition.stages) {
      const created = await tx.workflowTemplateStage.create({
        data: {
          templateId: snap.templateId,
          key: stage.key,
          name: stage.name,
          description: stage.description,
          order: stage.order,
          slaHours: stage.slaHours,
          isInitial: stage.isInitial,
          isTerminal: stage.isTerminal,
          exitCriteria: asJson(stage.exitCriteria),
          steps: {
            create: stage.steps.map((step) => ({
              key: step.key,
              name: step.name,
              description: step.description,
              order: step.order,
              kind: step.kind,
              isRequired: step.isRequired,
              assigneeMode: step.assigneeMode,
              assigneeRole: step.assigneeRole,
              assigneeSubtype: step.assigneeSubtype,
              dueOffsetHours: step.dueOffsetHours,
              config: asJson(step.config),
            })),
          },
        },
        select: { id: true },
      });
      stageIdByKey.set(stage.key, created.id);
    }

    for (const t of definition.transitions) {
      const fromId = stageIdByKey.get(t.fromStageKey);
      const toId = stageIdByKey.get(t.toStageKey);
      if (!fromId || !toId) continue;
      await tx.workflowTransition.create({
        data: {
          templateId: snap.templateId,
          fromStageId: fromId,
          toStageId: toId,
          label: t.label,
          isAutomatic: t.isAutomatic,
          isDefault: t.isDefault,
          condition: asJson(t.condition),
          order: t.order,
        },
      });
    }

    for (const r of definition.automationRules) {
      await tx.workflowAutomationRule.create({
        data: {
          templateId: snap.templateId,
          name: r.name,
          trigger: r.trigger,
          action: r.action,
          stageId: r.stageKey ? (stageIdByKey.get(r.stageKey) ?? null) : null,
          stepKey: r.stepKey,
          enabled: r.enabled,
          config: asJson(r.config),
          order: r.order,
        },
      });
    }
  });

  revalidateTemplate(snap.templateId);
  return { ok: true, id: snap.templateId };
}
