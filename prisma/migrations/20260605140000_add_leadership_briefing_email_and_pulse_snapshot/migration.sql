-- Migration: add_leadership_briefing_email_and_pulse_snapshot
-- People Strategy — Action Tracker, Phases 6 & 7.
-- Phase 6 (Digest delivery): a LEADERSHIP_BRIEFING email type so the
--   auto-delivered weekly Leadership Briefing is logged in the ActionEmailLog
--   idempotency ledger (one briefing per recipient per week).
-- Phase 7 (Trends): ActionPulseSnapshot — one row per operating week storing the
--   leadership-wide Command Center pulse, so the briefing can report
--   week-over-week movement without reconstructing historical state.
-- Written idempotently to match the repo's migration convention. The new enum
-- value runs in its own statement and is not referenced in this migration's data
-- statements, avoiding PostgreSQL 55P04.

-- AlterEnum: add the briefing email type.
ALTER TYPE "ActionEmailType" ADD VALUE IF NOT EXISTS 'LEADERSHIP_BRIEFING';

-- CreateTable: ActionPulseSnapshot (one per operating week).
CREATE TABLE IF NOT EXISTS "ActionPulseSnapshot" (
  "id"                TEXT NOT NULL,
  "weekStart"         TIMESTAMP(3) NOT NULL,
  "openTotal"         INTEGER NOT NULL,
  "completedThisWeek" INTEGER NOT NULL,
  "overdue"           INTEGER NOT NULL,
  "flagged"           INTEGER NOT NULL,
  "blocked"           INTEGER NOT NULL,
  "dueThisWeek"       INTEGER NOT NULL,
  "unowned"           INTEGER NOT NULL,
  "consideredCount"   INTEGER NOT NULL,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ActionPulseSnapshot_pkey" PRIMARY KEY ("id")
);

-- Unique per operating week so the weekly cron upserts exactly one row, even on
-- retries / overlapping runs.
CREATE UNIQUE INDEX IF NOT EXISTS "ActionPulseSnapshot_weekStart_key" ON "ActionPulseSnapshot"("weekStart");
