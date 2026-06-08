-- Migration: add_growth_os_n1
-- Student Operating System / Growth Engine (Action Tracker 3.0, Phase N1).
--
-- Adds the unified progression engine: the Vision -> Goal -> Milestone -> Action
-- hierarchy (GrowthVision/GrowthGoal/GrowthMilestone/GrowthAction), the
-- development-focused GrowthProfile, the first-class GrowthAchievement registry
-- awards, the deterministic GrowthOpportunity recommendations (the `reason`
-- column is the WHY shown to the student), and the GrowthProgressEvent log that
-- future systems emit into.
--
-- Two stable Postgres enums (GrowthTrack, GrowthObjectiveStatus) model the
-- progression track and objective lifecycle. The richer leaf-action status and
-- the achievement category / opportunity kind / event type vocabularies are
-- TEXT validated in application code (lib/growth/constants.ts), mirroring the
-- repo's actionType / partner.stage convention so they stay editable without a
-- migration.
--
-- Purely additive: new tables + two new enums; the only relationship to existing
-- tables is the User back-relations, which are virtual Prisma relations (the FK
-- columns live on the new Growth* tables, not on User). Every column is
-- nullable/defaulted so existing rows are unaffected, and the runtime stays dark
-- behind ENABLE_GROWTH_OS. Written idempotently (CREATE TABLE / INDEX IF NOT
-- EXISTS, DO-guarded enums + foreign keys) so the whole migration is re-runnable.

-- CreateEnum: GrowthTrack
DO $$
BEGIN
  CREATE TYPE "GrowthTrack" AS ENUM (
    'STUDENT',
    'MENTORSHIP',
    'INSTRUCTOR',
    'LEADERSHIP',
    'CHAPTER',
    'HIRING',
    'ALUMNI'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateEnum: GrowthObjectiveStatus
DO $$
BEGIN
  CREATE TYPE "GrowthObjectiveStatus" AS ENUM (
    'ACTIVE',
    'ACHIEVED',
    'ARCHIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable: GrowthProfile (1:1 User — development, not demographics)
CREATE TABLE IF NOT EXISTS "GrowthProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT,
    "careerInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "leadershipInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "impactInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "confidenceAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "growthAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "achievementCount" INTEGER NOT NULL DEFAULT 0,
    "completedExperiences" INTEGER NOT NULL DEFAULT 0,
    "lastEventAt" TIMESTAMP(3),
    "lastRecomputedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GrowthProfile_userId_key" ON "GrowthProfile"("userId");

-- CreateTable: GrowthVision (top-level "who I'm becoming")
CREATE TABLE IF NOT EXISTS "GrowthVision" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "track" "GrowthTrack" NOT NULL DEFAULT 'STUDENT',
    "status" "GrowthObjectiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthVision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GrowthVision_userId_status_idx" ON "GrowthVision"("userId", "status");

-- CreateTable: GrowthGoal (a measurable outcome; can stand alone or under a Vision)
CREATE TABLE IF NOT EXISTS "GrowthGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "visionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "track" "GrowthTrack" NOT NULL DEFAULT 'STUDENT',
    "status" "GrowthObjectiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "targetDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthGoal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GrowthGoal_userId_status_idx" ON "GrowthGoal"("userId", "status");
CREATE INDEX IF NOT EXISTS "GrowthGoal_visionId_idx" ON "GrowthGoal"("visionId");
CREATE INDEX IF NOT EXISTS "GrowthGoal_source_sourceRef_idx" ON "GrowthGoal"("source", "sourceRef");

-- CreateTable: GrowthMilestone (a checkpoint under a Goal)
CREATE TABLE IF NOT EXISTS "GrowthMilestone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "GrowthObjectiveStatus" NOT NULL DEFAULT 'ACTIVE',
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthMilestone_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GrowthMilestone_userId_status_idx" ON "GrowthMilestone"("userId", "status");
CREATE INDEX IF NOT EXISTS "GrowthMilestone_goalId_idx" ON "GrowthMilestone"("goalId");

-- CreateTable: GrowthAction (the leaf; status is a TEXT vocabulary)
CREATE TABLE IF NOT EXISTS "GrowthAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "goalId" TEXT,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "order" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GrowthAction_userId_status_idx" ON "GrowthAction"("userId", "status");
CREATE INDEX IF NOT EXISTS "GrowthAction_goalId_idx" ON "GrowthAction"("goalId");
CREATE INDEX IF NOT EXISTS "GrowthAction_milestoneId_idx" ON "GrowthAction"("milestoneId");

-- CreateTable: GrowthProgressEvent (the event log future systems emit into)
CREATE TABLE IF NOT EXISTS "GrowthProgressEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "track" "GrowthTrack" NOT NULL DEFAULT 'STUDENT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dedupeKey" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthProgressEvent_pkey" PRIMARY KEY ("id")
);
-- Idempotent emission: (userId, dedupeKey) unique. Null dedupeKeys always insert
-- (Postgres treats NULLs as distinct), matching InstructorGrowthEvent's pattern.
CREATE UNIQUE INDEX IF NOT EXISTS "GrowthProgressEvent_userId_dedupeKey_key" ON "GrowthProgressEvent"("userId", "dedupeKey");
CREATE INDEX IF NOT EXISTS "GrowthProgressEvent_userId_occurredAt_idx" ON "GrowthProgressEvent"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "GrowthProgressEvent_type_idx" ON "GrowthProgressEvent"("type");

-- CreateTable: GrowthAchievement (first-class earned achievement; idempotent)
CREATE TABLE IF NOT EXISTS "GrowthAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "sourceEventId" TEXT,
    "metadata" JSONB,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthAchievement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GrowthAchievement_userId_key_key" ON "GrowthAchievement"("userId", "key");
CREATE INDEX IF NOT EXISTS "GrowthAchievement_userId_earnedAt_idx" ON "GrowthAchievement"("userId", "earnedAt");
CREATE INDEX IF NOT EXISTS "GrowthAchievement_category_idx" ON "GrowthAchievement"("category");

-- CreateTable: GrowthOpportunity (deterministic recommendation; `reason` = WHY)
CREATE TABLE IF NOT EXISTS "GrowthOpportunity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "href" TEXT,
    "reason" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "metadata" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GrowthOpportunity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GrowthOpportunity_userId_key_key" ON "GrowthOpportunity"("userId", "key");
CREATE INDEX IF NOT EXISTS "GrowthOpportunity_userId_status_idx" ON "GrowthOpportunity"("userId", "status");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS).
-- All FKs added after every table exists, so creation order is irrelevant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthProfile_userId_fkey') THEN
    ALTER TABLE "GrowthProfile" ADD CONSTRAINT "GrowthProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthVision_userId_fkey') THEN
    ALTER TABLE "GrowthVision" ADD CONSTRAINT "GrowthVision_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthGoal_userId_fkey') THEN
    ALTER TABLE "GrowthGoal" ADD CONSTRAINT "GrowthGoal_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthGoal_visionId_fkey') THEN
    ALTER TABLE "GrowthGoal" ADD CONSTRAINT "GrowthGoal_visionId_fkey"
      FOREIGN KEY ("visionId") REFERENCES "GrowthVision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthMilestone_userId_fkey') THEN
    ALTER TABLE "GrowthMilestone" ADD CONSTRAINT "GrowthMilestone_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthMilestone_goalId_fkey') THEN
    ALTER TABLE "GrowthMilestone" ADD CONSTRAINT "GrowthMilestone_goalId_fkey"
      FOREIGN KEY ("goalId") REFERENCES "GrowthGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthAction_userId_fkey') THEN
    ALTER TABLE "GrowthAction" ADD CONSTRAINT "GrowthAction_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthAction_goalId_fkey') THEN
    ALTER TABLE "GrowthAction" ADD CONSTRAINT "GrowthAction_goalId_fkey"
      FOREIGN KEY ("goalId") REFERENCES "GrowthGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthAction_milestoneId_fkey') THEN
    ALTER TABLE "GrowthAction" ADD CONSTRAINT "GrowthAction_milestoneId_fkey"
      FOREIGN KEY ("milestoneId") REFERENCES "GrowthMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthAchievement_userId_fkey') THEN
    ALTER TABLE "GrowthAchievement" ADD CONSTRAINT "GrowthAchievement_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthAchievement_sourceEventId_fkey') THEN
    ALTER TABLE "GrowthAchievement" ADD CONSTRAINT "GrowthAchievement_sourceEventId_fkey"
      FOREIGN KEY ("sourceEventId") REFERENCES "GrowthProgressEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthOpportunity_userId_fkey') THEN
    ALTER TABLE "GrowthOpportunity" ADD CONSTRAINT "GrowthOpportunity_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GrowthProgressEvent_userId_fkey') THEN
    ALTER TABLE "GrowthProgressEvent" ADD CONSTRAINT "GrowthProgressEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
