// ============================================================================
// Universal Workflow Engine — zod schemas
// ============================================================================
//
// Input validation for every server action. Mirrors the codebase pattern:
// validate first, then authorize, then write, then revalidate.

import { z } from "zod";

import {
  ASSIGNEE_MODES,
  AUTOMATION_ACTIONS,
  AUTOMATION_TRIGGERS,
  STEP_KINDS,
} from "@/lib/workflow-engine/constants";

const id = z.string().min(1);
const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));
const name = z.string().trim().min(1).max(200);
const optionalString = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null));
const hours = z.number().int().min(0).max(24 * 365).optional().nullable();
const jsonObject = z.record(z.string(), z.unknown()).optional().nullable();

export const StepKindEnum = z.enum(STEP_KINDS as unknown as [string, ...string[]]);
export const AutomationTriggerEnum = z.enum(
  AUTOMATION_TRIGGERS as unknown as [string, ...string[]]
);
export const AutomationActionEnum = z.enum(
  AUTOMATION_ACTIONS as unknown as [string, ...string[]]
);
export const AssigneeModeEnum = z.enum(ASSIGNEE_MODES as unknown as [string, ...string[]]);
export const TemplateStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

// --- Templates -------------------------------------------------------------

export const CreateTemplateSchema = z.object({
  name,
  description: optionalText,
  domain: optionalString(60),
  defaultOwnerRole: optionalString(60),
  defaultOwnerSubtype: optionalString(60),
  followUpCadenceHours: hours,
  escalateAfterHours: hours,
});

export const UpdateTemplateSchema = z.object({
  id,
  name: name.optional(),
  description: optionalText,
  domain: optionalString(60),
  defaultOwnerRole: optionalString(60),
  defaultOwnerSubtype: optionalString(60),
  followUpCadenceHours: hours,
  escalateAfterHours: hours,
});

export const SetTemplateStatusSchema = z.object({ id, status: TemplateStatusEnum });
export const TemplateIdSchema = z.object({ id });

// --- Stages ----------------------------------------------------------------

const ExitCriteriaSchema = z
  .object({
    requireAllRequiredSteps: z.boolean().optional(),
    minProgress: z.number().int().min(0).max(100).optional(),
    custom: z.array(z.string().trim().max(200)).max(20).optional(),
  })
  .optional()
  .nullable();

export const AddStageSchema = z.object({
  templateId: id,
  name,
  description: optionalText,
  slaHours: hours,
  isInitial: z.boolean().optional().default(false),
  isTerminal: z.boolean().optional().default(false),
  exitCriteria: ExitCriteriaSchema,
});

export const UpdateStageSchema = z.object({
  id,
  name: name.optional(),
  description: optionalText,
  slaHours: hours,
  isInitial: z.boolean().optional(),
  isTerminal: z.boolean().optional(),
  exitCriteria: ExitCriteriaSchema,
});

export const ReorderStagesSchema = z.object({
  templateId: id,
  orderedStageIds: z.array(id).min(1),
});

export const StageIdSchema = z.object({ id });

// --- Steps -----------------------------------------------------------------

export const AddStepSchema = z.object({
  stageId: id,
  name,
  description: optionalText,
  kind: StepKindEnum.optional().default("TASK"),
  isRequired: z.boolean().optional().default(true),
  assigneeMode: AssigneeModeEnum.optional().nullable(),
  assigneeRole: optionalString(60),
  assigneeSubtype: optionalString(60),
  dueOffsetHours: hours,
  config: jsonObject,
});

export const UpdateStepSchema = z.object({
  id,
  name: name.optional(),
  description: optionalText,
  kind: StepKindEnum.optional(),
  isRequired: z.boolean().optional(),
  assigneeMode: AssigneeModeEnum.optional().nullable(),
  assigneeRole: optionalString(60),
  assigneeSubtype: optionalString(60),
  dueOffsetHours: hours,
  config: jsonObject,
});

export const ReorderStepsSchema = z.object({
  stageId: id,
  orderedStepIds: z.array(id).min(1),
});

export const StepIdSchema = z.object({ id });

// --- Transitions -----------------------------------------------------------

export const AddTransitionSchema = z.object({
  templateId: id,
  fromStageId: id,
  toStageId: id,
  label: optionalString(120),
  isAutomatic: z.boolean().optional().default(true),
  isDefault: z.boolean().optional().default(true),
});

export const TransitionIdSchema = z.object({ id });

// --- Automation rules ------------------------------------------------------

export const AddAutomationRuleSchema = z.object({
  templateId: id,
  name,
  trigger: AutomationTriggerEnum,
  action: AutomationActionEnum,
  stageId: id.optional().nullable(),
  stepKey: optionalString(120),
  config: jsonObject,
});

export const UpdateAutomationRuleSchema = z.object({
  id,
  name: name.optional(),
  trigger: AutomationTriggerEnum.optional(),
  action: AutomationActionEnum.optional(),
  stageId: id.optional().nullable(),
  stepKey: optionalString(120),
  enabled: z.boolean().optional(),
  config: jsonObject,
});

export const AutomationRuleIdSchema = z.object({ id });

// --- Blueprint install -----------------------------------------------------

export const InstallBlueprintSchema = z.object({ blueprintKey: z.string().min(1) });

// --- Instances -------------------------------------------------------------

export const StartInstanceSchema = z.object({
  templateId: id,
  title: optionalString(200),
  subjectType: optionalString(60),
  subjectId: optionalString(200),
  chapterId: optionalString(60),
  ownerId: optionalString(60),
  dueAt: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
});

export const CompleteStepSchema = z.object({
  executionId: id,
  output: jsonObject,
  note: optionalString(2000),
});

export const BlockStepSchema = z.object({
  executionId: id,
  reason: z.string().trim().min(1).max(2000),
});

export const ExecutionIdSchema = z.object({ executionId: id });

export const ReassignStepSchema = z.object({ executionId: id, ownerId: id });

export const InstanceIdSchema = z.object({ instanceId: id });

export const SetInstanceOwnerSchema = z.object({ instanceId: id, ownerId: id });

export const CancelInstanceSchema = z.object({
  instanceId: id,
  reason: optionalString(2000),
});

export const AddInstanceNoteSchema = z.object({
  instanceId: id,
  body: z.string().trim().min(1).max(2000),
});

export const AdvanceInstanceSchema = z.object({
  instanceId: id,
  toStageId: id.optional().nullable(),
});
