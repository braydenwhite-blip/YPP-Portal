-- Migration: missing_chapter_flag
-- Phase 6 of the Roles/Mentorship/Reviews/Access plan
-- (docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
--
-- Adds the central MissingChapterFlag table that powers the temporary
-- "Missing Chapter" status: the resolution queue, age tracking, the auto-action
-- to the configured owner, and the "fully set up" gate — without retrofitting a
-- status column onto every domain model. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "MissingChapterFlag" (
  "id" TEXT NOT NULL,
  "recordType" TEXT NOT NULL,
  "recordId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "actionItemId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MissingChapterFlag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MissingChapterFlag_recordType_recordId_key"
  ON "MissingChapterFlag"("recordType", "recordId");
CREATE INDEX IF NOT EXISTS "MissingChapterFlag_resolvedAt_idx"
  ON "MissingChapterFlag"("resolvedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissingChapterFlag_resolvedById_fkey') THEN
    ALTER TABLE "MissingChapterFlag"
      ADD CONSTRAINT "MissingChapterFlag_resolvedById_fkey"
      FOREIGN KEY ("resolvedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MissingChapterFlag_createdById_fkey') THEN
    ALTER TABLE "MissingChapterFlag"
      ADD CONSTRAINT "MissingChapterFlag_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
