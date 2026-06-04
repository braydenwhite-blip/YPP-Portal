-- Migration: add_action_priority_status_buckets
-- People Strategy — Action Tracker, Phase 7.
-- 1. Richer status buckets: adds BLOCKED and DROPPED to ActionItemStatus.
-- 2. Priority: new ActionPriority enum + ActionItem.priority (default MEDIUM).
-- 3. completedAt: an exact completion timestamp so the Win Log / pulse / momentum
--    stop approximating with updatedAt; backfilled for existing COMPLETE rows.
-- Written idempotently to match the repo's migration convention. `ADD VALUE`
-- runs in its own statement and the new enum values are not referenced in the
-- data statements of this migration, avoiding PostgreSQL 55P04.

-- AlterEnum: richer status buckets.
ALTER TYPE "ActionItemStatus" ADD VALUE IF NOT EXISTS 'BLOCKED';
ALTER TYPE "ActionItemStatus" ADD VALUE IF NOT EXISTS 'DROPPED';

-- CreateEnum: ActionPriority (guarded; CREATE TYPE has no IF NOT EXISTS).
DO $$ BEGIN
  CREATE TYPE "ActionPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable: priority + completedAt.
ALTER TABLE "ActionItem"
  ADD COLUMN IF NOT EXISTS "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Backfill: existing COMPLETE items get a best-effort completedAt from updatedAt.
UPDATE "ActionItem"
  SET "completedAt" = "updatedAt"
  WHERE "status" = 'COMPLETE' AND "completedAt" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ActionItem_priority_idx" ON "ActionItem"("priority");
CREATE INDEX IF NOT EXISTS "ActionItem_completedAt_idx" ON "ActionItem"("completedAt");
