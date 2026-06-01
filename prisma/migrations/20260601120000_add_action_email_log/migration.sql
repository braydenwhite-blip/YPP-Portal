-- Migration: add_action_email_log
-- People Strategy — Action Tracker automated emails (Phase: deadline emails).
-- Adds an idempotency ledger (`ActionEmailLog`) for the cron-driven Action
-- Tracker notifications (weekly digest, 24-hour warning, deadline-reached, and
-- the lead overdue notice). The unique `dedupeKey` guarantees the same
-- (type, action, recipient, deadline) email is never sent twice. Gated at
-- runtime by ENABLE_ACTION_TRACKER_EMAILS.
-- Written idempotently (IF NOT EXISTS / DO $$ guards) to match the repo's
-- migration convention.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ActionEmailType" AS ENUM ('WEEKLY_DIGEST', 'WARNING_24H', 'DEADLINE_REACHED', 'OVERDUE_LEAD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "ActionEmailLog" (
    "id" TEXT NOT NULL,
    "type" "ActionEmailType" NOT NULL,
    "actionItemId" TEXT,
    "recipientId" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionEmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ActionEmailLog_dedupeKey_key" ON "ActionEmailLog"("dedupeKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionEmailLog_recipientId_idx" ON "ActionEmailLog"("recipientId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionEmailLog_actionItemId_idx" ON "ActionEmailLog"("actionItemId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionEmailLog_type_sentAt_idx" ON "ActionEmailLog"("type", "sentAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ActionEmailLog" ADD CONSTRAINT "ActionEmailLog_actionItemId_fkey" FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ActionEmailLog" ADD CONSTRAINT "ActionEmailLog_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
