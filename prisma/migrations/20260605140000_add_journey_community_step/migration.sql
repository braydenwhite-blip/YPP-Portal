-- Migration: add_journey_community_step
-- Instructor Launchpad — the onboarding journey grows from four steps to five
-- by promoting the previously-persistent "Help & community" panel into a
-- first-class step (Welcome → Profile → Training → Help & Community → Tour).
--
-- This adds a single nullable completion timestamp, `communityCompletedAt`, to
-- the InstructorJourney source-of-truth row. It is additive and nullable, so
-- existing in-flight and completed journeys are unaffected: a NULL simply means
-- the new step has not been cleared yet, exactly like a fresh step.
--
-- Written idempotently (ADD COLUMN IF NOT EXISTS) to match repo convention.
--
-- ROLLBACK NOTE:
--   ALTER TABLE "InstructorJourney" DROP COLUMN IF EXISTS "communityCompletedAt";
--   (No data is lost on rollback beyond the per-step community completion mark.)

-- AddColumn
ALTER TABLE "InstructorJourney"
  ADD COLUMN IF NOT EXISTS "communityCompletedAt" TIMESTAMP(3);
