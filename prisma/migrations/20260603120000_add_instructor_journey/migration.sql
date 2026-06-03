-- Migration: add_instructor_journey
-- Instructor Launchpad — unify the instructor onboarding journey into a single
-- source-of-truth row (`InstructorJourney`). The 4-step launchpad (Welcome,
-- Profile, Training, Portal tour) reads/writes this table; the onboarding
-- percentage is derived from the per-step completion timestamps. Training's
-- authoritative module-by-module percent still lives in the readiness/training
-- models — this table only mirrors the "training step cleared" milestone.
--
-- Backfill: every existing INSTRUCTOR (by primaryRole or a role row) that has an
-- OnboardingProgress record is seeded into InstructorJourney so in-flight
-- instructors keep their progress. The mapping is:
--   OnboardingProgress.completedAt      -> InstructorJourney.completedAt
--                                          + welcome/profile/training/tour all
--                                            marked complete (a finished legacy
--                                            wizard means the whole journey is done)
--   OnboardingProgress.profileCompleted -> InstructorJourney.profileCompletedAt
--                                          (and welcome implied complete)
--   currentStep is clamped into the new 0..3 launchpad range.
--
-- Written idempotently (IF NOT EXISTS / DO $$ guards) to match repo convention.
--
-- ROLLBACK NOTE:
--   DROP TABLE IF EXISTS "InstructorJourney";
--   (No columns were added to existing tables, so dropping this table fully
--    reverts the migration. OnboardingProgress is left untouched and still
--    holds the legacy state, so a rollback loses no data.)

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstructorJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "welcomeCompletedAt" TIMESTAMP(3),
    "profileCompletedAt" TIMESTAMP(3),
    "trainingCompletedAt" TIMESTAMP(3),
    "tourCompletedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorJourney_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InstructorJourney_userId_key" ON "InstructorJourney"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstructorJourney_completedAt_idx" ON "InstructorJourney"("completedAt");

-- AddForeignKey: InstructorJourney -> User
DO $$ BEGIN
  ALTER TABLE "InstructorJourney" ADD CONSTRAINT "InstructorJourney_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Backfill in-flight instructors from the legacy OnboardingProgress table.
INSERT INTO "InstructorJourney" (
    "id", "userId", "currentStep",
    "welcomeCompletedAt", "profileCompletedAt", "trainingCompletedAt", "tourCompletedAt",
    "completedAt", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text AS "id",
    op."userId",
    LEAST(GREATEST(op."currentStep", 0), 3) AS "currentStep",
    -- A profile-complete or finished legacy wizard implies the welcome step was seen.
    CASE WHEN op."completedAt" IS NOT NULL OR op."profileCompleted" THEN op."updatedAt" ELSE NULL END AS "welcomeCompletedAt",
    CASE WHEN op."completedAt" IS NOT NULL OR op."profileCompleted" THEN op."updatedAt" ELSE NULL END AS "profileCompletedAt",
    CASE WHEN op."completedAt" IS NOT NULL THEN op."completedAt" ELSE NULL END AS "trainingCompletedAt",
    CASE WHEN op."completedAt" IS NOT NULL THEN op."completedAt" ELSE NULL END AS "tourCompletedAt",
    op."completedAt",
    op."createdAt",
    op."updatedAt"
FROM "OnboardingProgress" op
JOIN "User" u ON u."id" = op."userId"
WHERE (
    u."primaryRole" = 'INSTRUCTOR'
    OR EXISTS (
        SELECT 1 FROM "UserRole" ur
        WHERE ur."userId" = u."id" AND ur."role" = 'INSTRUCTOR'
    )
)
ON CONFLICT ("userId") DO NOTHING;
