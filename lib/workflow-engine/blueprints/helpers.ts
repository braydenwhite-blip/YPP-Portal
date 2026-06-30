// ============================================================================
// Universal Workflow Engine — blueprint catalog: helpers
// ============================================================================

import type { BlueprintAutomation, BlueprintStage, BlueprintTransition, WorkflowBlueprint } from "./types";

/** Default linear transitions: each stage → the next declared stage. */
export function linearTransitions(stages: BlueprintStage[]): BlueprintTransition[] {
  const edges: BlueprintTransition[] = [];
  for (let i = 0; i < stages.length - 1; i++) {
    edges.push({ fromStageKey: stages[i].key, toStageKey: stages[i + 1].key });
  }
  return edges;
}

/** Resolve a blueprint's transitions (explicit or linear fallback). */
export function blueprintTransitions(bp: WorkflowBlueprint): BlueprintTransition[] {
  return bp.transitions && bp.transitions.length > 0
    ? bp.transitions
    : linearTransitions(bp.stages);
}

/** Structural validation used by tests + the install action. Returns errors. */
export function validateBlueprint(bp: WorkflowBlueprint): string[] {
  const errors: string[] = [];
  if (!bp.key) errors.push("missing key");
  if (bp.stages.length === 0) errors.push(`${bp.key}: no stages`);

  const stageKeys = new Set<string>();
  for (const s of bp.stages) {
    if (stageKeys.has(s.key)) errors.push(`${bp.key}: duplicate stage key ${s.key}`);
    stageKeys.add(s.key);
    const stepKeys = new Set<string>();
    for (const st of s.steps) {
      if (stepKeys.has(st.key))
        errors.push(`${bp.key}/${s.key}: duplicate step key ${st.key}`);
      stepKeys.add(st.key);
    }
  }

  const initial = bp.stages.filter((s) => s.isInitial);
  if (initial.length !== 1)
    errors.push(`${bp.key}: expected exactly one initial stage, found ${initial.length}`);
  if (!bp.stages.some((s) => s.isTerminal))
    errors.push(`${bp.key}: no terminal stage`);

  for (const t of blueprintTransitions(bp)) {
    if (!stageKeys.has(t.fromStageKey))
      errors.push(`${bp.key}: transition from unknown stage ${t.fromStageKey}`);
    if (!stageKeys.has(t.toStageKey))
      errors.push(`${bp.key}: transition to unknown stage ${t.toStageKey}`);
  }
  for (const a of bp.automations ?? []) {
    if (a.stageKey && !stageKeys.has(a.stageKey))
      errors.push(`${bp.key}: automation '${a.name}' references unknown stage ${a.stageKey}`);
  }
  for (const t of bp.triggers ?? []) {
    if (!t.subjectType || !t.matchStatus)
      errors.push(`${bp.key}: trigger missing subjectType/matchStatus`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Small automation factories (keep blueprints terse + consistent).
// ---------------------------------------------------------------------------

export function notifyOnEnter(stageKey: string, title: string): BlueprintAutomation {
  return {
    name: `Notify owner entering ${stageKey}`,
    trigger: "ON_STAGE_ENTER",
    action: "SEND_NOTIFICATION",
    stageKey,
    config: { title, mode: "OWNER" },
  };
}

export function actionOnEnter(stageKey: string, title: string, dueOffsetHours = 72): BlueprintAutomation {
  return {
    name: `Create action for ${stageKey}`,
    trigger: "ON_STAGE_ENTER",
    action: "CREATE_ACTION",
    stageKey,
    config: { title, assigneeMode: "OWNER", dueOffsetHours },
  };
}

/** Like actionOnEnter, but tags the created ActionItem with a real ActionType
 *  (see lib/people-strategy/action-types.ts) so it shows up correctly typed
 *  and filterable in the Action Tracker. */
export function typedActionOnEnter(
  stageKey: string,
  title: string,
  actionType: string,
  dueOffsetHours = 72
): BlueprintAutomation {
  return {
    name: `Create action for ${stageKey}`,
    trigger: "ON_STAGE_ENTER",
    action: "CREATE_ACTION",
    stageKey,
    config: { title, assigneeMode: "OWNER", dueOffsetHours, actionType },
  };
}

export function meetingOnEnter(
  stageKey: string,
  title: string,
  meetingType = "GENERIC",
  offsetHours = 72
): BlueprintAutomation {
  return {
    name: `Schedule meeting for ${stageKey}`,
    trigger: "ON_STAGE_ENTER",
    action: "CREATE_MEETING",
    stageKey,
    config: { title, meetingType, offsetHours },
  };
}

export function escalateOverdue(): BlueprintAutomation {
  return {
    name: "Escalate when overdue",
    trigger: "ON_OVERDUE",
    action: "ESCALATE",
    config: { title: "Workflow overdue", escalateTo: "LEADERSHIP" },
  };
}

/** Marker automation: the engine auto-advances a stage once its exit criteria
 *  are met (checked after each step completes). ADVANCE_STAGE is never run as a
 *  side-effect — its presence flags the stage as auto-advancing. */
export function autoAdvanceWhenReady(): BlueprintAutomation {
  return {
    name: "Auto-advance when stage criteria met",
    trigger: "ON_STEP_COMPLETE",
    action: "ADVANCE_STAGE",
  };
}

/** On this blueprint's completion, auto-start another published blueprint's
 *  instance for the same subject/chapter (real workflow chaining — see
 *  effectStartWorkflow in engine.ts). Only wire this where a genuine
 *  sequential dependency exists between two real YPP processes. */
export function startWorkflowOnComplete(targetBlueprintKey: string, title?: string): BlueprintAutomation {
  return {
    name: `Start ${targetBlueprintKey} on completion`,
    trigger: "ON_INSTANCE_COMPLETE",
    action: "START_WORKFLOW",
    config: { targetBlueprintKey, title },
  };
}
