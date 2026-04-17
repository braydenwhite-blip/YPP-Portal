-- Add supporting document URL and optional instructor information fields
-- to ChapterPresidentApplication for the refactored application form.
ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "documentUrl"                 TEXT,
  ADD COLUMN IF NOT EXISTS "instructorApplicantPosition" TEXT,
  ADD COLUMN IF NOT EXISTS "classInMind"                 TEXT,
  ADD COLUMN IF NOT EXISTS "instructorTeachingDesc"      TEXT;

-- Add hearAboutYPP to UserProfile for family signup conversion tracking.
ALTER TABLE "UserProfile"
  ADD COLUMN IF NOT EXISTS "hearAboutYPP" TEXT;
