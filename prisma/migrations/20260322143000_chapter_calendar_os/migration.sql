-- CreateEnum
CREATE TYPE "EventScope" AS ENUM ('GLOBAL', 'CHAPTER');

-- CreateEnum
CREATE TYPE "EventVisibility" AS ENUM ('INTERNAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "EventRecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'EVENT_REMINDER';

-- AlterTable
ALTER TABLE "Chapter"
ADD COLUMN "slug" TEXT,
ADD COLUMN "publicProfileEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "publicSummary" TEXT,
ADD COLUMN "publicStory" TEXT,
ADD COLUMN "publicContactEmail" TEXT,
ADD COLUMN "publicContactUrl" TEXT,
ADD COLUMN "calendarDescription" TEXT,
ADD COLUMN "calendarThemeColor" TEXT;

-- AlterTable
ALTER TABLE "Event"
ADD COLUMN "scope" "EventScope" NOT NULL DEFAULT 'GLOBAL',
ADD COLUMN "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN "createdById" TEXT,
ADD COLUMN "updatedById" TEXT,
ADD COLUMN "seriesId" TEXT,
ADD COLUMN "occurrenceOriginalStart" TIMESTAMP(3),
ADD COLUMN "isException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isCancelled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "reminder24Hr" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "reminder1Hr" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing chapter-owned events to safer defaults.
UPDATE "Event"
SET
  "scope" = 'CHAPTER',
  "visibility" = 'INTERNAL'
WHERE "chapterId" IS NOT NULL;

-- AlterTable
ALTER TABLE "NotificationPreference"
ADD COLUMN "eventUpdates" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "eventReminders" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "EventSeries" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "eventType" "EventType" NOT NULL,
    "scope" "EventScope" NOT NULL DEFAULT 'CHAPTER',
    "visibility" "EventVisibility" NOT NULL DEFAULT 'INTERNAL',
    "chapterId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "location" TEXT,
    "meetingUrl" TEXT,
    "recurrenceFrequency" "EventRecurrenceFrequency" NOT NULL,
    "recurrenceInterval" INTEGER NOT NULL DEFAULT 1,
    "recurrenceDays" TEXT[],
    "recurrenceCount" INTEGER,
    "recurrenceUntil" TIMESTAMP(3),
    "reminder24Hr" BOOLEAN NOT NULL DEFAULT true,
    "reminder1Hr" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventReminder" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterMilestone" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "visibility" "EventVisibility" NOT NULL DEFAULT 'INTERNAL',
    "createdById" TEXT,
    "updatedById" TEXT,
    "calendarUid" TEXT NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterCalendarSubscription" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterCalendarSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Chapter_slug_key" ON "Chapter"("slug");

-- CreateIndex
CREATE INDEX "Event_chapterId_startDate_idx" ON "Event"("chapterId", "startDate");

-- CreateIndex
CREATE INDEX "Event_scope_visibility_startDate_idx" ON "Event"("scope", "visibility", "startDate");

-- CreateIndex
CREATE INDEX "Event_seriesId_startDate_idx" ON "Event"("seriesId", "startDate");

-- CreateIndex
CREATE INDEX "EventSeries_chapterId_recurrenceUntil_idx" ON "EventSeries"("chapterId", "recurrenceUntil");

-- CreateIndex
CREATE INDEX "EventSeries_scope_visibility_idx" ON "EventSeries"("scope", "visibility");

-- CreateIndex
CREATE INDEX "EventReminder_eventId_idx" ON "EventReminder"("eventId");

-- CreateIndex
CREATE INDEX "EventReminder_userId_idx" ON "EventReminder"("userId");

-- CreateIndex
CREATE INDEX "EventReminder_scheduledFor_idx" ON "EventReminder"("scheduledFor");

-- CreateIndex
CREATE INDEX "EventReminder_status_idx" ON "EventReminder"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EventReminder_eventId_userId_type_key" ON "EventReminder"("eventId", "userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterMilestone_calendarUid_key" ON "ChapterMilestone"("calendarUid");

-- CreateIndex
CREATE INDEX "ChapterMilestone_chapterId_dueDate_idx" ON "ChapterMilestone"("chapterId", "dueDate");

-- CreateIndex
CREATE INDEX "ChapterMilestone_visibility_dueDate_idx" ON "ChapterMilestone"("visibility", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterCalendarSubscription_feedToken_key" ON "ChapterCalendarSubscription"("feedToken");

-- CreateIndex
CREATE INDEX "ChapterCalendarSubscription_userId_idx" ON "ChapterCalendarSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChapterCalendarSubscription_chapterId_userId_key" ON "ChapterCalendarSubscription"("chapterId", "userId");

-- AddForeignKey
ALTER TABLE "Event"
ADD CONSTRAINT "Event_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event"
ADD CONSTRAINT "Event_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event"
ADD CONSTRAINT "Event_seriesId_fkey"
FOREIGN KEY ("seriesId") REFERENCES "EventSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries"
ADD CONSTRAINT "EventSeries_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries"
ADD CONSTRAINT "EventSeries_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeries"
ADD CONSTRAINT "EventSeries_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReminder"
ADD CONSTRAINT "EventReminder_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventReminder"
ADD CONSTRAINT "EventReminder_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterMilestone"
ADD CONSTRAINT "ChapterMilestone_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterMilestone"
ADD CONSTRAINT "ChapterMilestone_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterMilestone"
ADD CONSTRAINT "ChapterMilestone_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterCalendarSubscription"
ADD CONSTRAINT "ChapterCalendarSubscription_chapterId_fkey"
FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterCalendarSubscription"
ADD CONSTRAINT "ChapterCalendarSubscription_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
