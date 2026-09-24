-- Public General YPP Interest Form submissions (portal-native).
CREATE TABLE IF NOT EXISTS "GeneralInterestSubmission" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "age" TEXT NOT NULL,
  "collaborationExperience" TEXT NOT NULL,
  "resumeUrl" TEXT,
  "resumeFileName" TEXT,
  "additionalInfo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeneralInterestSubmission_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GeneralInterestSubmission_email_idx"
  ON "GeneralInterestSubmission"("email");

CREATE INDEX IF NOT EXISTS "GeneralInterestSubmission_createdAt_idx"
  ON "GeneralInterestSubmission"("createdAt");

-- Idempotent upgrades if an earlier draft of this table already exists.
DO $$ BEGIN
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "gradeLevel" TEXT;
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "age" TEXT;
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "collaborationExperience" TEXT;
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "resumeUrl" TEXT;
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "resumeFileName" TEXT;
  ALTER TABLE "GeneralInterestSubmission" ADD COLUMN IF NOT EXISTS "additionalInfo" TEXT;
EXCEPTION WHEN undefined_table THEN null;
END $$;
