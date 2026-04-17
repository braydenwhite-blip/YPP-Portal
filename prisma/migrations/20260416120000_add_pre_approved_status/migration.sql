-- Add PRE_APPROVED to InstructorApplicationStatus enum
-- Positioned between INFO_REQUESTED and INTERVIEW_SCHEDULED in the workflow
DO $$ BEGIN
  ALTER TYPE "InstructorApplicationStatus" ADD VALUE IF NOT EXISTS 'PRE_APPROVED' AFTER 'INFO_REQUESTED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
