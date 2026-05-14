-- Migration: add_archived_at_to_application_submissions
--
-- Adds soft-delete support across the remaining applicant-submission models so
-- admins can "archive" them (hide from list views) without losing audit data.
-- InstructorApplication already had archivedAt + index; this migration brings
-- the four other submission models in line: Application (generic),
-- IncubatorApplication, InternshipApplication, ChapterPresidentApplication.
-- Also adds an index on User.archivedAt (column already exists) so per-user
-- archive lookups stay fast.
--
-- All changes are strictly additive and idempotent.

-- 1) Application (generic) ---------------------------------------------------

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Application_archivedAt_idx"
  ON "Application" ("archivedAt");

-- 2) IncubatorApplication ----------------------------------------------------

ALTER TABLE "IncubatorApplication"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "IncubatorApplication_archivedAt_idx"
  ON "IncubatorApplication" ("archivedAt");

-- 3) InternshipApplication ---------------------------------------------------

ALTER TABLE "InternshipApplication"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "InternshipApplication_archivedAt_idx"
  ON "InternshipApplication" ("archivedAt");

-- 4) ChapterPresidentApplication --------------------------------------------

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_archivedAt_idx"
  ON "ChapterPresidentApplication" ("archivedAt");

-- 5) User (column already exists; only add the index) -----------------------

CREATE INDEX IF NOT EXISTS "User_archivedAt_idx"
  ON "User" ("archivedAt");
