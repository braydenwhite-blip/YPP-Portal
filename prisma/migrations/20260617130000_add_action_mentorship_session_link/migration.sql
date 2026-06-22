-- Migration: add_action_mentorship_session_link
-- Mentorship Unification Phase 1: preserve which mentorship check-in created a
-- canonical Action Tracker next step. Mentorship meetings remain
-- MentorshipSession records; this only adds nullable provenance to ActionItem.
--
-- Additive, nullable, and idempotent. No legacy mentorship action rows are
-- modified here; the operator backfill script handles data migration later.

ALTER TABLE "ActionItem"
  ADD COLUMN IF NOT EXISTS "mentorshipSessionId" TEXT;

CREATE INDEX IF NOT EXISTS "ActionItem_mentorshipSessionId_idx"
  ON "ActionItem"("mentorshipSessionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ActionItem_mentorshipSessionId_fkey'
  ) THEN
    ALTER TABLE "ActionItem"
      ADD CONSTRAINT "ActionItem_mentorshipSessionId_fkey"
      FOREIGN KEY ("mentorshipSessionId") REFERENCES "MentorshipSession"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
