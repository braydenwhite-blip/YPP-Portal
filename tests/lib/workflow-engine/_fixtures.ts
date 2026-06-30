import type {
  InstanceView,
  StageDefinition,
  StepDefinition,
  StepExecutionView,
  TransitionDefinition,
  WorkflowTemplateDefinition,
} from "@/lib/workflow-engine/types";

export const NOW = "2026-06-30T12:00:00.000Z";

export function step(over: Partial<StepDefinition> & { key: string }): StepDefinition {
  return {
    id: over.id ?? over.key,
    name: over.name ?? over.key,
    description: null,
    order: over.order ?? 0,
    kind: "TASK",
    isRequired: true,
    assigneeMode: "OWNER",
    assigneeRole: null,
    assigneeSubtype: null,
    dueOffsetHours: null,
    config: null,
    ...over,
  };
}

export function stage(over: Partial<StageDefinition> & { key: string }): StageDefinition {
  return {
    id: over.id ?? over.key,
    name: over.name ?? over.key,
    description: null,
    order: over.order ?? 0,
    slaHours: null,
    isInitial: false,
    isTerminal: false,
    exitCriteria: null,
    steps: [],
    ...over,
  };
}

export function transition(from: string, to: string): TransitionDefinition {
  return {
    id: `${from}->${to}`,
    fromStageKey: from,
    toStageKey: to,
    label: null,
    condition: null,
    isDefault: true,
    isAutomatic: true,
    order: 0,
  };
}

/** Two-stage template: A (a1 required, a2 optional) → B terminal (b1 required). */
export function twoStageTemplate(
  over: Partial<WorkflowTemplateDefinition> = {}
): WorkflowTemplateDefinition {
  const stageA = stage({
    key: "a",
    name: "Stage A",
    order: 0,
    isInitial: true,
    steps: [
      step({ key: "a1", order: 0, isRequired: true }),
      step({ key: "a2", order: 1, isRequired: false }),
    ],
  });
  const stageB = stage({
    key: "b",
    name: "Stage B",
    order: 1,
    isTerminal: true,
    steps: [step({ key: "b1", order: 0, isRequired: true })],
  });
  return {
    id: "tmpl",
    key: "tmpl",
    name: "Test Template",
    description: null,
    domain: "GENERAL",
    status: "PUBLISHED",
    version: 1,
    defaultOwnerRole: null,
    defaultOwnerSubtype: null,
    followUpCadenceHours: null,
    escalateAfterHours: null,
    config: null,
    stages: [stageA, stageB],
    transitions: [transition("a", "b")],
    automationRules: [],
    ...over,
  };
}

export function instance(over: Partial<InstanceView> = {}): InstanceView {
  return {
    id: "inst",
    templateId: "tmpl",
    title: "Test Instance",
    status: "ACTIVE",
    currentStageKey: "a",
    subjectType: null,
    subjectId: null,
    chapterId: null,
    ownerId: "user-1",
    completionPercent: 0,
    startedAt: NOW,
    dueAt: null,
    followUpAt: null,
    completedAt: null,
    ...over,
  };
}

export function exec(
  over: Partial<StepExecutionView> & { stageKey: string; stepKey: string }
): StepExecutionView {
  return {
    id: over.id ?? `${over.stageKey}.${over.stepKey}`,
    stepId: over.stepId ?? null,
    title: over.title ?? over.stepKey,
    kind: "TASK",
    state: "PENDING",
    isRequired: true,
    ownerId: "user-1",
    dueAt: null,
    startedAt: null,
    completedAt: null,
    blockedReason: null,
    linkedActionItemId: null,
    linkedMeetingId: null,
    linkedWorkflowItemId: null,
    ...over,
  };
}
