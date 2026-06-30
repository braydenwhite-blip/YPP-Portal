-- Add WORKFLOW_ENGINE to the WorkflowKind enum
--
-- Lets the Universal Workflow Engine surface its actionable steps through the
-- SAME WorkflowItem home queue + assignment routing as the existing hardcoded
-- workflows (reuse, not a parallel feed). Standalone migration per repo
-- convention for enum-value additions (see add_summer_workshop_program_type);
-- idempotent via ADD VALUE IF NOT EXISTS.
ALTER TYPE "WorkflowKind" ADD VALUE IF NOT EXISTS 'WORKFLOW_ENGINE';
