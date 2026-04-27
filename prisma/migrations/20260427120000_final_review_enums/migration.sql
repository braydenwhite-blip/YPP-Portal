-- Migration: final_review_enums
-- Phases 7 + 8 of the Final Review Cockpit redesign (plan §15 + §16).
--
-- Postgres restriction: `ALTER TYPE ... ADD VALUE` cannot be referenced by
-- subsequent DDL within the same transaction as the ADD. We therefore split
-- the enum extensions into their own migration so the table migration that
-- follows (20260427120001_final_review_tables) can use the new enum values
-- in defaults, columns, and indexes safely.
--
-- Adds:
--   * ChairDecisionAction.APPROVE_WITH_CONDITIONS   (Phase 8 §16, dock)
--   * ChairDecisionAction.WAITLIST                  (Phase 8 §16, dock)
--   * InstructorApplicationStatus.WAITLISTED        (Phase 8 §16, status map)
--   * ReviewSignalKind                              (Phase 7 §15, new enum)
--   * ReviewSignalSentiment                         (Phase 7 §15, new enum)

ALTER TYPE "ChairDecisionAction" ADD VALUE IF NOT EXISTS 'APPROVE_WITH_CONDITIONS';
ALTER TYPE "ChairDecisionAction" ADD VALUE IF NOT EXISTS 'WAITLIST';

ALTER TYPE "InstructorApplicationStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';

DO $$ BEGIN
  CREATE TYPE "ReviewSignalKind" AS ENUM (
    'COMMENT',
    'PIN_NOTE',
    'HIGHLIGHT',
    'CONCERN',
    'CONSENSUS_NOTE'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReviewSignalSentiment" AS ENUM (
    'STRONG_HIRE',
    'HIRE',
    'MIXED',
    'CONCERN',
    'REJECT'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
