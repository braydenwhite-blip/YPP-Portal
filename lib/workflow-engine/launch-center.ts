// ============================================================================
// Universal Workflow Engine — Launch Center preview (pure)
// ============================================================================
//
// Shapes an already-loaded WorkflowTemplateDefinition into a human-readable
// "here's what starting this will do" preview — no DB access. Powers the
// start-workflow modal's "preview generated steps/actions/meetings before you
// confirm launch" requirement: a viewer picks a template, sees this preview,
// then clicks Confirm.

import type { WorkflowTemplateDefinition } from "@/lib/workflow-engine/types";

export type LaunchPreview = {
  templateName: string;
  stageCount: number;
  firstStageName: string;
  firstStepNames: string[];
  estimatedActionsCount: number;
  estimatedMeetingsCount: number;
  hasEscalation: boolean;
};

/** Mirrors engine.ts's startInstance tie-break: the isInitial stage, or else the lowest `order`. */
function pickInitialStage(definition: WorkflowTemplateDefinition) {
  return (
    definition.stages.find((s) => s.isInitial) ??
    [...definition.stages].sort((a, b) => a.order - b.order)[0] ??
    null
  );
}

export function computeLaunchPreview(definition: WorkflowTemplateDefinition): LaunchPreview {
  const initialStage = pickInitialStage(definition);
  const firstStepNames = initialStage
    ? [...initialStage.steps].sort((a, b) => a.order - b.order).map((s) => s.name)
    : [];

  const estimatedActionsCount = definition.automationRules.filter(
    (r) => r.action === "CREATE_ACTION"
  ).length;
  const estimatedMeetingsCount = definition.automationRules.filter(
    (r) => r.action === "CREATE_MEETING"
  ).length;
  const hasEscalation = definition.automationRules.some((r) => r.action === "ESCALATE");

  return {
    templateName: definition.name,
    stageCount: definition.stages.length,
    firstStageName: initialStage?.name ?? "—",
    firstStepNames,
    estimatedActionsCount,
    estimatedMeetingsCount,
    hasEscalation,
  };
}
