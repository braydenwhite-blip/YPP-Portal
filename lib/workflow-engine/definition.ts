// ============================================================================
// Universal Workflow Engine — definition loader + serializable mappers
// ============================================================================
//
// Bridges the Prisma rows to the pure runtime's serializable contracts. The
// mappers are pure (Prisma row in → plain object out); the loaders query the DB.
// Server-only because they import the Prisma client.

import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  InstanceView,
  StageDefinition,
  StepDefinition,
  StepExecutionView,
  TransitionDefinition,
  AutomationRuleDefinition,
  WorkflowTemplateDefinition,
  WorkflowInstanceStatusValue,
  WorkflowStepKindValue,
  WorkflowStepStateValue,
  ExitCriteria,
} from "@/lib/workflow-engine/types";

function asObject(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}
function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

const templateInclude = {
  stages: { include: { steps: true }, orderBy: { order: "asc" } },
  transitions: true,
  automationRules: { orderBy: { order: "asc" } },
} satisfies Prisma.WorkflowTemplateInclude;

type TemplateRow = Prisma.WorkflowTemplateGetPayload<{ include: typeof templateInclude }>;
type StageRow = TemplateRow["stages"][number];
type StepRow = StageRow["steps"][number];

export function toStepDefinition(step: StepRow): StepDefinition {
  return {
    id: step.id,
    key: step.key,
    name: step.name,
    description: step.description,
    order: step.order,
    kind: step.kind as WorkflowStepKindValue,
    isRequired: step.isRequired,
    assigneeMode: step.assigneeMode,
    assigneeRole: step.assigneeRole,
    assigneeSubtype: step.assigneeSubtype,
    dueOffsetHours: step.dueOffsetHours,
    config: asObject(step.config),
  };
}

export function toStageDefinition(stage: StageRow): StageDefinition {
  return {
    id: stage.id,
    key: stage.key,
    name: stage.name,
    description: stage.description,
    order: stage.order,
    slaHours: stage.slaHours,
    isInitial: stage.isInitial,
    isTerminal: stage.isTerminal,
    exitCriteria: (asObject(stage.exitCriteria) as ExitCriteria | null) ?? null,
    steps: [...stage.steps].sort((a, b) => a.order - b.order).map(toStepDefinition),
  };
}

export function toTemplateDefinition(template: NonNullable<TemplateRow>): WorkflowTemplateDefinition {
  const stages = [...template.stages]
    .sort((a, b) => a.order - b.order)
    .map(toStageDefinition);
  const keyById = new Map(template.stages.map((s) => [s.id, s.key]));

  const transitions: TransitionDefinition[] = template.transitions.map((t) => ({
    id: t.id,
    fromStageKey: keyById.get(t.fromStageId) ?? t.fromStageId,
    toStageKey: keyById.get(t.toStageId) ?? t.toStageId,
    label: t.label,
    condition: asObject(t.condition),
    isDefault: t.isDefault,
    isAutomatic: t.isAutomatic,
    order: t.order,
  }));

  const automationRules: AutomationRuleDefinition[] = template.automationRules.map((r) => ({
    id: r.id,
    name: r.name,
    trigger: r.trigger as AutomationRuleDefinition["trigger"],
    action: r.action as AutomationRuleDefinition["action"],
    stageKey: r.stageId ? (keyById.get(r.stageId) ?? null) : null,
    stepKey: r.stepKey,
    enabled: r.enabled,
    config: asObject(r.config),
    order: r.order,
  }));

  return {
    id: template.id,
    key: template.key,
    name: template.name,
    description: template.description,
    domain: template.domain,
    status: template.status as WorkflowTemplateDefinition["status"],
    version: template.version,
    defaultOwnerRole: template.defaultOwnerRole,
    defaultOwnerSubtype: template.defaultOwnerSubtype,
    followUpCadenceHours: template.followUpCadenceHours,
    escalateAfterHours: template.escalateAfterHours,
    config: asObject(template.config),
    stages,
    transitions,
    automationRules,
  };
}

type InstanceRow = {
  id: string;
  templateId: string;
  title: string;
  status: string;
  currentStageId: string | null;
  subjectType: string | null;
  subjectId: string | null;
  chapterId: string | null;
  ownerId: string | null;
  completionPercent: number;
  startedAt: Date;
  dueAt: Date | null;
  followUpAt: Date | null;
  completedAt: Date | null;
  escalatedAt?: Date | null;
};

export function toInstanceView(
  instance: InstanceRow,
  currentStageKey: string | null
): InstanceView {
  return {
    id: instance.id,
    templateId: instance.templateId,
    title: instance.title,
    status: instance.status as WorkflowInstanceStatusValue,
    currentStageKey,
    subjectType: instance.subjectType,
    subjectId: instance.subjectId,
    chapterId: instance.chapterId,
    ownerId: instance.ownerId,
    completionPercent: instance.completionPercent,
    startedAt: instance.startedAt.toISOString(),
    dueAt: iso(instance.dueAt),
    followUpAt: iso(instance.followUpAt),
    completedAt: iso(instance.completedAt),
    escalatedAt: iso(instance.escalatedAt ?? null),
  };
}

type ExecutionRow = {
  id: string;
  stepId: string | null;
  stageKey: string;
  stepKey: string;
  title: string;
  kind: string;
  state: string;
  isRequired: boolean;
  ownerId: string | null;
  dueAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  blockedReason: string | null;
  linkedActionItemId: string | null;
  linkedMeetingId: string | null;
  linkedWorkflowItemId: string | null;
};

export function toStepExecutionView(exec: ExecutionRow): StepExecutionView {
  return {
    id: exec.id,
    stepId: exec.stepId,
    stageKey: exec.stageKey,
    stepKey: exec.stepKey,
    title: exec.title,
    kind: exec.kind as WorkflowStepKindValue,
    state: exec.state as WorkflowStepStateValue,
    isRequired: exec.isRequired,
    ownerId: exec.ownerId,
    dueAt: iso(exec.dueAt),
    startedAt: iso(exec.startedAt),
    completedAt: iso(exec.completedAt),
    blockedReason: exec.blockedReason,
    linkedActionItemId: exec.linkedActionItemId,
    linkedMeetingId: exec.linkedMeetingId,
    linkedWorkflowItemId: exec.linkedWorkflowItemId,
  };
}

// --- Loaders ---------------------------------------------------------------

export async function loadTemplateDefinition(
  templateId: string
): Promise<WorkflowTemplateDefinition | null> {
  const template = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
    include: templateInclude,
  });
  return template ? toTemplateDefinition(template) : null;
}

export async function loadTemplateDefinitionByKey(
  key: string
): Promise<WorkflowTemplateDefinition | null> {
  const template = await prisma.workflowTemplate.findUnique({
    where: { key },
    include: templateInclude,
  });
  return template ? toTemplateDefinition(template) : null;
}

export type LoadedInstance = {
  definition: WorkflowTemplateDefinition;
  instance: InstanceView;
  executions: StepExecutionView[];
};

/** Load everything the pure runtime needs for a single instance. */
export async function loadInstanceRuntime(
  instanceId: string
): Promise<LoadedInstance | null> {
  // Defensive: a falsy id (a caller resolved an undefined/optional instance id)
  // must not reach `findUnique`, which throws PrismaClientValidationError
  // ("`where` needs at least one of `id`") on `{ id: undefined }`. No id ⇒ no
  // instance ⇒ null, which every caller already handles.
  if (!instanceId) return null;
  const instance = await prisma.workflowInstance.findUnique({
    where: { id: instanceId },
    include: {
      currentStage: { select: { key: true } },
      executions: true,
      template: { include: templateInclude },
    },
  });
  if (!instance || !instance.template) return null;

  const definition = toTemplateDefinition(instance.template);
  const view = toInstanceView(instance, instance.currentStage?.key ?? null);
  const executions = [...instance.executions]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map(toStepExecutionView);

  return { definition, instance: view, executions };
}
