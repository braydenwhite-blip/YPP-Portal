-- Migration: meetings_operating_model
-- Adds lightweight fields that let the existing Meetings Tracker represent the
-- new YPP operating model without introducing a duplicate meeting system.

ALTER TABLE "OfficerMeeting"
  ADD COLUMN IF NOT EXISTS "meetingType" TEXT NOT NULL DEFAULT 'GENERAL_MEETING',
  ADD COLUMN IF NOT EXISTS "relatedTeam" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedChapter" TEXT,
  ADD COLUMN IF NOT EXISTS "strategicPriority" TEXT,
  ADD COLUMN IF NOT EXISTS "summaryStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "rescheduleStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "escalationStatus" TEXT;

ALTER TABLE "MeetingAttendee"
  ADD COLUMN IF NOT EXISTS "attendanceRole" TEXT NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN IF NOT EXISTS "attendanceStatus" TEXT NOT NULL DEFAULT 'REQUIRED',
  ADD COLUMN IF NOT EXISTS "responsivenessStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "attendanceNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "attendanceRecordedAt" TIMESTAMP(3);

-- Best-effort backfill: keep legacy meetings usable while giving obvious
-- operating-model meetings a type. New meetings are typed by the create flow.
UPDATE "OfficerMeeting"
SET "meetingType" = 'OFFICER_MEETING'
WHERE "meetingType" = 'GENERAL_MEETING'
  AND (
    "category" = 'LEADERSHIP'
    OR "title" ILIKE '%officer%'
    OR "title" ILIKE '%leadership sync%'
  );

UPDATE "OfficerMeeting"
SET "meetingType" = 'GLOBAL_OPERATIONS_IMPACT_PRESENTATION'
WHERE "meetingType" = 'GENERAL_MEETING'
  AND (
    "title" ILIKE '%global operations impact%'
    OR "title" ILIKE '%impact presentation%'
  );

UPDATE "OfficerMeeting"
SET "meetingType" = 'CHAPTER_IMPACT_PRESENTATION'
WHERE "meetingType" = 'GENERAL_MEETING'
  AND (
    "category" = 'CHAPTERS'
    OR "title" ILIKE '%chapter impact%'
  );

UPDATE "OfficerMeeting"
SET "meetingType" = 'MENTORSHIP_CHECK_IN'
WHERE "meetingType" = 'GENERAL_MEETING'
  AND "category" = 'MENTORSHIP';

CREATE INDEX IF NOT EXISTS "OfficerMeeting_meetingType_idx"
  ON "OfficerMeeting"("meetingType");
CREATE INDEX IF NOT EXISTS "OfficerMeeting_relatedTeam_idx"
  ON "OfficerMeeting"("relatedTeam");
CREATE INDEX IF NOT EXISTS "OfficerMeeting_relatedChapter_idx"
  ON "OfficerMeeting"("relatedChapter");
CREATE INDEX IF NOT EXISTS "MeetingAttendee_attendanceStatus_idx"
  ON "MeetingAttendee"("attendanceStatus");
