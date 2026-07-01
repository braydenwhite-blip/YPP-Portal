-- Workflow Attachment Layer
--
-- Adds a secondary attachment table for WorkflowInstance so a running
-- instance can relate to more than one YPP object (the PRIMARY subject stays
-- on WorkflowInstance.subjectType/subjectId; this table carries everything
-- else — e.g. a chapter an Instructor Hiring workflow is staffing for). Also
-- indexes WorkflowStepExecution.linkedActionItemId/linkedMeetingId so the
-- Action Tracker and Meetings surfaces can look up "which workflow step made
-- this?" without a table scan. Additive only — no existing column changes.

CREATE TABLE IF NOT EXISTS "WorkflowAttachment" (
  "id" TEXT NOT NULL,
  "workflowInstanceId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "relationship" TEXT NOT NULL DEFAULT 'SECONDARY',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkflowAttachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowAttachment_workflowInstanceId_entityType_entityId_rel_key"
  ON "WorkflowAttachment"("workflowInstanceId", "entityType", "entityId", "relationship");

CREATE INDEX IF NOT EXISTS "WorkflowAttachment_entityType_entityId_idx"
  ON "WorkflowAttachment"("entityType", "entityId");

CREATE INDEX IF NOT EXISTS "WorkflowAttachment_workflowInstanceId_idx"
  ON "WorkflowAttachment"("workflowInstanceId");

DO $$ BEGIN
  ALTER TABLE "WorkflowAttachment" ADD CONSTRAINT "WorkflowAttachment_workflowInstanceId_fkey"
    FOREIGN KEY ("workflowInstanceId") REFERENCES "WorkflowInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE INDEX IF NOT EXISTS "WorkflowStepExecution_linkedActionItemId_idx"
  ON "WorkflowStepExecution"("linkedActionItemId");

CREATE INDEX IF NOT EXISTS "WorkflowStepExecution_linkedMeetingId_idx"
  ON "WorkflowStepExecution"("linkedMeetingId");
