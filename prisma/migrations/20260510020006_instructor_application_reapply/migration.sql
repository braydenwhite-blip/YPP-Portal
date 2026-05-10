-- Migration: instructor_application_reapply
--
-- Allows the same applicant to file multiple instructor applications over
-- time. Previously `InstructorApplication.applicantId` was @unique, so a
-- rejected/withdrawn applicant was permanently locked out without admin DB
-- intervention.
--
-- Changes:
--   * Drop the UNIQUE constraint on InstructorApplication.applicantId
--   * Add InstructorApplication.isReapplication       (Boolean, default false)
--   * Add InstructorApplication.previousApplicationId (FK -> InstructorApplication.id)
--   * Add a non-unique index on applicantId so applicant lookups stay fast
--
-- All changes are additive (or relax a constraint); existing rows get
-- isReapplication=false (default) and previousApplicationId=NULL.

-- 1) Drop the legacy UNIQUE constraint and its supporting index.
--    Wrapped in DO blocks so re-running is idempotent — early environments
--    that already ran a manual fix won't error.
DO $$ BEGIN
  ALTER TABLE "InstructorApplication"
    DROP CONSTRAINT "InstructorApplication_applicantId_key";
EXCEPTION
  WHEN undefined_object THEN null;
  WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
  DROP INDEX IF EXISTS "InstructorApplication_applicantId_key";
EXCEPTION
  WHEN others THEN null;
END $$;

-- 2) Add a non-unique index on applicantId so the applicant-side lookups
--    (e.g. /application-status, summer-workshop landing) stay fast.
CREATE INDEX IF NOT EXISTS "InstructorApplication_applicantId_idx"
  ON "InstructorApplication"("applicantId");

-- 3) Add the new columns
ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "isReapplication" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "previousApplicationId" TEXT;

-- 4) Self-referential foreign key for the re-application chain.
--    ON DELETE SET NULL so deleting an old row never cascades and orphans
--    the live application — we keep the chain intact even when an old
--    record is purged.
DO $$ BEGIN
  ALTER TABLE "InstructorApplication"
    ADD CONSTRAINT "InstructorApplication_previousApplicationId_fkey"
    FOREIGN KEY ("previousApplicationId") REFERENCES "InstructorApplication"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "InstructorApplication_previousApplicationId_idx"
  ON "InstructorApplication"("previousApplicationId");

CREATE INDEX IF NOT EXISTS "InstructorApplication_isReapplication_idx"
  ON "InstructorApplication"("isReapplication");
