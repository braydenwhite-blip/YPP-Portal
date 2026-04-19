-- Migration: instructor_applicant_workflow_v1
-- Extends the instructor application workflow with HIRING_CHAIR role,
-- CHAIR_REVIEW status, reviewer/interviewer assignment tracking,
-- required documents, chair decisions, and timeline audit log.

-- ============================================================
-- 1. Extend existing enum types
-- ============================================================

ALTER TYPE "RoleType" ADD VALUE IF NOT EXISTS 'HIRING_CHAIR';

ALTER TYPE "InstructorApplicationStatus" ADD VALUE IF NOT EXISTS 'CHAIR_REVIEW';
ALTER TYPE "InstructorApplicationStatus" ADD VALUE IF NOT EXISTS 'WITHDRAWN';

ALTER TYPE "InstructorReviewCategoryKey" ADD VALUE IF NOT EXISTS 'SUBJECT_MATTER_FIT';

-- ============================================================
-- 2. Rename enum value (data-safe ALTER TYPE RENAME VALUE)
--    ACCEPT_WITH_REVISIONS -> ACCEPT_WITH_SUPPORT
-- ============================================================

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = '"InstructorInterviewRecommendation"'::regtype
      AND enumlabel = 'ACCEPT_WITH_REVISIONS'
  ) THEN
    ALTER TYPE "InstructorInterviewRecommendation" RENAME VALUE 'ACCEPT_WITH_REVISIONS' TO 'ACCEPT_WITH_SUPPORT';
  END IF;
END $$;

-- ============================================================
-- 3. Create new enum types
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "ApplicantDocumentKind" AS ENUM (
    'COURSE_OUTLINE',
    'FIRST_CLASS_PLAN',
    'RESUME',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "InterviewerAssignmentRole" AS ENUM ('LEAD', 'SECOND');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ChairDecisionAction" AS ENUM (
    'APPROVE',
    'REJECT',
    'HOLD',
    'REQUEST_INFO',
    'REQUEST_SECOND_INTERVIEW'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 4. Add nullable columns to InstructorApplication
-- ============================================================

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "reviewerAssignedAt"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewerAssignedById"  TEXT,
  ADD COLUMN IF NOT EXISTS "chairQueuedAt"         TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "materialsReadyAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt"            TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "InstructorApplication_reviewerAssignedById_idx"
  ON "InstructorApplication"("reviewerAssignedById");

CREATE INDEX IF NOT EXISTS "InstructorApplication_chairQueuedAt_idx"
  ON "InstructorApplication"("chairQueuedAt");

CREATE INDEX IF NOT EXISTS "InstructorApplication_archivedAt_idx"
  ON "InstructorApplication"("archivedAt");

DO $$ BEGIN
  ALTER TABLE "InstructorApplication"
    ADD CONSTRAINT "InstructorApplication_reviewerAssignedById_fkey"
    FOREIGN KEY ("reviewerAssignedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 5. Create InstructorApplicationInterviewer table
-- ============================================================

CREATE TABLE IF NOT EXISTS "InstructorApplicationInterviewer" (
    "id"            TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "interviewerId" TEXT NOT NULL,
    "role"          "InterviewerAssignmentRole" NOT NULL,
    "assignedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById"  TEXT NOT NULL,
    "removedAt"     TIMESTAMP(3),

    CONSTRAINT "InstructorApplicationInterviewer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorApplicationInterviewer_applicationId_role_key"
  ON "InstructorApplicationInterviewer"("applicationId", "role");

CREATE INDEX IF NOT EXISTS "InstructorApplicationInterviewer_interviewerId_removedAt_idx"
  ON "InstructorApplicationInterviewer"("interviewerId", "removedAt");

CREATE INDEX IF NOT EXISTS "InstructorApplicationInterviewer_assignedById_idx"
  ON "InstructorApplicationInterviewer"("assignedById");

DO $$ BEGIN
  ALTER TABLE "InstructorApplicationInterviewer"
    ADD CONSTRAINT "InstructorApplicationInterviewer_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "InstructorApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorApplicationInterviewer"
    ADD CONSTRAINT "InstructorApplicationInterviewer_interviewerId_fkey"
    FOREIGN KEY ("interviewerId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorApplicationInterviewer"
    ADD CONSTRAINT "InstructorApplicationInterviewer_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 6. Create ApplicantDocument table
-- ============================================================

CREATE TABLE IF NOT EXISTS "ApplicantDocument" (
    "id"            TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind"          "ApplicantDocumentKind" NOT NULL,
    "fileUrl"       TEXT NOT NULL,
    "originalName"  TEXT,
    "fileSize"      INTEGER,
    "note"          TEXT,
    "uploadedById"  TEXT NOT NULL,
    "uploadedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt"  TIMESTAMP(3),

    CONSTRAINT "ApplicantDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicantDocument_applicationId_kind_supersededAt_idx"
  ON "ApplicantDocument"("applicationId", "kind", "supersededAt");

CREATE INDEX IF NOT EXISTS "ApplicantDocument_uploadedById_idx"
  ON "ApplicantDocument"("uploadedById");

DO $$ BEGIN
  ALTER TABLE "ApplicantDocument"
    ADD CONSTRAINT "ApplicantDocument_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "InstructorApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ApplicantDocument"
    ADD CONSTRAINT "ApplicantDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 7. Create InstructorApplicationChairDecision table
-- ============================================================

CREATE TABLE IF NOT EXISTS "InstructorApplicationChairDecision" (
    "id"              TEXT NOT NULL,
    "applicationId"   TEXT NOT NULL,
    "chairId"         TEXT NOT NULL,
    "action"          "ChairDecisionAction" NOT NULL,
    "rationale"       TEXT,
    "comparisonNotes" TEXT,
    "decidedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt"    TIMESTAMP(3),

    CONSTRAINT "InstructorApplicationChairDecision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorApplicationChairDecision_applicationId_key"
  ON "InstructorApplicationChairDecision"("applicationId");

CREATE INDEX IF NOT EXISTS "InstructorApplicationChairDecision_chairId_idx"
  ON "InstructorApplicationChairDecision"("chairId");

DO $$ BEGIN
  ALTER TABLE "InstructorApplicationChairDecision"
    ADD CONSTRAINT "InstructorApplicationChairDecision_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "InstructorApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorApplicationChairDecision"
    ADD CONSTRAINT "InstructorApplicationChairDecision_chairId_fkey"
    FOREIGN KEY ("chairId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 8. Create InstructorApplicationTimelineEvent table
-- ============================================================

CREATE TABLE IF NOT EXISTS "InstructorApplicationTimelineEvent" (
    "id"            TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "kind"          TEXT NOT NULL,
    "actorId"       TEXT,
    "payload"       JSONB NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstructorApplicationTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorApplicationTimelineEvent_applicationId_createdAt_idx"
  ON "InstructorApplicationTimelineEvent"("applicationId", "createdAt");

CREATE INDEX IF NOT EXISTS "InstructorApplicationTimelineEvent_actorId_idx"
  ON "InstructorApplicationTimelineEvent"("actorId");

DO $$ BEGIN
  ALTER TABLE "InstructorApplicationTimelineEvent"
    ADD CONSTRAINT "InstructorApplicationTimelineEvent_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "InstructorApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorApplicationTimelineEvent"
    ADD CONSTRAINT "InstructorApplicationTimelineEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
