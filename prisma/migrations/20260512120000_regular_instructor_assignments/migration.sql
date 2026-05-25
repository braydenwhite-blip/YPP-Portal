-- Migration: regular_instructor_assignments
--
-- First-class assignment model joining ClassOffering ↔ User (instructor)
-- with role + lifecycle status, plus optional links to chapter, curriculum
-- draft, and class template. The existing ClassOffering.instructorId
-- pointer is intentionally left in place as the canonical "lead" pointer
-- so existing surfaces (reminders, attendance, my-classes, instructor
-- gating) keep working unchanged. This new table adds co-instructor,
-- assistant, and backup roles plus a confirmation flow.
--
-- All changes are strictly additive — no existing rows are touched and
-- no existing FKs are altered. Re-running this migration is idempotent.

-- 1) Enums -------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "RegularInstructorAssignmentRole" AS ENUM (
    'LEAD',
    'CO_INSTRUCTOR',
    'ASSISTANT',
    'BACKUP'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "RegularInstructorAssignmentStatus" AS ENUM (
    'SUGGESTED',
    'PENDING_REVIEW',
    'OFFERED',
    'INSTRUCTOR_CONFIRMED',
    'CHAPTER_CONFIRMED',
    'FULLY_CONFIRMED',
    'NEEDS_TRAINING',
    'NEEDS_CURRICULUM',
    'DECLINED',
    'REMOVED',
    'COMPLETED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) Table -------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "RegularInstructorAssignment" (
  "id" TEXT NOT NULL,
  "offeringId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "role" "RegularInstructorAssignmentRole" NOT NULL DEFAULT 'LEAD',
  "status" "RegularInstructorAssignmentStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  "chapterId" TEXT,
  "curriculumDraftId" TEXT,
  "classTemplateId" TEXT,
  "offeredAt" TIMESTAMP(3),
  "instructorConfirmedAt" TIMESTAMP(3),
  "chapterConfirmedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "adminNotes" TEXT,
  "instructorNote" TEXT,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RegularInstructorAssignment_pkey" PRIMARY KEY ("id")
);

-- 3) Indexes -----------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "RegularInstructorAssignment_offeringId_instructorId_role_key"
  ON "RegularInstructorAssignment"("offeringId", "instructorId", "role");

CREATE INDEX IF NOT EXISTS "RegularInstructorAssignment_offeringId_idx"
  ON "RegularInstructorAssignment"("offeringId");

CREATE INDEX IF NOT EXISTS "RegularInstructorAssignment_instructorId_idx"
  ON "RegularInstructorAssignment"("instructorId");

CREATE INDEX IF NOT EXISTS "RegularInstructorAssignment_status_idx"
  ON "RegularInstructorAssignment"("status");

CREATE INDEX IF NOT EXISTS "RegularInstructorAssignment_chapterId_idx"
  ON "RegularInstructorAssignment"("chapterId");

CREATE INDEX IF NOT EXISTS "RegularInstructorAssignment_role_idx"
  ON "RegularInstructorAssignment"("role");

-- 4) Foreign keys ------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "RegularInstructorAssignment"
    ADD CONSTRAINT "RegularInstructorAssignment_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegularInstructorAssignment"
    ADD CONSTRAINT "RegularInstructorAssignment_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegularInstructorAssignment"
    ADD CONSTRAINT "RegularInstructorAssignment_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegularInstructorAssignment"
    ADD CONSTRAINT "RegularInstructorAssignment_curriculumDraftId_fkey"
    FOREIGN KEY ("curriculumDraftId") REFERENCES "CurriculumDraft"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegularInstructorAssignment"
    ADD CONSTRAINT "RegularInstructorAssignment_classTemplateId_fkey"
    FOREIGN KEY ("classTemplateId") REFERENCES "ClassTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegularInstructorAssignment"
    ADD CONSTRAINT "RegularInstructorAssignment_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "RegularInstructorAssignment"
    ADD CONSTRAINT "RegularInstructorAssignment_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
