-- Chapter hiring openings + interview workflow v1

DO $$
BEGIN
  CREATE TYPE "InterviewSlotStatus" AS ENUM ('POSTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "HiringRecommendation" AS ENUM ('STRONG_YES', 'YES', 'MAYBE', 'NO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PositionVisibility" AS ENUM ('CHAPTER_ONLY', 'NETWORK_WIDE', 'PUBLIC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE "Position"
  ADD COLUMN IF NOT EXISTS "openedById" TEXT,
  ADD COLUMN IF NOT EXISTS "hiringLeadId" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" "PositionVisibility" NOT NULL DEFAULT 'CHAPTER_ONLY',
  ADD COLUMN IF NOT EXISTS "interviewRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "targetStartDate" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "applicationDeadline" TIMESTAMP(3);

ALTER TABLE "InterviewSlot"
  ADD COLUMN IF NOT EXISTS "status" "InterviewSlotStatus" NOT NULL DEFAULT 'POSTED',
  ADD COLUMN IF NOT EXISTS "interviewerId" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

UPDATE "InterviewSlot"
SET "status" = CASE
  WHEN "isConfirmed" = true THEN 'CONFIRMED'::"InterviewSlotStatus"
  ELSE 'POSTED'::"InterviewSlotStatus"
END;

ALTER TABLE "InterviewNote"
  ADD COLUMN IF NOT EXISTS "recommendation" "HiringRecommendation",
  ADD COLUMN IF NOT EXISTS "strengths" TEXT,
  ADD COLUMN IF NOT EXISTS "concerns" TEXT,
  ADD COLUMN IF NOT EXISTS "nextStepSuggestion" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Position_openedById_fkey'
  ) THEN
    ALTER TABLE "Position"
      ADD CONSTRAINT "Position_openedById_fkey"
      FOREIGN KEY ("openedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Position_hiringLeadId_fkey'
  ) THEN
    ALTER TABLE "Position"
      ADD CONSTRAINT "Position_hiringLeadId_fkey"
      FOREIGN KEY ("hiringLeadId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InterviewSlot_interviewerId_fkey'
  ) THEN
    ALTER TABLE "InterviewSlot"
      ADD CONSTRAINT "InterviewSlot_interviewerId_fkey"
      FOREIGN KEY ("interviewerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "Position_chapterId_isOpen_createdAt_idx"
  ON "Position"("chapterId", "isOpen", "createdAt");

CREATE INDEX IF NOT EXISTS "Position_chapterId_type_isOpen_idx"
  ON "Position"("chapterId", "type", "isOpen");

CREATE INDEX IF NOT EXISTS "Position_openedById_idx"
  ON "Position"("openedById");

CREATE INDEX IF NOT EXISTS "Position_hiringLeadId_idx"
  ON "Position"("hiringLeadId");

CREATE INDEX IF NOT EXISTS "Application_positionId_status_submittedAt_idx"
  ON "Application"("positionId", "status", "submittedAt");

CREATE INDEX IF NOT EXISTS "InterviewSlot_applicationId_status_scheduledAt_idx"
  ON "InterviewSlot"("applicationId", "status", "scheduledAt");

CREATE INDEX IF NOT EXISTS "InterviewSlot_interviewerId_idx"
  ON "InterviewSlot"("interviewerId");

CREATE INDEX IF NOT EXISTS "InterviewNote_applicationId_createdAt_idx"
  ON "InterviewNote"("applicationId", "createdAt");
