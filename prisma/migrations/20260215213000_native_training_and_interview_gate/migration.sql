-- Native instructor readiness: training academy + pre-offering interview gate

-- ============================================
-- ENUMS
-- ============================================

DO $$
BEGIN
  ALTER TYPE "CourseLevel" ADD VALUE IF NOT EXISTS 'LEVEL_401';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TrainingEvidenceStatus" AS ENUM (
    'PENDING_REVIEW',
    'APPROVED',
    'REVISION_REQUESTED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ReadinessReviewStatus" AS ENUM (
    'REQUESTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REVISION_REQUESTED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InterviewGateStatus" AS ENUM (
    'REQUIRED',
    'SCHEDULED',
    'COMPLETED',
    'PASSED',
    'HOLD',
    'FAILED',
    'WAIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InterviewSlotSource" AS ENUM (
    'REVIEWER_POSTED',
    'INSTRUCTOR_REQUESTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InterviewSlotStatus" AS ENUM (
    'POSTED',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InterviewRequestStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'DECLINED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "InterviewOutcome" AS ENUM (
    'PASS',
    'HOLD',
    'FAIL',
    'WAIVE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- COLUMN EXTENSIONS
-- ============================================

ALTER TABLE "TrainingModule"
  ADD COLUMN IF NOT EXISTS "requiresQuiz" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiresEvidence" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "passScorePct" INTEGER NOT NULL DEFAULT 80;

ALTER TABLE "ClassOffering"
  ADD COLUMN IF NOT EXISTS "grandfatheredTrainingExemption" BOOLEAN NOT NULL DEFAULT false;

-- ============================================
-- TRAINING TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS "TrainingCheckpoint" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingCheckpointCompletion" (
  "id" TEXT NOT NULL,
  "checkpointId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "notes" TEXT,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrainingCheckpointCompletion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingQuizQuestion" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "correctAnswer" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingQuizQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingQuizAttempt" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "scorePct" INTEGER NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "answers" JSONB,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrainingQuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrainingEvidenceSubmission" (
  "id" TEXT NOT NULL,
  "moduleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "notes" TEXT,
  "status" "TrainingEvidenceStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TrainingEvidenceSubmission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReadinessReviewRequest" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "status" "ReadinessReviewStatus" NOT NULL DEFAULT 'REQUESTED',
  "notes" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ReadinessReviewRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstructorTeachingPermission" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "level" "CourseLevel" NOT NULL,
  "grantedById" TEXT NOT NULL,
  "reason" TEXT,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorTeachingPermission_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- INTERVIEW GATE TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS "InstructorInterviewGate" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "status" "InterviewGateStatus" NOT NULL DEFAULT 'REQUIRED',
  "outcome" "InterviewOutcome",
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorInterviewGate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstructorInterviewSlot" (
  "id" TEXT NOT NULL,
  "gateId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "source" "InterviewSlotSource" NOT NULL DEFAULT 'REVIEWER_POSTED',
  "status" "InterviewSlotStatus" NOT NULL DEFAULT 'POSTED',
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "duration" INTEGER NOT NULL DEFAULT 30,
  "meetingLink" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorInterviewSlot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InstructorInterviewAvailabilityRequest" (
  "id" TEXT NOT NULL,
  "gateId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "preferredSlots" JSONB NOT NULL,
  "note" TEXT,
  "status" "InterviewRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InstructorInterviewAvailabilityRequest_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- INDEXES / UNIQUES
-- ============================================

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingAssignment_userId_moduleId_key"
  ON "TrainingAssignment"("userId", "moduleId");

CREATE INDEX IF NOT EXISTS "TrainingCheckpoint_moduleId_sortOrder_idx"
  ON "TrainingCheckpoint"("moduleId", "sortOrder");

CREATE UNIQUE INDEX IF NOT EXISTS "TrainingCheckpointCompletion_checkpointId_userId_key"
  ON "TrainingCheckpointCompletion"("checkpointId", "userId");

CREATE INDEX IF NOT EXISTS "TrainingCheckpointCompletion_userId_idx"
  ON "TrainingCheckpointCompletion"("userId");

CREATE INDEX IF NOT EXISTS "TrainingQuizQuestion_moduleId_sortOrder_idx"
  ON "TrainingQuizQuestion"("moduleId", "sortOrder");

CREATE INDEX IF NOT EXISTS "TrainingQuizAttempt_moduleId_userId_idx"
  ON "TrainingQuizAttempt"("moduleId", "userId");

CREATE INDEX IF NOT EXISTS "TrainingEvidenceSubmission_moduleId_userId_idx"
  ON "TrainingEvidenceSubmission"("moduleId", "userId");

CREATE INDEX IF NOT EXISTS "TrainingEvidenceSubmission_status_idx"
  ON "TrainingEvidenceSubmission"("status");

CREATE INDEX IF NOT EXISTS "ReadinessReviewRequest_instructorId_status_idx"
  ON "ReadinessReviewRequest"("instructorId", "status");

CREATE INDEX IF NOT EXISTS "ReadinessReviewRequest_status_idx"
  ON "ReadinessReviewRequest"("status");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorTeachingPermission_instructorId_level_key"
  ON "InstructorTeachingPermission"("instructorId", "level");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorInterviewGate_instructorId_key"
  ON "InstructorInterviewGate"("instructorId");

CREATE INDEX IF NOT EXISTS "InstructorInterviewSlot_gateId_status_idx"
  ON "InstructorInterviewSlot"("gateId", "status");

CREATE INDEX IF NOT EXISTS "InstructorInterviewSlot_scheduledAt_idx"
  ON "InstructorInterviewSlot"("scheduledAt");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorInterviewSlot_gateId_scheduledAt_key"
  ON "InstructorInterviewSlot"("gateId", "scheduledAt");

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorInterviewSlot_gateId_confirmed_unique_idx"
  ON "InstructorInterviewSlot"("gateId")
  WHERE "status" = 'CONFIRMED';

CREATE INDEX IF NOT EXISTS "InstructorInterviewAvailabilityRequest_gateId_status_idx"
  ON "InstructorInterviewAvailabilityRequest"("gateId", "status");

CREATE INDEX IF NOT EXISTS "InstructorInterviewAvailabilityRequest_instructorId_status_idx"
  ON "InstructorInterviewAvailabilityRequest"("instructorId", "status");

-- ============================================
-- FOREIGN KEYS
-- ============================================

DO $$
BEGIN
  ALTER TABLE "TrainingCheckpoint"
    ADD CONSTRAINT "TrainingCheckpoint_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingCheckpointCompletion"
    ADD CONSTRAINT "TrainingCheckpointCompletion_checkpointId_fkey"
    FOREIGN KEY ("checkpointId") REFERENCES "TrainingCheckpoint"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingCheckpointCompletion"
    ADD CONSTRAINT "TrainingCheckpointCompletion_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingQuizQuestion"
    ADD CONSTRAINT "TrainingQuizQuestion_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingQuizAttempt"
    ADD CONSTRAINT "TrainingQuizAttempt_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingQuizAttempt"
    ADD CONSTRAINT "TrainingQuizAttempt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingEvidenceSubmission"
    ADD CONSTRAINT "TrainingEvidenceSubmission_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingEvidenceSubmission"
    ADD CONSTRAINT "TrainingEvidenceSubmission_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "TrainingEvidenceSubmission"
    ADD CONSTRAINT "TrainingEvidenceSubmission_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReadinessReviewRequest"
    ADD CONSTRAINT "ReadinessReviewRequest_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "ReadinessReviewRequest"
    ADD CONSTRAINT "ReadinessReviewRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorTeachingPermission"
    ADD CONSTRAINT "InstructorTeachingPermission_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorTeachingPermission"
    ADD CONSTRAINT "InstructorTeachingPermission_grantedById_fkey"
    FOREIGN KEY ("grantedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorInterviewGate"
    ADD CONSTRAINT "InstructorInterviewGate_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorInterviewGate"
    ADD CONSTRAINT "InstructorInterviewGate_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorInterviewSlot"
    ADD CONSTRAINT "InstructorInterviewSlot_gateId_fkey"
    FOREIGN KEY ("gateId") REFERENCES "InstructorInterviewGate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorInterviewSlot"
    ADD CONSTRAINT "InstructorInterviewSlot_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorInterviewAvailabilityRequest"
    ADD CONSTRAINT "InstructorInterviewAvailabilityRequest_gateId_fkey"
    FOREIGN KEY ("gateId") REFERENCES "InstructorInterviewGate"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorInterviewAvailabilityRequest"
    ADD CONSTRAINT "InstructorInterviewAvailabilityRequest_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "InstructorInterviewAvailabilityRequest"
    ADD CONSTRAINT "InstructorInterviewAvailabilityRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
