-- Migration: gr_polish
-- Adds nextMonthGoalDraftsJson to MentorGoalReview,
-- and new MilestoneEvent + MenteeReviewAck tables.

-- Add draft next-month goals column to MentorGoalReview
ALTER TABLE "MentorGoalReview"
  ADD COLUMN IF NOT EXISTS "nextMonthGoalDraftsJson" JSONB;

-- MilestoneEvent table
CREATE TABLE IF NOT EXISTS "MilestoneEvent" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "kind"      TEXT NOT NULL,
  "payload"   JSONB NOT NULL DEFAULT '{}',
  "seenAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MilestoneEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MilestoneEvent_userId_seenAt_idx"
  ON "MilestoneEvent"("userId", "seenAt");

-- MenteeReviewAck table
CREATE TABLE IF NOT EXISTS "MenteeReviewAck" (
  "id"        TEXT NOT NULL,
  "reviewId"  TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "reaction"  TEXT NOT NULL,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MenteeReviewAck_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MenteeReviewAck_reviewId_key" UNIQUE ("reviewId")
);

CREATE INDEX IF NOT EXISTS "MenteeReviewAck_userId_idx"
  ON "MenteeReviewAck"("userId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MenteeReviewAck_reviewId_fkey'
  ) THEN
    ALTER TABLE "MenteeReviewAck"
      ADD CONSTRAINT "MenteeReviewAck_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "MentorGoalReview"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
