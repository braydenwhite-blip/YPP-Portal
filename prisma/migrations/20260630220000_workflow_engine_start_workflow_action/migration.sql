-- AlterEnum: let a WorkflowAutomationRule start another published template's
-- instance on completion (real workflow chaining, e.g. Chapter Launch ->
-- Instructor Hiring). See lib/workflow-engine/engine.ts effectStartWorkflow.
ALTER TYPE "WorkflowAutomationAction" ADD VALUE IF NOT EXISTS 'START_WORKFLOW';
