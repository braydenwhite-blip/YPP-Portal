-- Migration: archive_chapters
-- Adds soft-delete columns to Chapter so admins can archive a chapter even
-- when it still has members. Hard delete (chapter.delete) remains for empty
-- chapters; archive is the safe path when members are attached because it
-- keeps every user's chapterId intact for a clean restore.

ALTER TABLE "Chapter"
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedById" TEXT;

CREATE INDEX IF NOT EXISTS "Chapter_archivedAt_idx" ON "Chapter"("archivedAt");
