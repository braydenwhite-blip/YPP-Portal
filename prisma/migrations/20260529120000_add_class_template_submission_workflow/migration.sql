-- Migration: add_class_template_submission_workflow
-- Adds the "Submission & review workflow" columns to ClassTemplate that were
-- declared in the Prisma schema but never had a corresponding migration. The
-- missing "submissionStatus" column caused a P2022 error on /admin/course-library
-- (prisma.classTemplate.findMany failed because the column did not exist).
--
-- The "CurriculumSubmissionStatus" enum was already created by an earlier
-- migration (20260313120000_align_instructor_builder_schema), so we only add
-- the columns, the supporting index, and the reviewer foreign key here.

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "submissionStatus" "CurriculumSubmissionStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "reviewedById" TEXT;

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "reviewNotes" TEXT;

DO $$ BEGIN
  ALTER TABLE "ClassTemplate"
    ADD CONSTRAINT "ClassTemplate_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ClassTemplate_submissionStatus_idx"
  ON "ClassTemplate" ("submissionStatus");
