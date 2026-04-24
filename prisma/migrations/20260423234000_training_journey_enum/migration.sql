-- Migration: training_journey_enum
-- Phase 1 of the interactive training journey rebuild.
-- Ships the `INTERACTIVE_JOURNEY` enum value ALONE in a dedicated migration.
--
-- Rationale (plan §7, §10 Phase 1): Postgres `ALTER TYPE ... ADD VALUE` cannot be
-- referenced by subsequent DDL in the same transaction as the ADD. Splitting the
-- enum change into its own migration guarantees it commits before the table
-- migration (20260423234001_training_journey_tables) attempts to use the new
-- value in default expressions or constraints.

ALTER TYPE "TrainingModuleType" ADD VALUE IF NOT EXISTS 'INTERACTIVE_JOURNEY';
