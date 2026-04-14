-- Track whether a mentor used an AI-generated draft when writing a goal review.
-- Used for quality auditing and adoption reporting.

ALTER TABLE "MentorGoalReview"
  ADD COLUMN IF NOT EXISTS "aiDraftUsed" BOOLEAN NOT NULL DEFAULT false;
