-- WorkflowTemplateVersionSnapshot
--
-- Point-in-time snapshots of a template's full structure, captured every time
-- it is published. Powers the builder's Versions tab (view a past version,
-- restore one as the current DRAFT). Additive history only — never mutates a
-- live PUBLISHED template directly, so running WorkflowInstance /
-- WorkflowStepExecution rows are never put at risk.

CREATE TABLE IF NOT EXISTS "WorkflowTemplateVersionSnapshot" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedById" TEXT,

  CONSTRAINT "WorkflowTemplateVersionSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkflowTemplateVersionSnapshot_templateId_publishedAt_idx"
  ON "WorkflowTemplateVersionSnapshot"("templateId", "publishedAt");

DO $$ BEGIN
  ALTER TABLE "WorkflowTemplateVersionSnapshot" ADD CONSTRAINT "WorkflowTemplateVersionSnapshot_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "WorkflowTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
