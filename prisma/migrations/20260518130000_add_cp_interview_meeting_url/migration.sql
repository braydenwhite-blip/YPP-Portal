-- Migration: add_cp_interview_meeting_url
-- Adds an optional interview meeting URL (Zoom / Google Meet join link) to
-- ChapterPresidentApplication so the chapter president interview flow can
-- surface a join link to the applicant, mirroring the instructor flow.

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "interviewMeetingUrl" TEXT;
