-- Migration: rename_cpo_to_leadership
-- People Strategy Command Center — Phase 5 (internal CPO → Leadership rename).
--
-- The user-facing "CPO" copy was already replaced with "Leadership" in Phase 1.
-- This migration finishes the job at the data layer (plan comment #1, cats a):
--   1. AdminSubtype enum value   CPO            -> LEADERSHIP
--   2. ActionEmailType enum value CPO_ESCALATION -> LEADERSHIP_ESCALATION
--   3. ActionItem column          escalatedToCpoAt -> escalatedToLeadershipAt
--      (+ its index renamed to match Prisma's generated name)
--
-- Postgres renames enum values and columns in place, so existing rows
-- (UserAdminSubtype.subtype, ActionEmailLog.type, ActionItem timestamps) are
-- preserved automatically — no backfill required. Every statement is guarded so
-- the migration is idempotent and safe to re-run.

-- 1. AdminSubtype.CPO -> LEADERSHIP -----------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AdminSubtype' AND e.enumlabel = 'CPO'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AdminSubtype' AND e.enumlabel = 'LEADERSHIP'
  ) THEN
    ALTER TYPE "AdminSubtype" RENAME VALUE 'CPO' TO 'LEADERSHIP';
  END IF;
END $$;

-- 2. ActionEmailType.CPO_ESCALATION -> LEADERSHIP_ESCALATION ----------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ActionEmailType' AND e.enumlabel = 'CPO_ESCALATION'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'ActionEmailType' AND e.enumlabel = 'LEADERSHIP_ESCALATION'
  ) THEN
    ALTER TYPE "ActionEmailType" RENAME VALUE 'CPO_ESCALATION' TO 'LEADERSHIP_ESCALATION';
  END IF;
END $$;

-- 3. ActionItem.escalatedToCpoAt -> escalatedToLeadershipAt -----------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ActionItem' AND column_name = 'escalatedToCpoAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ActionItem' AND column_name = 'escalatedToLeadershipAt'
  ) THEN
    ALTER TABLE "ActionItem" RENAME COLUMN "escalatedToCpoAt" TO "escalatedToLeadershipAt";
  END IF;
END $$;

-- 3b. Rename the index to match Prisma's generated name for the new column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ActionItem_escalatedToCpoAt_idx')
     AND NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'ActionItem_escalatedToLeadershipAt_idx') THEN
    ALTER INDEX "ActionItem_escalatedToCpoAt_idx" RENAME TO "ActionItem_escalatedToLeadershipAt_idx";
  END IF;
END $$;
