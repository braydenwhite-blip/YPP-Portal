-- Migration: add_meetings_command_center
-- People Strategy — Meetings Tracker / Weekly Command Center.
-- Enriches OfficerMeeting with command-center metadata (title, purpose,
-- category, priority, end time, recurrence, location, notes, facilitator,
-- related entity) and adds the structured MeetingAttendee / MeetingAgendaItem /
-- MeetingDecision / MeetingFollowUp tables. Every change is additive and
-- idempotent (IF NOT EXISTS / DO $$ guards) so the existing Officer-Meetings
-- surface and rows keep working unchanged.

-- CreateEnum: MeetingAgendaStatus
DO $$ BEGIN
  CREATE TYPE "MeetingAgendaStatus" AS ENUM ('OPEN', 'DISCUSSED', 'DEFERRED', 'CONVERTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum: MeetingFollowUpStatus
DO $$ BEGIN
  CREATE TYPE "MeetingFollowUpStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: OfficerMeeting — additive command-center columns
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "purpose" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "endTime" TIMESTAMP(3);
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "recurrence" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "notesText" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "facilitatorId" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "relatedEntityType" TEXT;
ALTER TABLE "OfficerMeeting" ADD COLUMN IF NOT EXISTS "relatedEntityId" TEXT;

-- CreateTable: MeetingAttendee
CREATE TABLE IF NOT EXISTS "MeetingAttendee" (
    "id" TEXT NOT NULL,
    "officerMeetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MeetingAgendaItem
CREATE TABLE IF NOT EXISTS "MeetingAgendaItem" (
    "id" TEXT NOT NULL,
    "officerMeetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MeetingAgendaStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    "convertedActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MeetingDecision
CREATE TABLE IF NOT EXISTS "MeetingDecision" (
    "id" TEXT NOT NULL,
    "officerMeetingId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT,
    "decidedById" TEXT,
    "linkedActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingDecision_pkey" PRIMARY KEY ("id")
);

-- CreateTable: MeetingFollowUp
CREATE TABLE IF NOT EXISTS "MeetingFollowUp" (
    "id" TEXT NOT NULL,
    "officerMeetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "MeetingFollowUpStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "ActionPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "area" TEXT,
    "completedAt" TIMESTAMP(3),
    "ownerId" TEXT,
    "linkedActionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: OfficerMeeting (new)
CREATE INDEX IF NOT EXISTS "OfficerMeeting_category_idx" ON "OfficerMeeting"("category");
CREATE INDEX IF NOT EXISTS "OfficerMeeting_facilitatorId_idx" ON "OfficerMeeting"("facilitatorId");
CREATE INDEX IF NOT EXISTS "OfficerMeeting_relatedEntityType_relatedEntityId_idx" ON "OfficerMeeting"("relatedEntityType", "relatedEntityId");

-- CreateIndex: MeetingAttendee
CREATE UNIQUE INDEX IF NOT EXISTS "MeetingAttendee_officerMeetingId_userId_key" ON "MeetingAttendee"("officerMeetingId", "userId");
CREATE INDEX IF NOT EXISTS "MeetingAttendee_officerMeetingId_idx" ON "MeetingAttendee"("officerMeetingId");
CREATE INDEX IF NOT EXISTS "MeetingAttendee_userId_idx" ON "MeetingAttendee"("userId");

-- CreateIndex: MeetingAgendaItem
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_officerMeetingId_sortOrder_idx" ON "MeetingAgendaItem"("officerMeetingId", "sortOrder");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_status_idx" ON "MeetingAgendaItem"("status");
CREATE INDEX IF NOT EXISTS "MeetingAgendaItem_ownerId_idx" ON "MeetingAgendaItem"("ownerId");

-- CreateIndex: MeetingDecision
CREATE INDEX IF NOT EXISTS "MeetingDecision_officerMeetingId_createdAt_idx" ON "MeetingDecision"("officerMeetingId", "createdAt");
CREATE INDEX IF NOT EXISTS "MeetingDecision_decidedById_idx" ON "MeetingDecision"("decidedById");

-- CreateIndex: MeetingFollowUp
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_officerMeetingId_idx" ON "MeetingFollowUp"("officerMeetingId");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_status_idx" ON "MeetingFollowUp"("status");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_dueDate_idx" ON "MeetingFollowUp"("dueDate");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_ownerId_idx" ON "MeetingFollowUp"("ownerId");
CREATE INDEX IF NOT EXISTS "MeetingFollowUp_linkedActionId_idx" ON "MeetingFollowUp"("linkedActionId");

-- AddForeignKey: OfficerMeeting.facilitatorId -> User
DO $$ BEGIN
  ALTER TABLE "OfficerMeeting" ADD CONSTRAINT "OfficerMeeting_facilitatorId_fkey"
    FOREIGN KEY ("facilitatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingAttendee -> OfficerMeeting
DO $$ BEGIN
  ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingAttendee -> User
DO $$ BEGIN
  ALTER TABLE "MeetingAttendee" ADD CONSTRAINT "MeetingAttendee_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingAgendaItem -> OfficerMeeting
DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingAgendaItem -> User (owner)
DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingAgendaItem -> ActionItem (converted)
DO $$ BEGIN
  ALTER TABLE "MeetingAgendaItem" ADD CONSTRAINT "MeetingAgendaItem_convertedActionId_fkey"
    FOREIGN KEY ("convertedActionId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingDecision -> OfficerMeeting
DO $$ BEGIN
  ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingDecision -> User (decidedBy)
DO $$ BEGIN
  ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_decidedById_fkey"
    FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingDecision -> ActionItem (linked)
DO $$ BEGIN
  ALTER TABLE "MeetingDecision" ADD CONSTRAINT "MeetingDecision_linkedActionId_fkey"
    FOREIGN KEY ("linkedActionId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingFollowUp -> OfficerMeeting
DO $$ BEGIN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingFollowUp -> User (owner)
DO $$ BEGIN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingFollowUp -> ActionItem (linked)
DO $$ BEGIN
  ALTER TABLE "MeetingFollowUp" ADD CONSTRAINT "MeetingFollowUp_linkedActionId_fkey"
    FOREIGN KEY ("linkedActionId") REFERENCES "ActionItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
