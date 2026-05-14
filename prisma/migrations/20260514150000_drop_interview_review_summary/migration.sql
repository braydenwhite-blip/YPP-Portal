-- Migration: drop_interview_review_summary
-- Removes the standalone "Final interview summary" field from
-- InstructorInterviewReview. The signal that used to live here is now captured
-- in per-goal category notes, per-question interviewer notes, revision
-- requirements, and applicant-facing messages, so the free-text summary is
-- redundant.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'InstructorInterviewReview'
      AND column_name = 'summary'
  ) THEN
    ALTER TABLE "InstructorInterviewReview" DROP COLUMN "summary";
  END IF;
END $$;
