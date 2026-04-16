-- Phase: Mentorship Simplification
-- Adds kickoffNotes + mentorTag to Mentorship, and the MentorTag enum.
-- These fields support the simplified Kanban UX without touching the existing
-- cycleStage approval workflow.

-- CreateEnum: MentorTag
DO $$ BEGIN
    CREATE TYPE "MentorTag" AS ENUM ('FOLLOW_UP_NEEDED', 'OUTSTANDING_PERFORMANCE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- AlterTable: Mentorship — add kickoffNotes
ALTER TABLE "Mentorship"
    ADD COLUMN IF NOT EXISTS "kickoffNotes" TEXT;

-- AlterTable: Mentorship — add mentorTag
ALTER TABLE "Mentorship"
    ADD COLUMN IF NOT EXISTS "mentorTag" "MentorTag";
