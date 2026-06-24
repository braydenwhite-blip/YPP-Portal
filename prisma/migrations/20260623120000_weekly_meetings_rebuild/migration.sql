-- Migration: weekly_meetings_rebuild
--
-- Fully retires the old Weekly Team Briefs + Officer Meeting cluster (code + DB
-- tables) and replaces it with a fresh, admin-configurable Teams + Weekly Impact
-- + unified Meeting Runner system.
--
-- DESTRUCTIVE: drops the old meeting/weekly-impact tables and their data. The
-- Leadership Action Center (LeadershipMeeting) and Department are SEPARATE and
-- are intentionally left untouched.

-- 1. Drop the ActionItem → OfficerMeeting coupling (column + its FK via CASCADE).
ALTER TABLE "ActionItem" DROP COLUMN IF EXISTS "officerMeetingId";

-- 2. Drop the old tables. CASCADE clears FKs, back-relations, and dependent
--    indexes in one step regardless of drop order.
DROP TABLE IF EXISTS "MiscUpdate" CASCADE;
DROP TABLE IF EXISTS "MeetingNote" CASCADE;
DROP TABLE IF EXISTS "MeetingFollowUp" CASCADE;
DROP TABLE IF EXISTS "MeetingDecision" CASCADE;
DROP TABLE IF EXISTS "MeetingAgendaItem" CASCADE;
DROP TABLE IF EXISTS "MeetingAttendee" CASCADE;
DROP TABLE IF EXISTS "PreparedPresentationItem" CASCADE;
DROP TABLE IF EXISTS "TeamPresentationExpectation" CASCADE;
DROP TABLE IF EXISTS "WeeklyImpactInputRequest" CASCADE;
DROP TABLE IF EXISTS "WeeklyImpactNextStep" CASCADE;
DROP TABLE IF EXISTS "WeeklyImpactObjective" CASCADE;
DROP TABLE IF EXISTS "WeeklyTaskUpdate" CASCADE;
DROP TABLE IF EXISTS "WeeklyMemberUpdate" CASCADE;
DROP TABLE IF EXISTS "TeamMeeting" CASCADE;
DROP TABLE IF EXISTS "WeeklyTeamBrief" CASCADE;
DROP TABLE IF EXISTS "OfficerMeeting" CASCADE;

-- 3. Drop the old enums (after their tables are gone).
DROP TYPE IF EXISTS "WeeklyBriefStatus";
DROP TYPE IF EXISTS "TeamMeetingStatus";
DROP TYPE IF EXISTS "PreparedPresentationStatus";
DROP TYPE IF EXISTS "PresentationExpectationKind";
DROP TYPE IF EXISTS "PresentationExpectationStatus";
DROP TYPE IF EXISTS "AgendaItemKind";
DROP TYPE IF EXISTS "OfficerMeetingStatus";
DROP TYPE IF EXISTS "MeetingAgendaStatus";
DROP TYPE IF EXISTS "MeetingFollowUpStatus";

-- 4. Create the new enums (guarded so re-runs are idempotent).
DO $$ BEGIN CREATE TYPE "TeamStatus" AS ENUM ('ACTIVE', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MeetingType" AS ENUM ('OFFICER', 'WEEKLY_TEAM_IMPACT', 'CHAPTER_IMPACT', 'GENERIC'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "MeetingStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "WeeklyImpactStatus" AS ENUM ('DRAFT', 'SUBMITTED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "WeeklyImpactRowStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'DONE'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "OfficerTopicStatus" AS ENUM ('OPEN', 'DISCUSSED', 'DECIDED', 'DEFERRED'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "WeeklyFollowUpStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 5. Create the new tables + indexes.
CREATE TABLE IF NOT EXISTS "Team" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "status" "TeamStatus" NOT NULL DEFAULT 'ACTIVE',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Team_slug_key" ON "Team"("slug");
CREATE INDEX IF NOT EXISTS "Team_status_sortOrder_idx" ON "Team"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "Team_createdById_idx" ON "Team"("createdById");

CREATE TABLE IF NOT EXISTS "TeamMembership" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "isLead" BOOLEAN NOT NULL DEFAULT false,
  "role" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMembership_teamId_userId_key" ON "TeamMembership"("teamId", "userId");
CREATE INDEX IF NOT EXISTS "TeamMembership_teamId_idx" ON "TeamMembership"("teamId");
CREATE INDEX IF NOT EXISTS "TeamMembership_userId_idx" ON "TeamMembership"("userId");

CREATE TABLE IF NOT EXISTS "Meeting" (
  "id" TEXT NOT NULL,
  "type" "MeetingType" NOT NULL DEFAULT 'GENERIC',
  "status" "MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
  "title" TEXT NOT NULL,
  "purpose" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3),
  "location" TEXT,
  "notes" TEXT,
  "facilitatorId" TEXT,
  "chapterId" TEXT,
  "teamId" TEXT,
  "weekStart" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Meeting_type_status_idx" ON "Meeting"("type", "status");
CREATE INDEX IF NOT EXISTS "Meeting_scheduledAt_idx" ON "Meeting"("scheduledAt");
CREATE INDEX IF NOT EXISTS "Meeting_chapterId_idx" ON "Meeting"("chapterId");
CREATE INDEX IF NOT EXISTS "Meeting_teamId_idx" ON "Meeting"("teamId");
CREATE INDEX IF NOT EXISTS "Meeting_facilitatorId_idx" ON "Meeting"("facilitatorId");
CREATE INDEX IF NOT EXISTS "Meeting_weekStart_idx" ON "Meeting"("weekStart");

CREATE TABLE IF NOT EXISTS "MeetingAttendee" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "present" BOOLEAN NOT NULL DEFAULT false,
  "isOptional" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingAttendee_meetingId_userId_key" ON "MeetingAttendee"("meetingId", "userId");
CREATE INDEX IF NOT EXISTS "MeetingAttendee_meetingId_idx" ON "MeetingAttendee"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");

CREATE TABLE IF NOT EXISTS "WeeklyImpactEntry" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "teamId" TEXT,
  "chapterId" TEXT,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "status" "WeeklyImpactStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "inputNeeded" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyImpactEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyImpactEntry_userId_teamId_weekStart_key" ON "WeeklyImpactEntry"("userId", "teamId", "weekStart");
CREATE UNIQUE INDEX IF NOT EXISTS "WeeklyImpactEntry_userId_chapterId_weekStart_key" ON "WeeklyImpactEntry"("userId", "chapterId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyImpactEntry_teamId_weekStart_idx" ON "WeeklyImpactEntry"("teamId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyImpactEntry_chapterId_weekStart_idx" ON "WeeklyImpactEntry"("chapterId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyImpactEntry_userId_weekStart_idx" ON "WeeklyImpactEntry"("userId", "weekStart");
CREATE INDEX IF NOT EXISTS "WeeklyImpactEntry_status_idx" ON "WeeklyImpactEntry"("status");

CREATE TABLE IF NOT EXISTS "WeeklyImpactRow" (
  "id" TEXT NOT NULL,
  "entryId" TEXT NOT NULL,
  "type" TEXT,
  "whatGoal" TEXT,
  "evidenceNext" TEXT,
  "due" TIMESTAMP(3),
  "rowStatus" "WeeklyImpactRowStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "presentToMeeting" BOOLEAN NOT NULL DEFAULT false,
  "decisionNeeded" BOOLEAN NOT NULL DEFAULT false,
  "sendToBoard" BOOLEAN NOT NULL DEFAULT false,
  "meetingId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WeeklyImpactRow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WeeklyImpactRow_entryId_sortOrder_idx" ON "WeeklyImpactRow"("entryId", "sortOrder");
CREATE INDEX IF NOT EXISTS "WeeklyImpactRow_meetingId_idx" ON "WeeklyImpactRow"("meetingId");
CREATE INDEX IF NOT EXISTS "WeeklyImpactRow_sendToBoard_idx" ON "WeeklyImpactRow"("sendToBoard");
CREATE INDEX IF NOT EXISTS "WeeklyImpactRow_presentToMeeting_idx" ON "WeeklyImpactRow"("presentToMeeting");

CREATE TABLE IF NOT EXISTS "OfficerTopic" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "status" "OfficerTopicStatus" NOT NULL DEFAULT 'OPEN',
  "decisionNeeded" BOOLEAN NOT NULL DEFAULT false,
  "sendToBoard" BOOLEAN NOT NULL DEFAULT false,
  "decision" TEXT,
  "nextSteps" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OfficerTopic_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OfficerTopic_meetingId_sortOrder_idx" ON "OfficerTopic"("meetingId", "sortOrder");
CREATE INDEX IF NOT EXISTS "OfficerTopic_status_idx" ON "OfficerTopic"("status");
CREATE INDEX IF NOT EXISTS "OfficerTopic_sendToBoard_idx" ON "OfficerTopic"("sendToBoard");

CREATE TABLE IF NOT EXISTS "OfficerTopicOwner" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  CONSTRAINT "OfficerTopicOwner_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "OfficerTopicOwner_topicId_userId_key" ON "OfficerTopicOwner"("topicId", "userId");
CREATE INDEX IF NOT EXISTS "OfficerTopicOwner_topicId_idx" ON "OfficerTopicOwner"("topicId");
CREATE INDEX IF NOT EXISTS "OfficerTopicOwner_userId_idx" ON "OfficerTopicOwner"("userId");

CREATE TABLE IF NOT EXISTS "MeetingDecision" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "decision" TEXT NOT NULL,
  "rationale" TEXT,
  "decidedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MeetingDecision_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MeetingDecision_meetingId_createdAt_idx" ON "MeetingDecision"("meetingId", "createdAt");
CREATE INDEX IF NOT EXISTS "MeetingDecision_decidedById_idx" ON "MeetingDecision"("decidedById");

CREATE TABLE IF NOT EXISTS "MeetingFollowUp" (
  "id" TEXT NOT NULL,
  "meetingId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT,
  "status" "WeeklyFollowUpStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate" TIMESTAMP(3),
  "ownerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingFollowUp_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_meetingId_idx" ON "MeetingFollowUp"("meetingId");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_ownerId_idx" ON "MeetingFollowUp"("ownerId");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_status_idx" ON "MeetingFollowUp"("status");

-- 6. Foreign keys (guarded; each added once).
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Team_createdById_fkey') THEN
  ALTER TABLE "Team" ADD CONSTRAINT "Team_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMembership_teamId_fkey') THEN
  ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TeamMembership_userId_fkey') THEN
  ALTER TABLE "TeamMembership" ADD CONSTRAINT "TeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_facilitatorId_fkey') THEN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_facilitatorId_fkey" FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_chapterId_fkey') THEN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_teamId_fkey') THEN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Meeting_createdById_fkey') THEN
  ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingAttendee_meetingId_fkey') THEN
  ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingAttendee_userId_fkey') THEN
  ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyImpactEntry_userId_fkey') THEN
  ALTER TABLE "WeeklyImpactEntry" ADD CONSTRAINT "WeeklyImpactEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyImpactEntry_teamId_fkey') THEN
  ALTER TABLE "WeeklyImpactEntry" ADD CONSTRAINT "WeeklyImpactEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyImpactEntry_chapterId_fkey') THEN
  ALTER TABLE "WeeklyImpactEntry" ADD CONSTRAINT "WeeklyImpactEntry_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyImpactRow_entryId_fkey') THEN
  ALTER TABLE "WeeklyImpactRow" ADD CONSTRAINT "WeeklyImpactRow_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WeeklyImpactEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WeeklyImpactRow_meetingId_fkey') THEN
  ALTER TABLE "WeeklyImpactRow" ADD CONSTRAINT "WeeklyImpactRow_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfficerTopic_meetingId_fkey') THEN
  ALTER TABLE "OfficerTopic" ADD CONSTRAINT "OfficerTopic_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfficerTopic_createdById_fkey') THEN
  ALTER TABLE "OfficerTopic" ADD CONSTRAINT "OfficerTopic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfficerTopicOwner_topicId_fkey') THEN
  ALTER TABLE "OfficerTopicOwner" ADD CONSTRAINT "OfficerTopicOwner_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "OfficerTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OfficerTopicOwner_userId_fkey') THEN
  ALTER TABLE "OfficerTopicOwner" ADD CONSTRAINT "OfficerTopicOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingDecision_meetingId_fkey') THEN
  ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingDecision_decidedById_fkey') THEN
  ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingFollowUp_meetingId_fkey') THEN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE; END IF; END $$;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MeetingFollowUp_ownerId_fkey') THEN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;
