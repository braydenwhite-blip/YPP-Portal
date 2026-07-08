-- Migration: add_action_item_source_review
-- Finish Mentorship: link follow-up commitments to the review they came from.
--
-- Adds MentorshipActionItem.sourceReviewId → MentorGoalReview. A released
-- monthly review can now spawn owned, due-dated follow-up action items, and
-- the Reviews section can answer "what came out of this review". Purely
-- additive (one nullable column + index + guarded FK); no backfill needed —
-- existing rows simply have no source review. Written idempotently to match
-- the repo's hand-written migration convention.

ALTER TABLE "MentorshipActionItem" ADD COLUMN IF NOT EXISTS "sourceReviewId" TEXT;

CREATE INDEX IF NOT EXISTS "MentorshipActionItem_sourceReviewId_idx"
  ON "MentorshipActionItem"("sourceReviewId");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipActionItem_sourceReviewId_fkey'
  ) THEN
    ALTER TABLE "MentorshipActionItem"
      ADD CONSTRAINT "MentorshipActionItem_sourceReviewId_fkey"
      FOREIGN KEY ("sourceReviewId") REFERENCES "MentorGoalReview"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
