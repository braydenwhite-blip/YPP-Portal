-- Migration: mentorship_checkin_thread
-- Extends MentorshipCheckIn so a mentee's between-review progress check-in can
-- carry a mentor response and an acknowledgement timestamp, turning the dormant
-- model into a lightweight async thread between full monthly reviews.

ALTER TABLE "MentorshipCheckIn"
  ADD COLUMN IF NOT EXISTS "mentorResponse" TEXT;

ALTER TABLE "MentorshipCheckIn"
  ADD COLUMN IF NOT EXISTS "acknowledgedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MentorshipCheckIn_mentorshipId_createdAt_idx"
  ON "MentorshipCheckIn" ("mentorshipId", "createdAt");
