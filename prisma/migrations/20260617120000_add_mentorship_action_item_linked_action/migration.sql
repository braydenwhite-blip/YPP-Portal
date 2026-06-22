-- Migration: add_mentorship_action_item_linked_action
-- Calm Mentorship (Phase 7): adds an optional back-link from an in-relationship
-- commitment (MentorshipActionItem) to the org-wide Action (ActionItem) it was
-- bridged into. This makes the "convert commitment to Action" one-click
-- idempotent — a repeat convert is a no-op instead of creating a duplicate.
--
-- Additive, nullable, backfill-free. No foreign key: the org ActionItem already
-- links back via relatedEntityType:"MENTORSHIP", and the read path tolerates a
-- stale id (a dropped Action simply reads as "unlinked", allowing a fresh
-- convert). Index supports the idempotency lookup.

ALTER TABLE "MentorshipActionItem"
  ADD COLUMN IF NOT EXISTS "linkedActionId" TEXT;

CREATE INDEX IF NOT EXISTS "MentorshipActionItem_linkedActionId_idx"
  ON "MentorshipActionItem" ("linkedActionId");
