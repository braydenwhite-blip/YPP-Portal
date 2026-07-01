// ============================================================================
// Universal Workflow Engine — blueprint catalog: shared types
// ============================================================================
//
// Pure data + type definitions (no Prisma, no server-only). Each WorkflowBlueprint
// is a complete template definition — stages, steps, transitions, automation
// rules (which reuse the existing ActionItem / Meeting / Notification systems),
// and optional entity-status triggers. `seedWorkflowBlueprints`
// (lib/workflow-engine/seed.ts) installs them idempotently, and the admin
// "Install blueprint" action instantiates any of them. Adding a new business
// process = adding an entry to one of the category files in this directory,
// never new engine code.

import type {
  ExitCriteria,
  WorkflowAutomationActionValue,
  WorkflowAutomationTriggerValue,
  WorkflowStepKindValue,
  WorkflowTemplateStatusValue,
} from "@/lib/workflow-engine/types";

export type BlueprintStep = {
  key: string;
  name: string;
  description?: string;
  kind?: WorkflowStepKindValue;
  isRequired?: boolean;
  assigneeMode?: string;
  assigneeRole?: string;
  assigneeSubtype?: string;
  dueOffsetHours?: number;
  config?: Record<string, unknown>;
};

export type BlueprintStage = {
  key: string;
  name: string;
  description?: string;
  slaHours?: number;
  isInitial?: boolean;
  isTerminal?: boolean;
  exitCriteria?: ExitCriteria;
  steps: BlueprintStep[];
};

export type BlueprintTransition = {
  fromStageKey: string;
  toStageKey: string;
  label?: string;
  isAutomatic?: boolean;
  condition?: Record<string, unknown>;
};

export type BlueprintAutomation = {
  name: string;
  trigger: WorkflowAutomationTriggerValue;
  action: WorkflowAutomationActionValue;
  stageKey?: string;
  stepKey?: string;
  config?: Record<string, unknown>;
};

/** Entity-status-triggered auto-start. Evaluated by
 *  lib/workflow-engine/triggers.ts at the small set of mutation sites that call
 *  fireEntityStatusChanged() — see that file for the exact wiring. Installed as
 *  WorkflowTrigger rows by installBlueprintDefinition(). */
export type BlueprintTrigger = {
  event: "ENTITY_STATUS_CHANGED";
  /** RELATED_ENTITY_TYPE-style subject vocabulary, e.g. "CHAPTER". */
  subjectType: string;
  /** The status value that starts this blueprint. */
  matchStatus: string;
};

export type WorkflowBlueprint = {
  key: string;
  name: string;
  description: string;
  domain: string;
  defaultOwnerRole?: string;
  defaultOwnerSubtype?: string;
  followUpCadenceHours?: number;
  escalateAfterHours?: number;
  /** Initial install status. Defaults to the seed call's `publish` option when
   *  unset (preserves the original 12 blueprints' behavior). New, not-yet
   *  human-reviewed content should set "DRAFT" explicitly. */
  initialStatus?: WorkflowTemplateStatusValue;
  stages: BlueprintStage[];
  /** Optional explicit edges; defaults to a linear chain when omitted. */
  transitions?: BlueprintTransition[];
  automations?: BlueprintAutomation[];
  /** Optional entity-status-driven auto-start triggers (see BlueprintTrigger). */
  triggers?: BlueprintTrigger[];
};
