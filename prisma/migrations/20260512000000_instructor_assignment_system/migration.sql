-- Migration: instructor_assignment_system
--
-- Phase 1 of the admin instructor-to-camp/workshop assignment system. All
-- changes are additive — existing instructor application, workshop proposal,
-- class offering, mentorship, and G&R flows are untouched.
--
-- Adds:
--   * Enum `OpportunityType`        (SUMMER_CAMP | PARTNER_PROGRAM | …)
--   * Enum `OpportunityStatus`      (DRAFT | OPEN | CONFIRMED | …)
--   * Enum `OpportunityUrgency`     (LOW | NORMAL | HIGH | URGENT)
--   * Enum `AssignmentRole`         (LEAD_INSTRUCTOR | CO_INSTRUCTOR | …)
--   * Enum `AssignmentStatus`       (SUGGESTED | PENDING | CONFIRMED | …)
--   * Table `WorkshopOpportunity`
--   * Table `InstructorAssignment`
--   * Foreign keys + indexes on all of the above
--
-- Reuses existing enums `DeliveryMode` and `CourseLevel` — no new variants.

-- 1) Enums (split into separate DO blocks so re-running is safe)
DO $$ BEGIN
  CREATE TYPE "OpportunityType" AS ENUM (
    'SUMMER_CAMP',
    'PARTNER_PROGRAM',
    'ONE_TIME_WORKSHOP',
    'MULTI_DAY_CAMP',
    'CHAPTER_CLASS_SERIES',
    'ONLINE_WORKSHOP',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpportunityStatus" AS ENUM (
    'DRAFT',
    'OPEN',
    'CONFIRMED',
    'COMPLETED',
    'CANCELLED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "OpportunityUrgency" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AssignmentRole" AS ENUM (
    'LEAD_INSTRUCTOR',
    'CO_INSTRUCTOR',
    'ASSISTANT',
    'SUBSTITUTE',
    'MENTOR'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AssignmentStatus" AS ENUM (
    'SUGGESTED',
    'PENDING',
    'CONFIRMED',
    'WAITLISTED',
    'DECLINED',
    'CANCELLED',
    'COMPLETED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2) Tables

CREATE TABLE IF NOT EXISTS "WorkshopOpportunity" (
  "id"                  TEXT PRIMARY KEY,
  "title"               TEXT NOT NULL,
  "partnerName"         TEXT,
  "type"                "OpportunityType"    NOT NULL DEFAULT 'PARTNER_PROGRAM',
  "status"              "OpportunityStatus"  NOT NULL DEFAULT 'OPEN',
  "urgency"             "OpportunityUrgency" NOT NULL DEFAULT 'NORMAL',
  "description"         TEXT,
  "deliveryMode"        "DeliveryMode"       NOT NULL DEFAULT 'IN_PERSON',
  "locationName"        TEXT,
  "locationCity"        TEXT,
  "locationState"       TEXT,
  "locationCountry"     TEXT,
  "startDate"           TIMESTAMP(3),
  "endDate"             TIMESTAMP(3),
  "fillByDate"          TIMESTAMP(3),
  "slotsNeeded"         INTEGER              NOT NULL DEFAULT 1,
  "ageGroup"            TEXT,
  "topicTags"           TEXT[]               NOT NULL DEFAULT ARRAY[]::TEXT[],
  "requiredCourseLevel" "CourseLevel",
  "chapterId"           TEXT,
  "ownerId"             TEXT,
  "partnerContactName"  TEXT,
  "partnerContactEmail" TEXT,
  "partnerContactPhone" TEXT,
  "internalNotes"       TEXT,
  "createdById"         TEXT                 NOT NULL,
  "createdAt"           TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)         NOT NULL,
  "archivedAt"          TIMESTAMP(3)
);

CREATE INDEX IF NOT EXISTS "WorkshopOpportunity_status_idx"     ON "WorkshopOpportunity"("status");
CREATE INDEX IF NOT EXISTS "WorkshopOpportunity_urgency_idx"    ON "WorkshopOpportunity"("urgency");
CREATE INDEX IF NOT EXISTS "WorkshopOpportunity_startDate_idx"  ON "WorkshopOpportunity"("startDate");
CREATE INDEX IF NOT EXISTS "WorkshopOpportunity_fillByDate_idx" ON "WorkshopOpportunity"("fillByDate");
CREATE INDEX IF NOT EXISTS "WorkshopOpportunity_chapterId_idx"  ON "WorkshopOpportunity"("chapterId");
CREATE INDEX IF NOT EXISTS "WorkshopOpportunity_ownerId_idx"    ON "WorkshopOpportunity"("ownerId");
CREATE INDEX IF NOT EXISTS "WorkshopOpportunity_type_idx"       ON "WorkshopOpportunity"("type");

CREATE TABLE IF NOT EXISTS "InstructorAssignment" (
  "id"                    TEXT PRIMARY KEY,
  "opportunityId"         TEXT               NOT NULL,
  "instructorId"          TEXT               NOT NULL,
  "proposalId"            TEXT,
  "role"                  "AssignmentRole"   NOT NULL DEFAULT 'LEAD_INSTRUCTOR',
  "status"                "AssignmentStatus" NOT NULL DEFAULT 'SUGGESTED',
  "assignedById"          TEXT,
  "assignedAt"            TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "instructorConfirmedAt" TIMESTAMP(3),
  "partnerConfirmedAt"    TIMESTAMP(3),
  "declinedAt"            TIMESTAMP(3),
  "cancelledAt"           TIMESTAMP(3),
  "completedAt"           TIMESTAMP(3),
  "startTime"             TIMESTAMP(3),
  "endTime"               TIMESTAMP(3),
  "internalNotes"         TEXT,
  "instructorNotes"       TEXT,
  "createdAt"             TIMESTAMP(3)       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"             TIMESTAMP(3)       NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorAssignment_opportunityId_instructorId_key"
  ON "InstructorAssignment"("opportunityId", "instructorId");
CREATE INDEX IF NOT EXISTS "InstructorAssignment_instructorId_idx" ON "InstructorAssignment"("instructorId");
CREATE INDEX IF NOT EXISTS "InstructorAssignment_status_idx"       ON "InstructorAssignment"("status");
CREATE INDEX IF NOT EXISTS "InstructorAssignment_proposalId_idx"   ON "InstructorAssignment"("proposalId");
CREATE INDEX IF NOT EXISTS "InstructorAssignment_assignedById_idx" ON "InstructorAssignment"("assignedById");

-- 3) Foreign keys (DO blocks so the migration is idempotent on partial reruns)

DO $$ BEGIN
  ALTER TABLE "WorkshopOpportunity"
    ADD CONSTRAINT "WorkshopOpportunity_chapterId_fkey"
    FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopOpportunity"
    ADD CONSTRAINT "WorkshopOpportunity_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopOpportunity"
    ADD CONSTRAINT "WorkshopOpportunity_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorAssignment"
    ADD CONSTRAINT "InstructorAssignment_opportunityId_fkey"
    FOREIGN KEY ("opportunityId") REFERENCES "WorkshopOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorAssignment"
    ADD CONSTRAINT "InstructorAssignment_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorAssignment"
    ADD CONSTRAINT "InstructorAssignment_proposalId_fkey"
    FOREIGN KEY ("proposalId") REFERENCES "WorkshopProposalSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorAssignment"
    ADD CONSTRAINT "InstructorAssignment_assignedById_fkey"
    FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
