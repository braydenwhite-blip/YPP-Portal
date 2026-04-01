-- CreateTable
CREATE TABLE "MentorAvailabilityRule" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "slotDuration" INTEGER NOT NULL DEFAULT 30,
    "bufferMinutes" INTEGER NOT NULL DEFAULT 10,
    "meetingLink" TEXT,
    "locationLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorAvailabilityRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentorAvailabilityOverride" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "ruleId" TEXT,
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

    CONSTRAINT "MentorAvailabilityOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorAvailabilityRule_mentorId_isActive_idx"
ON "MentorAvailabilityRule"("mentorId", "isActive");

-- CreateIndex
CREATE INDEX "MentorAvailabilityOverride_mentorId_isActive_startsAt_idx"
ON "MentorAvailabilityOverride"("mentorId", "isActive", "startsAt");

-- CreateIndex
CREATE INDEX "MentorAvailabilityOverride_ruleId_idx"
ON "MentorAvailabilityOverride"("ruleId");

-- AddForeignKey
ALTER TABLE "MentorAvailabilityRule"
ADD CONSTRAINT "MentorAvailabilityRule_mentorId_fkey"
FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAvailabilityOverride"
ADD CONSTRAINT "MentorAvailabilityOverride_mentorId_fkey"
FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorAvailabilityOverride"
ADD CONSTRAINT "MentorAvailabilityOverride_ruleId_fkey"
FOREIGN KEY ("ruleId") REFERENCES "MentorAvailabilityRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
