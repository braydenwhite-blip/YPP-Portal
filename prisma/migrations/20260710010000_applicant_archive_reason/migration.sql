-- Applicant archive reason + inactivity nudge stage (instructor + CP).
-- Idempotent: safe to re-run.

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "inactivityNudgeStage" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "archiveReason" TEXT;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "inactivityNudgeStage" INTEGER NOT NULL DEFAULT 0;
