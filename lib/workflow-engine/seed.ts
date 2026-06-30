// ============================================================================
// Universal Workflow Engine — blueprint installer
// ============================================================================
//
// Turns a pure WorkflowBlueprint (data) into persisted template rows. Idempotent
// by template `key`, so `prisma db seed` and the admin "Install blueprint" action
// can both call it safely. This is the seam that makes "every business process is
// a reusable template" literally true: installing a process is data, not code.

// NOTE: intentionally NOT `server-only` — this is also imported by the tsx-run
// `prisma/seed.ts` script, which runs outside the Next.js server runtime.

import { prisma } from "@/lib/prisma";
import {
  WORKFLOW_BLUEPRINTS,
  blueprintTransitions,
  validateBlueprint,
  type WorkflowBlueprint,
} from "@/lib/workflow-engine/blueprints";

export type InstallResult = {
  templateId: string;
  key: string;
  created: boolean;
};

/** Install (or skip if present) a single blueprint. Pass `force` to rebuild the
 *  template's children from the blueprint. */
export async function installBlueprintDefinition(
  bp: WorkflowBlueprint,
  opts: { createdById?: string | null; publish?: boolean; force?: boolean } = {}
): Promise<InstallResult> {
  const errors = validateBlueprint(bp);
  if (errors.length > 0) {
    throw new Error(`Invalid blueprint ${bp.key}: ${errors.join("; ")}`);
  }

  const existing = await prisma.workflowTemplate.findUnique({
    where: { key: bp.key },
    select: { id: true },
  });

  if (existing && !opts.force) {
    return { templateId: existing.id, key: bp.key, created: false };
  }

  const status = opts.publish ? "PUBLISHED" : "DRAFT";

  return prisma.$transaction(async (tx) => {
    let templateId: string;

    if (existing) {
      // Force rebuild: drop children (cascade) and recreate from the blueprint.
      await tx.workflowTemplateStage.deleteMany({ where: { templateId: existing.id } });
      await tx.workflowTransition.deleteMany({ where: { templateId: existing.id } });
      await tx.workflowAutomationRule.deleteMany({ where: { templateId: existing.id } });
      await tx.workflowTemplate.update({
        where: { id: existing.id },
        data: {
          name: bp.name,
          description: bp.description,
          domain: bp.domain,
          status,
          isBlueprint: true,
          blueprintKey: bp.key,
          defaultOwnerRole: bp.defaultOwnerRole ?? null,
          defaultOwnerSubtype: bp.defaultOwnerSubtype ?? null,
          followUpCadenceHours: bp.followUpCadenceHours ?? null,
          escalateAfterHours: bp.escalateAfterHours ?? null,
          updatedById: opts.createdById ?? null,
          version: { increment: 1 },
        },
      });
      templateId = existing.id;
    } else {
      const created = await tx.workflowTemplate.create({
        data: {
          key: bp.key,
          name: bp.name,
          description: bp.description,
          domain: bp.domain,
          status,
          isBlueprint: true,
          blueprintKey: bp.key,
          defaultOwnerRole: bp.defaultOwnerRole ?? null,
          defaultOwnerSubtype: bp.defaultOwnerSubtype ?? null,
          followUpCadenceHours: bp.followUpCadenceHours ?? null,
          escalateAfterHours: bp.escalateAfterHours ?? null,
          createdById: opts.createdById ?? null,
        },
        select: { id: true },
      });
      templateId = created.id;
    }

    // Stages + steps.
    const stageIdByKey = new Map<string, string>();
    let stageOrder = 0;
    for (const stage of bp.stages) {
      const createdStage = await tx.workflowTemplateStage.create({
        data: {
          templateId,
          key: stage.key,
          name: stage.name,
          description: stage.description ?? null,
          order: stageOrder++,
          slaHours: stage.slaHours ?? null,
          isInitial: stage.isInitial ?? false,
          isTerminal: stage.isTerminal ?? false,
          exitCriteria: (stage.exitCriteria ?? undefined) as object | undefined,
          steps: {
            create: stage.steps.map((step, i) => ({
              key: step.key,
              name: step.name,
              description: step.description ?? null,
              order: i,
              kind: step.kind ?? "TASK",
              isRequired: step.isRequired ?? true,
              assigneeMode: step.assigneeMode ?? null,
              assigneeRole: step.assigneeRole ?? null,
              assigneeSubtype: step.assigneeSubtype ?? null,
              dueOffsetHours: step.dueOffsetHours ?? null,
              config: (step.config ?? undefined) as object | undefined,
            })),
          },
        },
        select: { id: true },
      });
      stageIdByKey.set(stage.key, createdStage.id);
    }

    // Transitions.
    let transitionOrder = 0;
    for (const t of blueprintTransitions(bp)) {
      const fromId = stageIdByKey.get(t.fromStageKey);
      const toId = stageIdByKey.get(t.toStageKey);
      if (!fromId || !toId) continue;
      await tx.workflowTransition.create({
        data: {
          templateId,
          fromStageId: fromId,
          toStageId: toId,
          label: t.label ?? null,
          isAutomatic: t.isAutomatic ?? true,
          condition: (t.condition ?? undefined) as object | undefined,
          order: transitionOrder++,
        },
      });
    }

    // Automation rules.
    let ruleOrder = 0;
    for (const a of bp.automations ?? []) {
      await tx.workflowAutomationRule.create({
        data: {
          templateId,
          name: a.name,
          trigger: a.trigger,
          action: a.action,
          stageId: a.stageKey ? (stageIdByKey.get(a.stageKey) ?? null) : null,
          stepKey: a.stepKey ?? null,
          config: (a.config ?? undefined) as object | undefined,
          order: ruleOrder++,
        },
      });
    }

    return { templateId, key: bp.key, created: !existing };
  });
}

/** Install every catalog blueprint. Used by `prisma db seed`. */
export async function seedWorkflowBlueprints(
  opts: { createdById?: string | null; publish?: boolean; force?: boolean } = {}
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  for (const bp of WORKFLOW_BLUEPRINTS) {
    results.push(await installBlueprintDefinition(bp, opts));
  }
  return results;
}
