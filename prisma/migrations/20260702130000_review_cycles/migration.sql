-- Leadership Development — Review Cycles.
-- The orchestration layer for running an instructor/officer review end to end:
-- self-input + contributor feedback collection, reviewer synthesis, action
-- plan, and follow-up. Additive only; idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewCycleType') THEN
    CREATE TYPE "ReviewCycleType" AS ENUM (
      'INSTRUCTOR',
      'OFFICER'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewCycleState') THEN
    CREATE TYPE "ReviewCycleState" AS ENUM (
      'DRAFT',
      'COLLECTING',
      'ACTION_PLAN',
      'FOLLOW_UP',
      'COMPLETED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ReviewCycle" (
  "id" TEXT NOT NULL,
  "revieweeId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "type" "ReviewCycleType" NOT NULL,
  "roleLabel" TEXT,
  "chapterId" TEXT,
  "teamId" TEXT,
  "classOfferingId" TEXT,
  "state" "ReviewCycleState" NOT NULL DEFAULT 'DRAFT',
  "dueDate" TIMESTAMP(3),
  "selfInputSubmittedAt" TIMESTAMP(3),
  "selfWentWell" TEXT,
  "selfWasHard" TEXT,
  "selfImproved" TEXT,
  "selfSupportNeeded" TEXT,
  "selfGoals" TEXT,
  "selfNextResponsibility" TEXT,
  "selfLeadershipNote" TEXT,
  "synthesisSubmittedAt" TIMESTAMP(3),
  "strengths" TEXT,
  "growthAreas" TEXT,
  "concerns" TEXT,
  "coachingNotes" TEXT,
  "recommendedNextStep" TEXT,
  "recognitionFlag" BOOLEAN NOT NULL DEFAULT false,
  "leadershipFlag" BOOLEAN NOT NULL DEFAULT false,
  "followUpDueAt" TIMESTAMP(3),
  "followUpNote" TEXT,
  "releasedToRevieweeAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReviewCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewCycleFeedback" (
  "id" TEXT NOT NULL,
  "cycleId" TEXT NOT NULL,
  "contributorId" TEXT NOT NULL,
  "requestedById" TEXT,
  "reason" TEXT,
  "dueAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "doingWell" TEXT,
  "needsSupport" TEXT,
  "concerns" TEXT,
  "examples" TEXT,
  "suggestedNextStep" TEXT,
  "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "flagForLeadership" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReviewCycleFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReviewCycle_revieweeId_state_idx" ON "ReviewCycle"("revieweeId", "state");
CREATE INDEX IF NOT EXISTS "ReviewCycle_reviewerId_state_idx" ON "ReviewCycle"("reviewerId", "state");
CREATE INDEX IF NOT EXISTS "ReviewCycle_state_dueDate_idx" ON "ReviewCycle"("state", "dueDate");
CREATE INDEX IF NOT EXISTS "ReviewCycle_chapterId_idx" ON "ReviewCycle"("chapterId");
CREATE INDEX IF NOT EXISTS "ReviewCycle_teamId_idx" ON "ReviewCycle"("teamId");
CREATE INDEX IF NOT EXISTS "ReviewCycle_classOfferingId_idx" ON "ReviewCycle"("classOfferingId");

CREATE UNIQUE INDEX IF NOT EXISTS "ReviewCycleFeedback_cycleId_contributorId_key" ON "ReviewCycleFeedback"("cycleId", "contributorId");
CREATE INDEX IF NOT EXISTS "ReviewCycleFeedback_contributorId_submittedAt_idx" ON "ReviewCycleFeedback"("contributorId", "submittedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycle_revieweeId_fkey'
  ) THEN
    ALTER TABLE "ReviewCycle"
      ADD CONSTRAINT "ReviewCycle_revieweeId_fkey"
      FOREIGN KEY ("revieweeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycle_reviewerId_fkey'
  ) THEN
    ALTER TABLE "ReviewCycle"
      ADD CONSTRAINT "ReviewCycle_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycle_createdById_fkey'
  ) THEN
    ALTER TABLE "ReviewCycle"
      ADD CONSTRAINT "ReviewCycle_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycle_chapterId_fkey'
  ) THEN
    ALTER TABLE "ReviewCycle"
      ADD CONSTRAINT "ReviewCycle_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycle_teamId_fkey'
  ) THEN
    ALTER TABLE "ReviewCycle"
      ADD CONSTRAINT "ReviewCycle_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycle_classOfferingId_fkey'
  ) THEN
    ALTER TABLE "ReviewCycle"
      ADD CONSTRAINT "ReviewCycle_classOfferingId_fkey"
      FOREIGN KEY ("classOfferingId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycleFeedback_cycleId_fkey'
  ) THEN
    ALTER TABLE "ReviewCycleFeedback"
      ADD CONSTRAINT "ReviewCycleFeedback_cycleId_fkey"
      FOREIGN KEY ("cycleId") REFERENCES "ReviewCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycleFeedback_contributorId_fkey'
  ) THEN
    ALTER TABLE "ReviewCycleFeedback"
      ADD CONSTRAINT "ReviewCycleFeedback_contributorId_fkey"
      FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ReviewCycleFeedback_requestedById_fkey'
  ) THEN
    ALTER TABLE "ReviewCycleFeedback"
      ADD CONSTRAINT "ReviewCycleFeedback_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
