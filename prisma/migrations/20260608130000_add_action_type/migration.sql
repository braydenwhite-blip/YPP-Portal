-- Migration: add_action_type
-- People Strategy Operating System — Action Type vocabulary on Action Items.
-- `actionType` records the KIND of work an action represents (outreach,
-- follow-up, instructor onboarding, partnership, …). String-typed (no FK, no
-- Postgres enum) to mirror the loosely-typed `goalCategory` / `relatedEntityType`
-- columns and keep the vocabulary editable without a migration; validated in
-- application code (TS union + Zod). Null = untyped — existing rows are
-- unaffected and simply render no type badge.
-- Written idempotently (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS)
-- to match the repo's hand-written migration convention.

-- AlterTable
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "actionType" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionItem_actionType_idx" ON "ActionItem"("actionType");
