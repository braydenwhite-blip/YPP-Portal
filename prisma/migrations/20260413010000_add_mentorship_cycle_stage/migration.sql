-- Phase 0.9: Denormalized MentorshipCycleStage + new NotificationType values

-- CreateEnum MentorshipCycleStage (idempotent guard)
DO $$ BEGIN
  CREATE TYPE "MentorshipCycleStage" AS ENUM (
    'KICKOFF_PENDING',
    'REFLECTION_DUE',
    'REFLECTION_SUBMITTED',
    'REVIEW_SUBMITTED',
    'CHANGES_REQUESTED',
    'APPROVED',
    'PAUSED',
    'COMPLETE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Mentorship
ALTER TABLE "Mentorship"
  ADD COLUMN IF NOT EXISTS "cycleStage" "MentorshipCycleStage" NOT NULL DEFAULT 'REFLECTION_DUE';

-- CreateIndex for Kanban column queries
CREATE INDEX IF NOT EXISTS "Mentorship_cycleStage_status_idx" ON "Mentorship" ("cycleStage", "status");

-- AlterEnum NotificationType — add 4 cycle-milestone values (idempotent guards)
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'REFLECTION_WINDOW_OPENED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'REFLECTION_SUBMITTED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_SUBMITTED_FOR_APPROVAL';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE 'REVIEW_APPROVED_AND_RELEASED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Backfill cycleStage for existing active mentorships.
-- Logic:
--   PAUSED  -> PAUSED
--   COMPLETE -> COMPLETE
--   kickoffCompletedAt IS NULL -> KICKOFF_PENDING
--   Otherwise: derive from latest MentorGoalReview (if any) else REFLECTION_DUE.
UPDATE "Mentorship" m
SET "cycleStage" = 'PAUSED'
WHERE m."status" = 'PAUSED';

UPDATE "Mentorship" m
SET "cycleStage" = 'COMPLETE'
WHERE m."status" = 'COMPLETE';

UPDATE "Mentorship" m
SET "cycleStage" = 'KICKOFF_PENDING'
WHERE m."status" = 'ACTIVE' AND m."kickoffCompletedAt" IS NULL;

-- APPROVED: latest review on this mentorship is APPROVED and released
UPDATE "Mentorship" m
SET "cycleStage" = 'APPROVED'
WHERE m."status" = 'ACTIVE'
  AND m."kickoffCompletedAt" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "MentorGoalReview" r
    WHERE r."mentorshipId" = m."id"
      AND r."status" = 'APPROVED'
      AND r."releasedToMenteeAt" IS NOT NULL
      AND r."createdAt" = (
        SELECT MAX(r2."createdAt") FROM "MentorGoalReview" r2 WHERE r2."mentorshipId" = m."id"
      )
  );

-- CHANGES_REQUESTED
UPDATE "Mentorship" m
SET "cycleStage" = 'CHANGES_REQUESTED'
WHERE m."status" = 'ACTIVE'
  AND m."kickoffCompletedAt" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "MentorGoalReview" r
    WHERE r."mentorshipId" = m."id"
      AND r."status" = 'CHANGES_REQUESTED'
      AND r."createdAt" = (
        SELECT MAX(r2."createdAt") FROM "MentorGoalReview" r2 WHERE r2."mentorshipId" = m."id"
      )
  );

-- REVIEW_SUBMITTED: pending chair approval
UPDATE "Mentorship" m
SET "cycleStage" = 'REVIEW_SUBMITTED'
WHERE m."status" = 'ACTIVE'
  AND m."kickoffCompletedAt" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "MentorGoalReview" r
    WHERE r."mentorshipId" = m."id"
      AND r."status" = 'PENDING_CHAIR_APPROVAL'
      AND r."createdAt" = (
        SELECT MAX(r2."createdAt") FROM "MentorGoalReview" r2 WHERE r2."mentorshipId" = m."id"
      )
  );

-- REFLECTION_SUBMITTED: a reflection exists without a corresponding review
UPDATE "Mentorship" m
SET "cycleStage" = 'REFLECTION_SUBMITTED'
WHERE m."status" = 'ACTIVE'
  AND m."kickoffCompletedAt" IS NOT NULL
  AND m."cycleStage" = 'REFLECTION_DUE'
  AND EXISTS (
    SELECT 1 FROM "MonthlySelfReflection" s
    WHERE s."mentorshipId" = m."id"
      AND NOT EXISTS (
        SELECT 1 FROM "MentorGoalReview" r WHERE r."mentorshipId" = m."id" AND r."cycleNumber" = s."cycleNumber"
      )
  );
