-- Add ON_HOLD to InstructorApplicationStatus enum
DO $$ BEGIN
  ALTER TYPE "InstructorApplicationStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add decisionRecommendation and actionDueDate columns
ALTER TABLE "InstructorApplication"
ADD COLUMN IF NOT EXISTS "decisionRecommendation" TEXT;

ALTER TABLE "InstructorApplication"
ADD COLUMN IF NOT EXISTS "actionDueDate" TIMESTAMP(3);
