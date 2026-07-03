-- Mentorship Review Cycles
--
-- Adds ReviewCycle + ReviewCycleParticipant so leadership can launch a review
-- for one person or a whole cohort (all new instructors, a chapter, a
-- development lane, hand-picked people) and track everyone through the period.
-- A participant's stage (waiting on self-input → waiting on review → ready
-- for chair → released) is DERIVED at read time from the existing review
-- artifacts (MonthlySelfReflection / MentorGoalReview / QuarterlyReview) —
-- these tables never duplicate review state. Kind/status/scopeType are TEXT
-- validated in app code (lib/mentorship/cycle-constants.ts). Additive only.

CREATE TABLE IF NOT EXISTS "ReviewCycle" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'monthly',
  "periodLabel" TEXT NOT NULL,
  "scopeType" TEXT NOT NULL,
  "scopeLabel" TEXT NOT NULL,
  "scopeJson" JSONB,
  "dueDate" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdById" TEXT NOT NULL,
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReviewCycle_pkey" PRIMARY KEY ("id")
);

-- Reconcile pre-existing tables. If "ReviewCycle" was created by an earlier
-- `prisma db push` with an older shape, the CREATE TABLE IF NOT EXISTS above is
-- a no-op and the indexes/FKs below reference columns Postgres doesn't have
-- (this is what produced: ERROR 42703 column "status" does not exist). Backfill
-- every column; IF NOT EXISTS => no-op where already present. Columns that are
-- NOT NULL-without-default in the schema are added nullable here so the ALTER
-- can't fail on an already-populated table (a no-op when the column exists).
ALTER TABLE "ReviewCycle"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS "periodLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "scopeType" TEXT,
  ADD COLUMN IF NOT EXISTS "scopeLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "scopeJson" JSONB,
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "createdById" TEXT,
  ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ReviewCycle_status_createdAt_idx"
  ON "ReviewCycle"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "ReviewCycle_createdById_idx"
  ON "ReviewCycle"("createdById");

DO $$ BEGIN
  ALTER TABLE "ReviewCycle" ADD CONSTRAINT "ReviewCycle_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "ReviewCycleParticipant" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mentorshipId" TEXT,
  "stageOverride" TEXT,
  "note" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReviewCycleParticipant_pkey" PRIMARY KEY ("id")
);

-- Reconcile pre-existing "ReviewCycleParticipant" (see ReviewCycle note above).
ALTER TABLE "ReviewCycleParticipant"
  ADD COLUMN IF NOT EXISTS "cycleId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "mentorshipId" TEXT,
  ADD COLUMN IF NOT EXISTS "stageOverride" TEXT,
  ADD COLUMN IF NOT EXISTS "note" TEXT,
  ADD COLUMN IF NOT EXISTS "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewCycleParticipant_cycleId_userId_key"
  ON "ReviewCycleParticipant"("cycleId", "userId");

CREATE INDEX IF NOT EXISTS "ReviewCycleParticipant_userId_idx"
  ON "ReviewCycleParticipant"("userId");

CREATE INDEX IF NOT EXISTS "ReviewCycleParticipant_mentorshipId_idx"
  ON "ReviewCycleParticipant"("mentorshipId");

DO $$ BEGIN
  ALTER TABLE "ReviewCycleParticipant" ADD CONSTRAINT "ReviewCycleParticipant_cycleId_fkey"
    FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewCycleParticipant" ADD CONSTRAINT "ReviewCycleParticipant_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ReviewCycleParticipant" ADD CONSTRAINT "ReviewCycleParticipant_mentorshipId_fkey"
    FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
