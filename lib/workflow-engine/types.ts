// ============================================================================
// Universal Workflow Engine — serializable contracts
// ============================================================================
//
// Pure, serializable types shared across the server/client boundary. Dates are
// ISO strings (like lib/automation), so every projection here crosses into a
// "use client" component cleanly and the pure runtime is fully unit-testable.

export type WorkflowTemplateStatusValue = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type WorkflowInstanceStatusValue =
  | "ACTIVE"
  | "BLOCKED"
  | "ON_HOLD"
  | "COMPLETED"
  | "CANCELLED";
export type WorkflowStepKindValue =
  | "TASK"
  | "APPROVAL"
  | "MEETING"
  | "DOCUMENT"
  | "FORM"
  | "DECISION"
  | "AUTOMATED";
export type WorkflowStepStateValue =
  | "PENDING"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETE"
  | "SKIPPED";
export type WorkflowAutomationTriggerValue =
  | "ON_INSTANCE_START"
  | "ON_STAGE_ENTER"
  | "ON_STAGE_EXIT"
  | "ON_STEP_COMPLETE"
  | "ON_INSTANCE_COMPLETE"
  | "ON_OVERDUE"
  | "ON_FOLLOW_UP_DUE";
export type WorkflowAutomationActionValue =
  | "CREATE_ACTION"
  | "CREATE_MEETING"
  | "SEND_NOTIFICATION"
  | "CREATE_WORKFLOW_ITEM"
  | "SCHEDULE_FOLLOW_UP"
  | "ESCALATE"
  | "ADVANCE_STAGE";

/** Stage exit gate. `requireAllRequiredSteps` (default true) means every
 *  required step must be COMPLETE/SKIPPED before the stage can be left. */
export type ExitCriteria = {
  requireAllRequiredSteps?: boolean;
  /** Minimum stage progress percent (0–100) to allow exit. */
  minProgress?: number;
  /** Human-readable extra conditions (informational; shown in the runner). */
  custom?: string[];
};

// ---------------------------------------------------------------------------
// Template definition (a serializable projection of the Prisma rows)
// ---------------------------------------------------------------------------

export type StepDefinition = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  order: number;
  kind: WorkflowStepKindValue;
  isRequired: boolean;
  assigneeMode: string | null;
  assigneeRole: string | null;
  assigneeSubtype: string | null;
  dueOffsetHours: number | null;
  config: Record<string, unknown> | null;
};

export type StageDefinition = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  order: number;
  slaHours: number | null;
  isInitial: boolean;
  isTerminal: boolean;
  exitCriteria: ExitCriteria | null;
  steps: StepDefinition[];
};

export type TransitionDefinition = {
  id: string;
  fromStageKey: string;
  toStageKey: string;
  label: string | null;
  condition: Record<string, unknown> | null;
  isDefault: boolean;
  isAutomatic: boolean;
  order: number;
};

export type AutomationRuleDefinition = {
  id: string;
  name: string;
  trigger: WorkflowAutomationTriggerValue;
  action: WorkflowAutomationActionValue;
  stageKey: string | null;
  stepKey: string | null;
  enabled: boolean;
  config: Record<string, unknown> | null;
  order: number;
};

export type WorkflowTemplateDefinition = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  domain: string | null;
  status: WorkflowTemplateStatusValue;
  version: number;
  defaultOwnerRole: string | null;
  defaultOwnerSubtype: string | null;
  followUpCadenceHours: number | null;
  escalateAfterHours: number | null;
  config: Record<string, unknown> | null;
  stages: StageDefinition[];
  transitions: TransitionDefinition[];
  automationRules: AutomationRuleDefinition[];
};

// ---------------------------------------------------------------------------
// Instance + execution projections (serializable)
// ---------------------------------------------------------------------------

export type StepExecutionView = {
  id: string;
  stepId: string | null;
  stageKey: string;
  stepKey: string;
  title: string;
  kind: WorkflowStepKindValue;
  state: WorkflowStepStateValue;
  isRequired: boolean;
  ownerId: string | null;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  blockedReason: string | null;
  linkedActionItemId: string | null;
  linkedMeetingId: string | null;
  linkedWorkflowItemId: string | null;
};

export type InstanceView = {
  id: string;
  templateId: string;
  title: string;
  status: WorkflowInstanceStatusValue;
  currentStageKey: string | null;
  subjectType: string | null;
  subjectId: string | null;
  chapterId: string | null;
  ownerId: string | null;
  completionPercent: number;
  startedAt: string;
  dueAt: string | null;
  followUpAt: string | null;
  completedAt: string | null;
};

// ---------------------------------------------------------------------------
// Runtime state (the engine's "what happens next" read model)
// ---------------------------------------------------------------------------

export type StageProgressStatus = "COMPLETED" | "CURRENT" | "PENDING" | "BLOCKED";

export type StageProgress = {
  stageKey: string;
  name: string;
  order: number;
  status: StageProgressStatus;
  totalSteps: number;
  completedSteps: number;
  requiredSteps: number;
  requiredComplete: number;
  blockedSteps: number;
  progressPercent: number;
  isTerminal: boolean;
  isOverdue: boolean;
};

export type NextActionKind =
  | "START"
  | "COMPLETE_STEP"
  | "UNBLOCK"
  | "ADVANCE_STAGE"
  | "DONE";

export type NextAction = {
  kind: NextActionKind;
  label: string;
  stageKey?: string;
  stepKey?: string;
  executionId?: string;
};

export type RuntimeState = {
  instanceId: string;
  status: WorkflowInstanceStatusValue;
  currentStageKey: string | null;
  completedStageKeys: string[];
  pendingStageKeys: string[];
  blockedExecutionIds: string[];
  completionPercent: number;
  isOverdue: boolean;
  isBlocked: boolean;
  nextAction: NextAction;
  stages: StageProgress[];
  canAdvance: boolean;
  advanceTargetStageKey: string | null;
  exitCriteria: { met: boolean; missing: string[] };
};

export type RuntimeInput = {
  template: WorkflowTemplateDefinition;
  instance: InstanceView;
  executions: StepExecutionView[];
  /** ISO timestamp for "now" (deterministic; injected like lib/automation). */
  now: string;
};
