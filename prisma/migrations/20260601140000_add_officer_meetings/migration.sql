-- Migration: add_officer_meetings
-- People Strategy — Officer Meetings (Prompt 06A).
-- Adds OfficerMeeting (date / status / generated agenda + summary email text),
-- MeetingNote (editable per-linked-action-item discussion notes), and
-- MiscUpdate (ad-hoc talking points). Also backs the pre-existing bare
-- ActionItem.officerMeetingId column with a real FK to OfficerMeeting.
-- Written idempotently (IF NOT EXISTS / DO $$ guards) to match repo convention.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OfficerMeetingStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "OfficerMeeting" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "OfficerMeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "agendaText" TEXT,
    "summaryEmailText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficerMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MeetingNote" (
    "id" TEXT NOT NULL,
    "officerMeetingId" TEXT NOT NULL,
    "actionItemId" TEXT NOT NULL,
    "discussionNotes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MiscUpdate" (
    "id" TEXT NOT NULL,
    "officerMeetingId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiscUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OfficerMeeting_date_idx" ON "OfficerMeeting"("date");
CREATE INDEX IF NOT EXISTS "OfficerMeeting_status_date_idx" ON "OfficerMeeting"("status", "date");

CREATE UNIQUE INDEX IF NOT EXISTS "MeetingNote_officerMeetingId_actionItemId_key" ON "MeetingNote"("officerMeetingId", "actionItemId");
CREATE INDEX IF NOT EXISTS "MeetingNote_officerMeetingId_idx" ON "MeetingNote"("officerMeetingId");
CREATE INDEX IF NOT EXISTS "MeetingNote_actionItemId_idx" ON "MeetingNote"("actionItemId");

CREATE INDEX IF NOT EXISTS "MiscUpdate_officerMeetingId_createdAt_idx" ON "MiscUpdate"("officerMeetingId", "createdAt");
CREATE INDEX IF NOT EXISTS "MiscUpdate_addedById_idx" ON "MiscUpdate"("addedById");

-- AddForeignKey: ActionItem.officerMeetingId -> OfficerMeeting (back the bare column)
DO $$ BEGIN
  ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingNote -> OfficerMeeting
DO $$ BEGIN
  ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MeetingNote -> ActionItem
DO $$ BEGIN
  ALTER TABLE "MeetingNote" ADD CONSTRAINT "MeetingNote_actionItemId_fkey"
    FOREIGN KEY ("actionItemId") REFERENCES "ActionItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MiscUpdate -> OfficerMeeting
DO $$ BEGIN
  ALTER TABLE "MiscUpdate" ADD CONSTRAINT "MiscUpdate_officerMeetingId_fkey"
    FOREIGN KEY ("officerMeetingId") REFERENCES "OfficerMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: MiscUpdate -> User
DO $$ BEGIN
  ALTER TABLE "MiscUpdate" ADD CONSTRAINT "MiscUpdate_addedById_fkey"
    FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
