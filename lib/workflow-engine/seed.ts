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
    // Additively sync any new triggers/automations the blueprint source has
    // gained since this template was installed — never touch stages/steps
    // (see syncBlueprintTriggersAndAutomations for why).
    await syncBlueprintTriggersAndAutomations(bp, existing.id);
    return { templateId: existing.id, key: bp.key, created: false };
  }

  // A blueprint can pin its own initial status (e.g. newly-authored, not-yet
  // human-reviewed content ships as DRAFT regardless of the seed call's
  // `publish` flag); otherwise it follows the seed call as before.
  const status = bp.initialStatus ?? (opts.publish ? "PUBLISHED" : "DRAFT");

  return prisma.$transaction(async (tx) => {
    let templateId: string;

    if (existing) {
      // Force rebuild: drop children (cascade) and recreate from the blueprint.
      await tx.workflowTemplateStage.deleteMany({ where: { templateId: existing.id } });
      await tx.workflowTransition.deleteMany({ where: { templateId: existing.id } });
      await tx.workflowAutomationRule.deleteMany({ where: { templateId: existing.id } });
      await tx.workflowTrigger.deleteMany({ where: { templateId: existing.id } });
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

    // Entity-status-triggered auto-start (see lib/workflow-engine/triggers.ts —
    // these rows are only evaluated by the small set of mutation sites that
    // call fireEntityStatusChanged()).
    for (const t of bp.triggers ?? []) {
      await tx.workflowTrigger.create({
        data: {
          templateId,
          name: `Auto-start on ${t.subjectType} -> ${t.matchStatus}`,
          event: t.event,
          subjectType: t.subjectType,
          matchConfig: { status: t.matchStatus },
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

/** Stable identity key for a blueprint trigger, used to detect whether an
 *  equivalent WorkflowTrigger row already exists on the template. */
function triggerIdentity(t: { event: string; subjectType: string; matchStatus: string }): string {
  return `${t.event}::${t.subjectType}::${t.matchStatus}`;
}

/** Stable identity key for a blueprint automation, used to detect whether an
 *  equivalent WorkflowAutomationRule row already exists on the template.
 *  Compares on (trigger, action, resolved stageId, stepKey, name) — name is
 *  included because two rules with the same trigger/action/scope but
 *  different intent (e.g. two SEND_NOTIFICATION rules on the same stage with
 *  different copy) are meant to coexist, not dedupe into one. */
function automationIdentity(a: {
  trigger: string;
  action: string;
  stageId: string | null;
  stepKey: string | null;
  name: string;
}): string {
  return `${a.trigger}::${a.action}::${a.stageId ?? ""}::${a.stepKey ?? ""}::${a.name}`;
}

/** Additively sync an already-installed template's triggers/automations with
 *  its current blueprint source, WITHOUT touching stages/steps/transitions.
 *
 *  This is the safe counterpart to installBlueprintDefinition's `force`
 *  rebuild: `force` deletes and recreates WorkflowTemplateStage/Step rows,
 *  which is dangerous for a template with live running instances (their
 *  currentStageId / WorkflowStepExecution.stepId reference those rows with
 *  onDelete: SetNull, so a force rebuild silently orphans a running
 *  instance's stage). This function only ever creates missing
 *  WorkflowAutomationRule / WorkflowTrigger rows for the given template — it
 *  never deletes, updates, or touches WorkflowTemplateStage,
 *  WorkflowTemplateStep, or WorkflowTransition in any way, so it's safe to
 *  run against a template with active instances. */
export async function syncBlueprintTriggersAndAutomations(
  bp: WorkflowBlueprint,
  templateId: string
): Promise<{ addedTriggers: number; addedAutomations: number }> {
  const [stages, existingRules, existingTriggers] = await Promise.all([
    prisma.workflowTemplateStage.findMany({
      where: { templateId },
      select: { id: true, key: true },
    }),
    prisma.workflowAutomationRule.findMany({
      where: { templateId },
      select: { trigger: true, action: true, stageId: true, stepKey: true, name: true },
    }),
    prisma.workflowTrigger.findMany({
      where: { templateId },
      select: { event: true, subjectType: true, matchConfig: true },
    }),
  ]);

  const stageIdByKey = new Map(stages.map((s) => [s.key, s.id] as const));

  const existingRuleKeys = new Set(
    existingRules.map((r) =>
      automationIdentity({
        trigger: r.trigger,
        action: r.action,
        stageId: r.stageId,
        stepKey: r.stepKey,
        name: r.name,
      })
    )
  );

  const existingTriggerKeys = new Set(
    existingTriggers
      .map((t) => {
        const status = (t.matchConfig as Record<string, unknown> | null)?.status;
        if (typeof status !== "string" || !t.subjectType) return null;
        return triggerIdentity({ event: t.event, subjectType: t.subjectType, matchStatus: status });
      })
      .filter((k): k is string => k !== null)
  );

  let addedAutomations = 0;
  for (const a of bp.automations ?? []) {
    const stageId = a.stageKey ? (stageIdByKey.get(a.stageKey) ?? null) : null;
    const key = automationIdentity({
      trigger: a.trigger,
      action: a.action,
      stageId,
      stepKey: a.stepKey ?? null,
      name: a.name,
    });
    if (existingRuleKeys.has(key)) continue;

    await prisma.workflowAutomationRule.create({
      data: {
        templateId,
        name: a.name,
        trigger: a.trigger,
        action: a.action,
        stageId,
        stepKey: a.stepKey ?? null,
        config: (a.config ?? undefined) as object | undefined,
        order: existingRules.length + addedAutomations,
      },
    });
    existingRuleKeys.add(key);
    addedAutomations++;
  }

  let addedTriggers = 0;
  for (const t of bp.triggers ?? []) {
    const key = triggerIdentity(t);
    if (existingTriggerKeys.has(key)) continue;

    await prisma.workflowTrigger.create({
      data: {
        templateId,
        name: `Auto-start on ${t.subjectType} -> ${t.matchStatus}`,
        event: t.event,
        subjectType: t.subjectType,
        matchConfig: { status: t.matchStatus },
      },
    });
    existingTriggerKeys.add(key);
    addedTriggers++;
  }

  return { addedTriggers, addedAutomations };
}
