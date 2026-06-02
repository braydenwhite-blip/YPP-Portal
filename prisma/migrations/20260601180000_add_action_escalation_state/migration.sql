-- Migration: add_action_escalation_state
-- People Strategy — CPO escalation state on Action Items.
-- A flagged or OVERDUE item left unresolved for 48h+ is escalated to the CPO by
-- the daily escalation cron, which marks `escalatedToCpoAt` (the dedupe guard so
-- the CPO is notified exactly once). `resolvedAt` is set when the CPO resolves
-- the item from the /people Escalation Queue. `boardRolledUpAt` is reserved for
-- a later Board roll-up phase. Adds the `CPO_ESCALATION` ActionEmailType value
-- used by the escalation email ledger.
-- Written idempotently (ADD COLUMN IF NOT EXISTS / ADD VALUE IF NOT EXISTS) to
-- match the repo's migration convention. `ADD VALUE` runs in its own statement
-- and is not referenced within this migration, avoiding PostgreSQL 55P04.

-- AlterEnum
ALTER TYPE "ActionEmailType" ADD VALUE IF NOT EXISTS 'CPO_ESCALATION';

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "escalatedToCpoAt" TIMESTAMP(3);
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "boardRolledUpAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionItem_escalatedToCpoAt_idx" ON "ActionItem"("escalatedToCpoAt");
CREATE INDEX IF NOT EXISTS "ActionItem_resolvedAt_idx" ON "ActionItem"("resolvedAt");
