-- Migration: add_board_rollup
-- People Strategy — Board roll-up for CPO-escalated, unresolved action items.
-- A CPO-escalated item that stays unresolved 7 days past `escalatedToCpoAt` is
-- rolled up to the Board: the daily escalation cron marks `boardRolledUpAt`
-- (already on ActionItem from 20260601180000), records an authorless system
-- audit comment, and notifies Board recipients. This migration:
--   1. Adds the `BOARD_ROLLUP` ActionEmailType value (used by the dedupe ledger).
--   2. Makes `ActionComment.authorId` nullable so system/automated audit entries
--      (no human actor) can be recorded — human comments still carry an author.
-- Written idempotently to match the repo's migration convention. `ADD VALUE`
-- runs in its own statement and is not referenced here, avoiding 55P04.

-- AlterEnum
ALTER TYPE "ActionEmailType" ADD VALUE IF NOT EXISTS 'BOARD_ROLLUP';

-- AlterTable: allow authorless (system) action comments.
ALTER TABLE "ActionComment" ALTER COLUMN "authorId" DROP NOT NULL;
