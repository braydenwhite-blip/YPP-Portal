-- Repair Instructor Applicant Workflow V1
-- Adds deterministic info-request returns, interview rounds, chair decision
-- history, and soft-materials-compatible indexes.

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "infoRequestReturnStatus" "InstructorApplicationStatus",
  ADD COLUMN IF NOT EXISTS "interviewRound" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "InstructorApplicationInterviewer"
  ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "InstructorInterviewReview"
  ADD COLUMN IF NOT EXISTS "round" INTEGER NOT NULL DEFAULT 1;

UPDATE "InstructorApplication"
SET "interviewRound" = 1
WHERE "interviewRound" IS NULL OR "interviewRound" < 1;

UPDATE "InstructorApplicationInterviewer"
SET "round" = 1
WHERE "round" IS NULL OR "round" < 1;

UPDATE "InstructorInterviewReview"
SET "round" = 1
WHERE "round" IS NULL OR "round" < 1;

DROP INDEX IF EXISTS "InstructorApplicationChairDecision_applicationId_key";
DROP INDEX IF EXISTS "InstructorApplicationInterviewer_applicationId_role_key";
DROP INDEX IF EXISTS "InstructorApplicationInterviewer_applicationId_round_role_key";
DROP INDEX IF EXISTS "InstructorInterviewReview_applicationId_reviewerId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorApplicationChairDecision_active_applicationId_key"
  ON "InstructorApplicationChairDecision"("applicationId")
  WHERE "supersededAt" IS NULL;

CREATE INDEX IF NOT EXISTS "InstructorApplicationChairDecision_applicationId_decidedAt_idx"
  ON "InstructorApplicationChairDecision"("applicationId", "decidedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorApplicationInterviewer_active_applicationId_round_role_key"
  ON "InstructorApplicationInterviewer"("applicationId", "round", "role")
  WHERE "removedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "InstructorApplicationInterviewer_applicationId_round_role_idx"
  ON "InstructorApplicationInterviewer"("applicationId", "round", "role");

CREATE INDEX IF NOT EXISTS "InstructorApplicationInterviewer_applicationId_round_removedAt_idx"
  ON "InstructorApplicationInterviewer"("applicationId", "round", "removedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorInterviewReview_applicationId_reviewerId_round_key"
  ON "InstructorInterviewReview"("applicationId", "reviewerId", "round");

CREATE INDEX IF NOT EXISTS "InstructorInterviewReview_applicationId_round_isLeadReview_idx"
  ON "InstructorInterviewReview"("applicationId", "round", "isLeadReview");

CREATE INDEX IF NOT EXISTS "InstructorApplication_interviewRound_idx"
  ON "InstructorApplication"("interviewRound");
