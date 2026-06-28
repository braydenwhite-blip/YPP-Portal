-- Chapter OS Phase 4: real two-stage curriculum approval. The single-stage
-- ClassTemplate.submissionStatus could only reach one APPROVED state; this adds
-- a CurriculumApproval satellite (1:1 with ClassTemplate, modelled on
-- ClassOfferingApproval) that runs the CP review -> CP approved -> Global review
-- -> Fully approved pipeline, plus an append-only CurriculumReviewEvent audit
-- trail. Launch readiness now requires the FULLY_APPROVED stage.

-- Stage enum (idempotent).
DO $$ BEGIN
  CREATE TYPE "CurriculumApprovalStage" AS ENUM (
    'NOT_SUBMITTED',
    'CP_REVIEW',
    'CP_REVISION_REQUESTED',
    'CP_APPROVED',
    'GLOBAL_REVIEW',
    'GLOBAL_REVISION_REQUESTED',
    'FULLY_APPROVED'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 1:1 approval satellite.
CREATE TABLE IF NOT EXISTS "CurriculumApproval" (
  "id" TEXT NOT NULL,
  "classTemplateId" TEXT NOT NULL,
  "stage" "CurriculumApprovalStage" NOT NULL DEFAULT 'NOT_SUBMITTED',
  "submittedAt" TIMESTAMP(3),
  "cpReviewedById" TEXT,
  "cpReviewedByName" TEXT,
  "cpReviewedAt" TIMESTAMP(3),
  "cpReviewNotes" TEXT,
  "sentToGlobalAt" TIMESTAMP(3),
  "globalReviewedById" TEXT,
  "globalReviewedByName" TEXT,
  "globalReviewedAt" TIMESTAMP(3),
  "globalReviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CurriculumApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CurriculumApproval_classTemplateId_key"
  ON "CurriculumApproval" ("classTemplateId");
CREATE INDEX IF NOT EXISTS "CurriculumApproval_stage_idx"
  ON "CurriculumApproval" ("stage");

-- Append-only review audit trail.
CREATE TABLE IF NOT EXISTS "CurriculumReviewEvent" (
  "id" TEXT NOT NULL,
  "approvalId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "actorRole" TEXT NOT NULL,
  "stage" "CurriculumApprovalStage" NOT NULL,
  "decision" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurriculumReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CurriculumReviewEvent_approvalId_createdAt_idx"
  ON "CurriculumReviewEvent" ("approvalId", "createdAt");

-- Foreign keys (guarded).
DO $$ BEGIN
  ALTER TABLE "CurriculumApproval" ADD CONSTRAINT "CurriculumApproval_classTemplateId_fkey"
    FOREIGN KEY ("classTemplateId") REFERENCES "ClassTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "CurriculumReviewEvent" ADD CONSTRAINT "CurriculumReviewEvent_approvalId_fkey"
    FOREIGN KEY ("approvalId") REFERENCES "CurriculumApproval"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
