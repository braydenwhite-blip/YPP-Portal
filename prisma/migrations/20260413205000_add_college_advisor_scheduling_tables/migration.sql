-- Backfill the college advisor scheduling schema that exists in Prisma but was
-- never created by a committed migration.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollegeMeetingStatus') THEN
    CREATE TYPE "CollegeMeetingStatus" AS ENUM (
      'REQUESTED',
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED',
      'NO_SHOW'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CollegeResourceCategory') THEN
    CREATE TYPE "CollegeResourceCategory" AS ENUM (
      'SCHOLARSHIP',
      'APPLICATION_TIPS',
      'ESSAY_WRITING',
      'FINANCIAL_AID',
      'CAMPUS_LIFE',
      'CAREER_PLANNING',
      'TEST_PREP',
      'RECOMMENDATION_LETTERS'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CollegeAdvisor" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "college" TEXT NOT NULL,
  "major" TEXT,
  "availability" TEXT,
  "bio" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollegeAdvisor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CollegeAdvisorship" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "adviseeId" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "notes" TEXT,
  CONSTRAINT "CollegeAdvisorship_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CollegeAdvisorMeeting" (
  "id" TEXT NOT NULL,
  "advisorshipId" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "status" "CollegeMeetingStatus" NOT NULL DEFAULT 'REQUESTED',
  "meetingLink" TEXT,
  "topic" TEXT,
  "notes" TEXT,
  "actionItems" TEXT,
  "adviseeRating" INTEGER,
  "adviseeFeedback" TEXT,
  "schedulingOverrideReason" TEXT,
  "reminder24SentAt" TIMESTAMP(3),
  "reminder2SentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CollegeAdvisorMeeting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorAvailabilitySlot" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "slotDuration" INTEGER NOT NULL DEFAULT 30,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 10,
  "meetingLink" TEXT,
  "locationLabel" TEXT,
  "isRecurring" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisorAvailabilitySlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdvisorAvailabilityOverride" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "slotId" TEXT,
  "type" "InterviewAvailabilityOverrideType" NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
  "slotDuration" INTEGER,
  "bufferMinutes" INTEGER,
  "meetingLink" TEXT,
  "locationLabel" TEXT,
  "note" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdvisorAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CollegeResource" (
  "id" TEXT NOT NULL,
  "advisorId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "url" TEXT,
  "category" "CollegeResourceCategory" NOT NULL,
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "isFeatured" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CollegeResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CollegeAdvisor_userId_key"
  ON "CollegeAdvisor"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "CollegeAdvisorship_advisorId_adviseeId_key"
  ON "CollegeAdvisorship"("advisorId", "adviseeId");

CREATE INDEX IF NOT EXISTS "CollegeAdvisorMeeting_advisorshipId_idx"
  ON "CollegeAdvisorMeeting"("advisorshipId");

CREATE INDEX IF NOT EXISTS "AdvisorAvailabilitySlot_advisorId_isActive_idx"
  ON "AdvisorAvailabilitySlot"("advisorId", "isActive");

CREATE INDEX IF NOT EXISTS "AdvisorAvailabilityOverride_advisorId_isActive_startsAt_idx"
  ON "AdvisorAvailabilityOverride"("advisorId", "isActive", "startsAt");

CREATE INDEX IF NOT EXISTS "AdvisorAvailabilityOverride_slotId_idx"
  ON "AdvisorAvailabilityOverride"("slotId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CollegeAdvisor_userId_fkey') THEN
    ALTER TABLE "CollegeAdvisor"
      ADD CONSTRAINT "CollegeAdvisor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CollegeAdvisorship_advisorId_fkey') THEN
    ALTER TABLE "CollegeAdvisorship"
      ADD CONSTRAINT "CollegeAdvisorship_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "CollegeAdvisor"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CollegeAdvisorship_adviseeId_fkey') THEN
    ALTER TABLE "CollegeAdvisorship"
      ADD CONSTRAINT "CollegeAdvisorship_adviseeId_fkey"
      FOREIGN KEY ("adviseeId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CollegeAdvisorMeeting_advisorshipId_fkey') THEN
    ALTER TABLE "CollegeAdvisorMeeting"
      ADD CONSTRAINT "CollegeAdvisorMeeting_advisorshipId_fkey"
      FOREIGN KEY ("advisorshipId") REFERENCES "CollegeAdvisorship"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvisorAvailabilitySlot_advisorId_fkey') THEN
    ALTER TABLE "AdvisorAvailabilitySlot"
      ADD CONSTRAINT "AdvisorAvailabilitySlot_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "CollegeAdvisor"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvisorAvailabilityOverride_advisorId_fkey') THEN
    ALTER TABLE "AdvisorAvailabilityOverride"
      ADD CONSTRAINT "AdvisorAvailabilityOverride_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "CollegeAdvisor"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvisorAvailabilityOverride_slotId_fkey') THEN
    ALTER TABLE "AdvisorAvailabilityOverride"
      ADD CONSTRAINT "AdvisorAvailabilityOverride_slotId_fkey"
      FOREIGN KEY ("slotId") REFERENCES "AdvisorAvailabilitySlot"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CollegeResource_advisorId_fkey') THEN
    ALTER TABLE "CollegeResource"
      ADD CONSTRAINT "CollegeResource_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "CollegeAdvisor"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
