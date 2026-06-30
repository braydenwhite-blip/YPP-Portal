// ============================================================================
// Universal Workflow Engine — pure runtime
// ============================================================================
//
// The deterministic "what happens next" core. Given a template definition, an
// instance projection, and the per-step executions, it derives the full runtime
// state: current/completed/pending stages, blocked steps, completion %, overdue
// status, exit-criteria evaluation, the advance target, and the single next
// recommended action. Pure + serializable (no Prisma, no server-only, dates are
// ISO strings), exactly like lib/automation — so it is fully unit-testable and
// reused identically by server actions, the cron, and the runner UI.

import type {
  ExitCriteria,
  InstanceView,
  NextAction,
  RuntimeInput,
  RuntimeState,
  StageDefinition,
  StageProgress,
  StageProgressStatus,
  StepExecutionView,
  TransitionDefinition,
  WorkflowTemplateDefinition,
} from "@/lib/workflow-engine/types";

const DONE_STATES = new Set(["COMPLETE", "SKIPPED"]);

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function sortedStages(template: WorkflowTemplateDefinition): StageDefinition[] {
  return [...template.stages].sort((a, b) => a.order - b.order);
}

export function executionsForStage(
  executions: StepExecutionView[],
  stageKey: string
): StepExecutionView[] {
  return executions.filter((e) => e.stageKey === stageKey);
}

/** The required steps a stage defines (from the template, not the executions). */
function requiredStepCount(stage: StageDefinition): number {
  return stage.steps.filter((s) => s.isRequired).length;
}

/** Evaluate a stage's exit gate against its executions. Pure. */
export function evaluateExitCriteria(
  stage: StageDefinition,
  stageExecutions: StepExecutionView[]
): { met: boolean; missing: string[] } {
  const criteria: ExitCriteria = stage.exitCriteria ?? {};
  const requireAll = criteria.requireAllRequiredSteps ?? true;
  const missing: string[] = [];

  if (requireAll) {
    // Required steps that have an execution but are not yet done.
    for (const exec of stageExecutions) {
      if (exec.isRequired && !DONE_STATES.has(exec.state)) {
        missing.push(exec.title);
      }
    }
    // Required steps defined on the stage that have no execution yet.
    const seenKeys = new Set(stageExecutions.map((e) => e.stepKey));
    for (const step of stage.steps) {
      if (step.isRequired && !seenKeys.has(step.key)) missing.push(step.name);
    }
  }

  if (typeof criteria.minProgress === "number") {
    const progress = stageProgressPercent(stage, stageExecutions);
    if (progress < criteria.minProgress) {
      missing.push(`Stage at least ${criteria.minProgress}% complete`);
    }
  }

  return { met: missing.length === 0, missing };
}

function stageProgressPercent(
  stage: StageDefinition,
  stageExecutions: StepExecutionView[]
): number {
  const total = Math.max(stage.steps.length, stageExecutions.length);
  if (total === 0) return 100;
  const done = stageExecutions.filter((e) => DONE_STATES.has(e.state)).length;
  return Math.round((done / total) * 100);
}

/** Choose the transition the engine would take out of a stage. Pure. */
export function pickAdvanceTransition(
  template: WorkflowTemplateDefinition,
  fromStageKey: string
): TransitionDefinition | null {
  const candidates = template.transitions
    .filter((t) => t.fromStageKey === fromStageKey)
    .sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
      return a.order - b.order;
    });
  return candidates[0] ?? null;
}

/** The next stage by declared order (linear fallback when no transition). */
export function nextStageByOrder(
  template: WorkflowTemplateDefinition,
  fromStageKey: string
): StageDefinition | null {
  const stages = sortedStages(template);
  const idx = stages.findIndex((s) => s.key === fromStageKey);
  if (idx < 0) return null;
  return stages[idx + 1] ?? null;
}

/** Resolve the stage an instance should advance INTO (transition first, then
 *  the next stage by order). Returns null when there is nowhere to advance. */
export function resolveAdvanceTarget(
  template: WorkflowTemplateDefinition,
  fromStageKey: string
): string | null {
  const transition = pickAdvanceTransition(template, fromStageKey);
  if (transition) return transition.toStageKey;
  const next = nextStageByOrder(template, fromStageKey);
  return next?.key ?? null;
}

function stageIsOverdue(
  stage: StageDefinition,
  stageExecutions: StepExecutionView[],
  instance: InstanceView,
  nowMs: number
): boolean {
  if (!stage.slaHours || stage.slaHours <= 0) return false;
  const startedCandidates = stageExecutions
    .map((e) => toMs(e.startedAt))
    .filter((t): t is number => t !== null);
  const enteredMs =
    startedCandidates.length > 0
      ? Math.min(...startedCandidates)
      : toMs(instance.startedAt);
  if (enteredMs === null) return false;
  return nowMs > enteredMs + stage.slaHours * 60 * 60 * 1000;
}

/** Compute the overall 0–100 completion of an instance. Pure.
 *  Required steps across the WHOLE template are the denominator; completed
 *  required executions are the numerator. Falls back to stage coverage when a
 *  template defines no required steps. */
export function computeCompletionPercent(
  template: WorkflowTemplateDefinition,
  instance: InstanceView,
  executions: StepExecutionView[]
): number {
  if (instance.status === "COMPLETED") return 100;
  const totalRequired = sortedStages(template).reduce(
    (sum, s) => sum + requiredStepCount(s),
    0
  );
  if (totalRequired > 0) {
    const completedRequired = executions.filter(
      (e) => e.isRequired && DONE_STATES.has(e.state)
    ).length;
    return Math.min(100, Math.round((completedRequired / totalRequired) * 100));
  }
  // No required steps anywhere — fall back to how far through the stages we are.
  const stages = sortedStages(template);
  if (stages.length === 0) return 0;
  const currentIdx = instance.currentStageKey
    ? stages.findIndex((s) => s.key === instance.currentStageKey)
    : 0;
  const passed = currentIdx < 0 ? 0 : currentIdx;
  return Math.round((passed / stages.length) * 100);
}

function buildStageProgress(
  stages: StageDefinition[],
  currentIdx: number,
  executions: StepExecutionView[],
  instance: InstanceView,
  nowMs: number
): StageProgress[] {
  return stages.map((stage, idx): StageProgress => {
    const stageExecs = executionsForStage(executions, stage.key);
    const totalSteps = Math.max(stage.steps.length, stageExecs.length);
    const completedSteps = stageExecs.filter((e) => DONE_STATES.has(e.state)).length;
    const requiredSteps = requiredStepCount(stage);
    const requiredComplete = stageExecs.filter(
      (e) => e.isRequired && DONE_STATES.has(e.state)
    ).length;
    const blockedSteps = stageExecs.filter((e) => e.state === "BLOCKED").length;

    let status: StageProgressStatus;
    if (idx < currentIdx) status = "COMPLETED";
    else if (idx > currentIdx) status = "PENDING";
    else status = blockedSteps > 0 ? "BLOCKED" : "CURRENT";

    return {
      stageKey: stage.key,
      name: stage.name,
      order: stage.order,
      status,
      totalSteps,
      completedSteps,
      requiredSteps,
      requiredComplete,
      blockedSteps,
      progressPercent: stageProgressPercent(stage, stageExecs),
      isTerminal: stage.isTerminal,
      isOverdue:
        status === "CURRENT" && stageIsOverdue(stage, stageExecs, instance, nowMs),
    };
  });
}

function pickNextAction(args: {
  instance: InstanceView;
  stage: StageDefinition | null;
  stageExecs: StepExecutionView[];
  exitMet: boolean;
  canAdvance: boolean;
  advanceTargetStageKey: string | null;
  isBlocked: boolean;
}): NextAction {
  const { instance, stage, stageExecs, exitMet, canAdvance, isBlocked } = args;

  if (instance.status === "COMPLETED")
    return { kind: "DONE", label: "Workflow complete" };
  if (instance.status === "CANCELLED")
    return { kind: "DONE", label: "Workflow cancelled" };

  if (isBlocked) {
    const blocked = stageExecs.find((e) => e.state === "BLOCKED");
    return {
      kind: "UNBLOCK",
      label: blocked ? `Unblock: ${blocked.title}` : "Resolve blocker",
      stageKey: stage?.key,
      stepKey: blocked?.stepKey,
      executionId: blocked?.id,
    };
  }

  // First incomplete required step in the current stage.
  const pendingRequired = stageExecs
    .filter((e) => e.isRequired && !DONE_STATES.has(e.state))
    .sort((a, b) => a.stepKey.localeCompare(b.stepKey))[0];
  if (pendingRequired) {
    return {
      kind: "COMPLETE_STEP",
      label: `Complete: ${pendingRequired.title}`,
      stageKey: stage?.key,
      stepKey: pendingRequired.stepKey,
      executionId: pendingRequired.id,
    };
  }

  if (exitMet && stage && !stage.isTerminal && canAdvance) {
    return {
      kind: "ADVANCE_STAGE",
      label: "Advance to the next stage",
      stageKey: stage.key,
    };
  }

  if (exitMet && stage?.isTerminal) {
    return { kind: "DONE", label: "Mark workflow complete", stageKey: stage.key };
  }

  // Optional steps remain but the stage can already exit, or no current stage.
  const pendingOptional = stageExecs.find((e) => !DONE_STATES.has(e.state));
  if (pendingOptional) {
    return {
      kind: "COMPLETE_STEP",
      label: `Optional: ${pendingOptional.title}`,
      stageKey: stage?.key,
      stepKey: pendingOptional.stepKey,
      executionId: pendingOptional.id,
    };
  }

  return { kind: "DONE", label: "Nothing pending", stageKey: stage?.key };
}

/** THE entry point: derive the full runtime state for an instance. Pure. */
export function computeRuntimeState(input: RuntimeInput): RuntimeState {
  const { template, instance, executions } = input;
  const nowMs = toMs(input.now) ?? Date.now();
  const stages = sortedStages(template);

  const currentStageKey =
    instance.currentStageKey ?? (stages.length > 0 ? stages[0].key : null);
  const currentIdx = currentStageKey
    ? stages.findIndex((s) => s.key === currentStageKey)
    : -1;
  const currentStage = currentIdx >= 0 ? stages[currentIdx] : null;
  const stageExecs = currentStage
    ? executionsForStage(executions, currentStage.key)
    : [];

  const stageProgress = buildStageProgress(
    stages,
    currentIdx,
    executions,
    instance,
    nowMs
  );

  const exit = currentStage
    ? evaluateExitCriteria(currentStage, stageExecs)
    : { met: true, missing: [] };

  const advanceTargetStageKey =
    currentStage && !currentStage.isTerminal && exit.met
      ? resolveAdvanceTarget(template, currentStage.key)
      : null;
  const canAdvance = advanceTargetStageKey !== null;

  const blockedExecutions = executions.filter((e) => e.state === "BLOCKED");
  const isBlocked =
    instance.status === "BLOCKED" ||
    stageExecs.some((e) => e.state === "BLOCKED");

  const completionPercent = computeCompletionPercent(template, instance, executions);

  const instanceDueMs = toMs(instance.dueAt);
  const isOverdue =
    instance.status !== "COMPLETED" &&
    instance.status !== "CANCELLED" &&
    ((instanceDueMs !== null && nowMs > instanceDueMs) ||
      stageProgress.some((s) => s.isOverdue));

  const nextAction = pickNextAction({
    instance,
    stage: currentStage,
    stageExecs,
    exitMet: exit.met,
    canAdvance,
    advanceTargetStageKey,
    isBlocked,
  });

  return {
    instanceId: instance.id,
    status: instance.status,
    currentStageKey,
    completedStageKeys: stages.slice(0, Math.max(currentIdx, 0)).map((s) => s.key),
    pendingStageKeys:
      currentIdx >= 0 ? stages.slice(currentIdx + 1).map((s) => s.key) : [],
    blockedExecutionIds: blockedExecutions.map((e) => e.id),
    completionPercent,
    isOverdue,
    isBlocked,
    nextAction,
    stages: stageProgress,
    canAdvance,
    advanceTargetStageKey,
    exitCriteria: exit,
  };
}
