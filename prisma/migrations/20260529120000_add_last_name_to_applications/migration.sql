-- Migration: add_last_name_to_applications
-- Adds optional lastName column to InstructorApplication and
-- ChapterPresidentApplication for capturing applicants' last name separately
-- from legalName.

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "lastName" TEXT;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "lastName" TEXT;
