-- Session 9: Certificate class-linkage, instructor-authored student feedback,
-- attendance finalization, structured instructor availability, and
-- instructor onboarding task tracking.

-- AlterTable: Certificate.offeringId (class-linked certificates + dedupe)
ALTER TABLE "Certificate" ADD COLUMN IF NOT EXISTS "offeringId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Certificate_recipientId_offeringId_key" ON "Certificate"("recipientId", "offeringId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Certificate_offeringId_idx" ON "Certificate"("offeringId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable: ClassAttendanceRecord finalize state
ALTER TABLE "ClassAttendanceRecord" ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMP(3);
ALTER TABLE "ClassAttendanceRecord" ADD COLUMN IF NOT EXISTS "finalizedById" TEXT;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "ClassAttendanceRecord" ADD CONSTRAINT "ClassAttendanceRecord_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstructorStudentFeedback" (
    "id" TEXT NOT NULL,
    "offeringId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "strengths" TEXT,
    "growthAreas" TEXT,
    "releasedToFamilyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorStudentFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstructorStudentFeedback_offeringId_studentId_idx" ON "InstructorStudentFeedback"("offeringId", "studentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstructorStudentFeedback_studentId_releasedToFamilyAt_idx" ON "InstructorStudentFeedback"("studentId", "releasedToFamilyAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InstructorStudentFeedback" ADD CONSTRAINT "InstructorStudentFeedback_offeringId_fkey" FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorStudentFeedback" ADD CONSTRAINT "InstructorStudentFeedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorStudentFeedback" ADD CONSTRAINT "InstructorStudentFeedback_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstructorAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "effectiveFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InstructorAvailability_userId_weekday_key" ON "InstructorAvailability"("userId", "weekday");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstructorAvailability_userId_idx" ON "InstructorAvailability"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InstructorAvailability" ADD CONSTRAINT "InstructorAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "InstructorOnboardingTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorOnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InstructorOnboardingTask_userId_stepKey_key" ON "InstructorOnboardingTask"("userId", "stepKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InstructorOnboardingTask_userId_idx" ON "InstructorOnboardingTask"("userId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "InstructorOnboardingTask" ADD CONSTRAINT "InstructorOnboardingTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
