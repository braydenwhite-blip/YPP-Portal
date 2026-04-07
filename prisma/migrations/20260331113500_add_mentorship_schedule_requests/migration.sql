-- AlterTable
ALTER TABLE "MentorshipSession"
ADD COLUMN "scheduleRequestId" TEXT;

-- CreateTable
CREATE TABLE "MentorshipScheduleRequest" (
    "id" TEXT NOT NULL,
    "mentorshipId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "sessionType" "MentorshipSessionType" NOT NULL DEFAULT 'CHECK_IN',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "preferredSlots" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "confirmedAt" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "meetingLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorshipScheduleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MentorshipScheduleRequest_mentorshipId_idx"
ON "MentorshipScheduleRequest"("mentorshipId");

-- CreateIndex
CREATE INDEX "MentorshipScheduleRequest_requestedById_idx"
ON "MentorshipScheduleRequest"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "MentorshipSession_scheduleRequestId_key"
ON "MentorshipSession"("scheduleRequestId");

-- AddForeignKey
ALTER TABLE "MentorshipScheduleRequest"
ADD CONSTRAINT "MentorshipScheduleRequest_mentorshipId_fkey"
FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipScheduleRequest"
ADD CONSTRAINT "MentorshipScheduleRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorshipSession"
ADD CONSTRAINT "MentorshipSession_scheduleRequestId_fkey"
FOREIGN KEY ("scheduleRequestId") REFERENCES "MentorshipScheduleRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
