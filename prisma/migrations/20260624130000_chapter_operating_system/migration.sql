-- Chapter Operating System
--
-- Turns chapters into a managed national pipeline: a lifecycle stage on every
-- chapter, guided-setup fields filled from the originating Chapter President
-- application, an optional chapter scope on ActionItem so chapter "next steps"
-- are real Action Tracker items, plus leadership-visible support requests and
-- chapter notes. Written idempotently (CREATE ... IF NOT EXISTS / DO $$ guards)
-- to match repo convention so `prisma migrate deploy` is safe to re-run.

-- 1. New enums (guarded so a re-run is a no-op).
DO $$ BEGIN
  CREATE TYPE "ChapterLifecycleStatus" AS ENUM ('PROSPECT', 'APPROVED', 'LAUNCHING', 'ACTIVE', 'NEEDS_SUPPORT', 'AT_RISK', 'PAUSED', 'ALUMNI');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ChapterSchoolType" AS ENUM ('PUBLIC', 'PRIVATE', 'CHARTER', 'HOMESCHOOL', 'COLLEGE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ChapterSupportCategory" AS ENUM ('CURRICULUM', 'INSTRUCTOR', 'PARTNER', 'RECRUITMENT', 'EVENT_PLANNING', 'SCHOOL_APPROVAL', 'GENERAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "ChapterSupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. Chapter lifecycle + guided-setup columns. Existing chapters default to
--    ACTIVE so nothing disappears from active lists.
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "lifecycleStatus" "ChapterLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "lifecycleNote" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "lifecycleUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "state" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "schoolType" "ChapterSchoolType";
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "facultyAdvisorName" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "facultyAdvisorEmail" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "foundingTeamNotes" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "recruitmentGoal" INTEGER;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "supportNeeded" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "launchTargetDate" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "expectedFirstMeetingAt" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "launchPlanText" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "launchPlanSubmittedAt" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "launchPlanApprovedAt" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "launchPlanApprovedById" TEXT;
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "launchedAt" TIMESTAMP(3);
ALTER TABLE "Chapter" ADD COLUMN IF NOT EXISTS "presidentId" TEXT;

CREATE INDEX IF NOT EXISTS "Chapter_lifecycleStatus_idx" ON "Chapter"("lifecycleStatus");
CREATE INDEX IF NOT EXISTS "Chapter_presidentId_idx" ON "Chapter"("presidentId");
CREATE INDEX IF NOT EXISTS "Chapter_state_idx" ON "Chapter"("state");

DO $$ BEGIN
  ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_presidentId_fkey"
    FOREIGN KEY ("presidentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_launchPlanApprovedById_fkey"
    FOREIGN KEY ("launchPlanApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. Optional chapter scope on ActionItem.
ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "chapterId" TEXT;
CREATE INDEX IF NOT EXISTS "ActionItem_chapterId_idx" ON "ActionItem"("chapterId");
DO $$ BEGIN
  ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 4. Chapter support requests (each also spawns a leadership ActionItem in app code).
CREATE TABLE IF NOT EXISTS "ChapterSupportRequest" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "category" "ChapterSupportCategory" NOT NULL DEFAULT 'GENERAL',
  "title" TEXT NOT NULL,
  "details" TEXT,
  "status" "ChapterSupportRequestStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
  "assignedToId" TEXT,
  "actionItemId" TEXT,
  "resolutionNote" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChapterSupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChapterSupportRequest_chapterId_status_idx" ON "ChapterSupportRequest"("chapterId", "status");
CREATE INDEX IF NOT EXISTS "ChapterSupportRequest_status_idx" ON "ChapterSupportRequest"("status");
CREATE INDEX IF NOT EXISTS "ChapterSupportRequest_assignedToId_idx" ON "ChapterSupportRequest"("assignedToId");
CREATE INDEX IF NOT EXISTS "ChapterSupportRequest_requestedById_idx" ON "ChapterSupportRequest"("requestedById");

DO $$ BEGIN
  ALTER TABLE "ChapterSupportRequest" ADD CONSTRAINT "ChapterSupportRequest_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChapterSupportRequest" ADD CONSTRAINT "ChapterSupportRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChapterSupportRequest" ADD CONSTRAINT "ChapterSupportRequest_assignedToId_fkey"
    FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChapterSupportRequest" ADD CONSTRAINT "ChapterSupportRequest_resolvedById_fkey"
    FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. Chapter notes (leadership ↔ chapter, optionally about a member).
CREATE TABLE IF NOT EXISTS "ChapterNote" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "aboutUserId" TEXT,
  "body" TEXT NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "audience" TEXT NOT NULL DEFAULT 'LEADERSHIP',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChapterNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ChapterNote_chapterId_createdAt_idx" ON "ChapterNote"("chapterId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChapterNote_aboutUserId_idx" ON "ChapterNote"("aboutUserId");

DO $$ BEGIN
  ALTER TABLE "ChapterNote" ADD CONSTRAINT "ChapterNote_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChapterNote" ADD CONSTRAINT "ChapterNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "ChapterNote" ADD CONSTRAINT "ChapterNote_aboutUserId_fkey"
    FOREIGN KEY ("aboutUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
