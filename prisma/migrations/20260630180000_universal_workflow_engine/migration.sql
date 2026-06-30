-- Universal Workflow Engine
--
-- The domain-agnostic execution engine (lib/workflow-engine/*). Lets any
-- business process be modeled as a reusable WorkflowTemplate (a graph of
-- WorkflowTemplateStage → WorkflowTemplateStep with WorkflowTransition edges,
-- WorkflowAutomationRule side-effects, and WorkflowTrigger start conditions)
-- and run as a WorkflowInstance with per-step WorkflowStepExecution records,
-- a WorkflowEvent history timeline, WorkflowSnapshot point-in-time state, and
-- WorkflowMetric analytics roll-ups.
--
-- Additive-only. User/Chapter references on engine tables are loosely-coupled
-- String columns (no FK) per the PartnerNote.authorId convention, so the large
-- User/Chapter models are untouched. Intra-engine relations are real FKs with
-- cascade. Written idempotently (CREATE ... IF NOT EXISTS / DO $$ guards) so
-- `prisma migrate deploy` is safe to re-run.

-- The WORKFLOW_ENGINE value added to the existing WorkflowKind enum lives in its
-- own earlier migration (20260630175900_workflow_engine_kind), matching the repo
-- convention for enum-value additions (see add_summer_workshop_program_type).

-- 1. Enums (guarded so a re-run is a no-op).
DO $$ BEGIN
  CREATE TYPE "WorkflowTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkflowInstanceStatus" AS ENUM ('ACTIVE', 'BLOCKED', 'ON_HOLD', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkflowStepKind" AS ENUM ('TASK', 'APPROVAL', 'MEETING', 'DOCUMENT', 'FORM', 'DECISION', 'AUTOMATED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkflowStepState" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETE', 'SKIPPED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkflowAutomationTrigger" AS ENUM ('ON_INSTANCE_START', 'ON_STAGE_ENTER', 'ON_STAGE_EXIT', 'ON_STEP_COMPLETE', 'ON_INSTANCE_COMPLETE', 'ON_OVERDUE', 'ON_FOLLOW_UP_DUE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkflowAutomationAction" AS ENUM ('CREATE_ACTION', 'CREATE_MEETING', 'SEND_NOTIFICATION', 'CREATE_WORKFLOW_ITEM', 'SCHEDULE_FOLLOW_UP', 'ESCALATE', 'ADVANCE_STAGE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkflowTriggerEvent" AS ENUM ('MANUAL', 'ENTITY_CREATED', 'ENTITY_STATUS_CHANGED', 'SCHEDULED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "WorkflowEventKind" AS ENUM ('INSTANCE_CREATED', 'STAGE_ENTERED', 'STAGE_EXITED', 'STEP_STARTED', 'STEP_COMPLETED', 'STEP_BLOCKED', 'STEP_SKIPPED', 'AUTOMATION_RAN', 'OWNER_CHANGED', 'FOLLOW_UP_SCHEDULED', 'ESCALATED', 'INSTANCE_COMPLETED', 'INSTANCE_CANCELLED', 'NOTE');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. WorkflowTemplate
CREATE TABLE IF NOT EXISTS "WorkflowTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "domain" TEXT,
  "status" "WorkflowTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "isBlueprint" BOOLEAN NOT NULL DEFAULT false,
  "blueprintKey" TEXT,
  "defaultOwnerRole" TEXT,
  "defaultOwnerSubtype" TEXT,
  "followUpCadenceHours" INTEGER,
  "escalateAfterHours" INTEGER,
  "config" JSONB,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowTemplate_key_key" ON "WorkflowTemplate"("key");
CREATE INDEX IF NOT EXISTS "WorkflowTemplate_status_idx" ON "WorkflowTemplate"("status");
CREATE INDEX IF NOT EXISTS "WorkflowTemplate_domain_idx" ON "WorkflowTemplate"("domain");
CREATE INDEX IF NOT EXISTS "WorkflowTemplate_blueprintKey_idx" ON "WorkflowTemplate"("blueprintKey");

-- 3. WorkflowTemplateStage
CREATE TABLE IF NOT EXISTS "WorkflowTemplateStage" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "slaHours" INTEGER,
  "isInitial" BOOLEAN NOT NULL DEFAULT false,
  "isTerminal" BOOLEAN NOT NULL DEFAULT false,
  "exitCriteria" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowTemplateStage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowTemplateStage_templateId_key_key" ON "WorkflowTemplateStage"("templateId", "key");
CREATE INDEX IF NOT EXISTS "WorkflowTemplateStage_templateId_order_idx" ON "WorkflowTemplateStage"("templateId", "order");

DO $$ BEGIN
  ALTER TABLE "WorkflowTemplateStage" ADD CONSTRAINT "WorkflowTemplateStage_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. WorkflowTemplateStep
CREATE TABLE IF NOT EXISTS "WorkflowTemplateStep" (
  "id" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  "kind" "WorkflowStepKind" NOT NULL DEFAULT 'TASK',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "assigneeMode" TEXT,
  "assigneeRole" TEXT,
  "assigneeSubtype" TEXT,
  "dueOffsetHours" INTEGER,
  "config" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowTemplateStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowTemplateStep_stageId_key_key" ON "WorkflowTemplateStep"("stageId", "key");
CREATE INDEX IF NOT EXISTS "WorkflowTemplateStep_stageId_order_idx" ON "WorkflowTemplateStep"("stageId", "order");

DO $$ BEGIN
  ALTER TABLE "WorkflowTemplateStep" ADD CONSTRAINT "WorkflowTemplateStep_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "WorkflowTemplateStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. WorkflowTransition
CREATE TABLE IF NOT EXISTS "WorkflowTransition" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "fromStageId" TEXT NOT NULL,
  "toStageId" TEXT NOT NULL,
  "label" TEXT,
  "condition" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT true,
  "isAutomatic" BOOLEAN NOT NULL DEFAULT true,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowTransition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowTransition_templateId_idx" ON "WorkflowTransition"("templateId");
CREATE INDEX IF NOT EXISTS "WorkflowTransition_fromStageId_idx" ON "WorkflowTransition"("fromStageId");
CREATE INDEX IF NOT EXISTS "WorkflowTransition_toStageId_idx" ON "WorkflowTransition"("toStageId");

DO $$ BEGIN
  ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_fromStageId_fkey"
    FOREIGN KEY ("fromStageId") REFERENCES "WorkflowTemplateStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowTransition" ADD CONSTRAINT "WorkflowTransition_toStageId_fkey"
    FOREIGN KEY ("toStageId") REFERENCES "WorkflowTemplateStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 6. WorkflowAutomationRule
CREATE TABLE IF NOT EXISTS "WorkflowAutomationRule" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trigger" "WorkflowAutomationTrigger" NOT NULL,
  "action" "WorkflowAutomationAction" NOT NULL,
  "stageId" TEXT,
  "stepKey" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "config" JSONB,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowAutomationRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowAutomationRule_templateId_trigger_enabled_idx" ON "WorkflowAutomationRule"("templateId", "trigger", "enabled");
CREATE INDEX IF NOT EXISTS "WorkflowAutomationRule_stageId_idx" ON "WorkflowAutomationRule"("stageId");

DO $$ BEGIN
  ALTER TABLE "WorkflowAutomationRule" ADD CONSTRAINT "WorkflowAutomationRule_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowAutomationRule" ADD CONSTRAINT "WorkflowAutomationRule_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "WorkflowTemplateStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 7. WorkflowTrigger
CREATE TABLE IF NOT EXISTS "WorkflowTrigger" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "event" "WorkflowTriggerEvent" NOT NULL DEFAULT 'MANUAL',
  "subjectType" TEXT,
  "matchConfig" JSONB,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowTrigger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowTrigger_templateId_event_enabled_idx" ON "WorkflowTrigger"("templateId", "event", "enabled");
CREATE INDEX IF NOT EXISTS "WorkflowTrigger_event_enabled_idx" ON "WorkflowTrigger"("event", "enabled");

DO $$ BEGIN
  ALTER TABLE "WorkflowTrigger" ADD CONSTRAINT "WorkflowTrigger_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 8. WorkflowInstance
CREATE TABLE IF NOT EXISTS "WorkflowInstance" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "WorkflowInstanceStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentStageId" TEXT,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "chapterId" TEXT,
  "ownerId" TEXT,
  "startedById" TEXT,
  "completionPercent" INTEGER NOT NULL DEFAULT 0,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "followUpAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "lastEscalationAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowInstance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowInstance_status_idx" ON "WorkflowInstance"("status");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_templateId_status_idx" ON "WorkflowInstance"("templateId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_ownerId_status_idx" ON "WorkflowInstance"("ownerId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_chapterId_status_idx" ON "WorkflowInstance"("chapterId", "status");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_dueAt_idx" ON "WorkflowInstance"("dueAt");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_followUpAt_idx" ON "WorkflowInstance"("followUpAt");
CREATE INDEX IF NOT EXISTS "WorkflowInstance_subjectType_subjectId_idx" ON "WorkflowInstance"("subjectType", "subjectId");

DO $$ BEGIN
  ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowInstance" ADD CONSTRAINT "WorkflowInstance_currentStageId_fkey"
    FOREIGN KEY ("currentStageId") REFERENCES "WorkflowTemplateStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 9. WorkflowStepExecution
CREATE TABLE IF NOT EXISTS "WorkflowStepExecution" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "stepId" TEXT,
  "stageKey" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "kind" "WorkflowStepKind" NOT NULL DEFAULT 'TASK',
  "state" "WorkflowStepState" NOT NULL DEFAULT 'PENDING',
  "isRequired" BOOLEAN NOT NULL DEFAULT true,
  "ownerId" TEXT,
  "dueAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "completedById" TEXT,
  "blockedReason" TEXT,
  "output" JSONB,
  "linkedActionItemId" TEXT,
  "linkedMeetingId" TEXT,
  "linkedWorkflowItemId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowStepExecution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowStepExecution_instanceId_state_idx" ON "WorkflowStepExecution"("instanceId", "state");
CREATE INDEX IF NOT EXISTS "WorkflowStepExecution_ownerId_state_idx" ON "WorkflowStepExecution"("ownerId", "state");
CREATE INDEX IF NOT EXISTS "WorkflowStepExecution_stepId_idx" ON "WorkflowStepExecution"("stepId");

DO $$ BEGIN
  ALTER TABLE "WorkflowStepExecution" ADD CONSTRAINT "WorkflowStepExecution_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "WorkflowStepExecution" ADD CONSTRAINT "WorkflowStepExecution_stepId_fkey"
    FOREIGN KEY ("stepId") REFERENCES "WorkflowTemplateStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 10. WorkflowEvent
CREATE TABLE IF NOT EXISTS "WorkflowEvent" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "kind" "WorkflowEventKind" NOT NULL,
  "summary" TEXT NOT NULL,
  "fromStageKey" TEXT,
  "toStageKey" TEXT,
  "stepKey" TEXT,
  "actorId" TEXT,
  "data" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowEvent_instanceId_createdAt_idx" ON "WorkflowEvent"("instanceId", "createdAt");
CREATE INDEX IF NOT EXISTS "WorkflowEvent_kind_idx" ON "WorkflowEvent"("kind");

DO $$ BEGIN
  ALTER TABLE "WorkflowEvent" ADD CONSTRAINT "WorkflowEvent_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 11. WorkflowSnapshot
CREATE TABLE IF NOT EXISTS "WorkflowSnapshot" (
  "id" TEXT NOT NULL,
  "instanceId" TEXT NOT NULL,
  "stageKey" TEXT,
  "status" TEXT NOT NULL,
  "completionPercent" INTEGER NOT NULL DEFAULT 0,
  "state" JSONB NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowSnapshot_instanceId_capturedAt_idx" ON "WorkflowSnapshot"("instanceId", "capturedAt");

DO $$ BEGIN
  ALTER TABLE "WorkflowSnapshot" ADD CONSTRAINT "WorkflowSnapshot_instanceId_fkey"
    FOREIGN KEY ("instanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 12. WorkflowMetric
CREATE TABLE IF NOT EXISTS "WorkflowMetric" (
  "id" TEXT NOT NULL,
  "templateId" TEXT,
  "metricKey" TEXT NOT NULL,
  "dimension" TEXT,
  "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "windowStart" TIMESTAMP(3),
  "windowEnd" TIMESTAMP(3),
  "bucketKey" TEXT NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowMetric_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowMetric_bucketKey_key" ON "WorkflowMetric"("bucketKey");
CREATE INDEX IF NOT EXISTS "WorkflowMetric_templateId_metricKey_capturedAt_idx" ON "WorkflowMetric"("templateId", "metricKey", "capturedAt");
