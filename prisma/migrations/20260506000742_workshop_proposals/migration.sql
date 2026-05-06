-- Migration: workshop_proposals
--
-- Adds the Summer Workshop Instructor pathway data model. All changes are
-- additive; the standard instructor + Lesson Design Studio pipeline is
-- unchanged.
--
-- Adds:
--   * Enum `WorkshopProposalTemplateStatus`     (DRAFT | APPROVED | ARCHIVED)
--   * Enum `WorkshopProposalDifficulty`         (BEGINNER | INTERMEDIATE | ADVANCED)
--   * Enum `WorkshopProposalSourceType`         (CUSTOM_DESIGN | TEMPLATE_SELECTION)
--   * Enum `WorkshopProposalSubmissionStatus`   (DRAFT | SUBMITTED | IN_REVIEW |
--                                                CHANGES_REQUESTED | APPROVED | REJECTED)
--   * Enum `WorkshopProposalReviewRecommendation` (APPROVE | REQUEST_CHANGES | REJECT)
--   * Table `WorkshopProposalTemplate`
--   * Table `WorkshopProposalSubmission`         (one row per applicant — unique authorId)
--   * Table `WorkshopProposalReview`             (audit trail; many per submission)
--   * Foreign keys + indexes on all of the above

-- 1) Enums (split into their own DO blocks so re-running is safe)
DO $$ BEGIN
  CREATE TYPE "WorkshopProposalTemplateStatus" AS ENUM (
    'DRAFT',
    'APPROVED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkshopProposalDifficulty" AS ENUM (
    'BEGINNER',
    'INTERMEDIATE',
    'ADVANCED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkshopProposalSourceType" AS ENUM (
    'CUSTOM_DESIGN',
    'TEMPLATE_SELECTION'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkshopProposalSubmissionStatus" AS ENUM (
    'DRAFT',
    'SUBMITTED',
    'IN_REVIEW',
    'CHANGES_REQUESTED',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "WorkshopProposalReviewRecommendation" AS ENUM (
    'APPROVE',
    'REQUEST_CHANGES',
    'REJECT'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2) WorkshopProposalTemplate
CREATE TABLE IF NOT EXISTS "WorkshopProposalTemplate" (
  "id"                 TEXT                                NOT NULL,
  "title"              TEXT                                NOT NULL,
  "category"           TEXT                                NOT NULL,
  "targetAgeRange"     TEXT                                NOT NULL,
  "estimatedMinutes"   INTEGER                             NOT NULL DEFAULT 60,
  "description"        TEXT                                NOT NULL,
  "learningObjectives" TEXT[]                              NOT NULL DEFAULT ARRAY[]::TEXT[],
  "activityPlan"       TEXT                                NOT NULL,
  "materials"          TEXT[]                              NOT NULL DEFAULT ARRAY[]::TEXT[],
  "difficulty"         "WorkshopProposalDifficulty"        NOT NULL DEFAULT 'BEGINNER',
  "tags"               TEXT[]                              NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status"             "WorkshopProposalTemplateStatus"    NOT NULL DEFAULT 'DRAFT',
  "createdById"        TEXT                                NOT NULL,
  "updatedById"        TEXT,
  "createdAt"          TIMESTAMP(3)                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3)                        NOT NULL,
  "archivedAt"         TIMESTAMP(3),

  CONSTRAINT "WorkshopProposalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkshopProposalTemplate_status_idx"     ON "WorkshopProposalTemplate" ("status");
CREATE INDEX IF NOT EXISTS "WorkshopProposalTemplate_category_idx"   ON "WorkshopProposalTemplate" ("category");
CREATE INDEX IF NOT EXISTS "WorkshopProposalTemplate_difficulty_idx" ON "WorkshopProposalTemplate" ("difficulty");

DO $$ BEGIN
  ALTER TABLE "WorkshopProposalTemplate"
    ADD CONSTRAINT "WorkshopProposalTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopProposalTemplate"
    ADD CONSTRAINT "WorkshopProposalTemplate_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 3) WorkshopProposalSubmission
CREATE TABLE IF NOT EXISTS "WorkshopProposalSubmission" (
  "id"                TEXT                                NOT NULL,
  "authorId"          TEXT                                NOT NULL,
  "applicationId"     TEXT,
  "sourceType"        "WorkshopProposalSourceType"        NOT NULL,
  "customWorkshop"    JSONB,
  "templateId"        TEXT,
  "reflection"        JSONB,
  "status"            "WorkshopProposalSubmissionStatus"  NOT NULL DEFAULT 'DRAFT',
  "submittedAt"       TIMESTAMP(3),
  "inReviewAt"        TIMESTAMP(3),
  "reviewedAt"        TIMESTAMP(3),
  "reviewedById"      TEXT,
  "applicantFeedback" TEXT,
  "internalNotes"     TEXT,
  "createdAt"         TIMESTAMP(3)                        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3)                        NOT NULL,

  CONSTRAINT "WorkshopProposalSubmission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkshopProposalSubmission_authorId_key"   ON "WorkshopProposalSubmission" ("authorId");
CREATE INDEX        IF NOT EXISTS "WorkshopProposalSubmission_status_idx"     ON "WorkshopProposalSubmission" ("status");
CREATE INDEX        IF NOT EXISTS "WorkshopProposalSubmission_sourceType_idx" ON "WorkshopProposalSubmission" ("sourceType");
CREATE INDEX        IF NOT EXISTS "WorkshopProposalSubmission_templateId_idx" ON "WorkshopProposalSubmission" ("templateId");
CREATE INDEX        IF NOT EXISTS "WorkshopProposalSubmission_reviewedById_idx" ON "WorkshopProposalSubmission" ("reviewedById");

DO $$ BEGIN
  ALTER TABLE "WorkshopProposalSubmission"
    ADD CONSTRAINT "WorkshopProposalSubmission_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopProposalSubmission"
    ADD CONSTRAINT "WorkshopProposalSubmission_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "WorkshopProposalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopProposalSubmission"
    ADD CONSTRAINT "WorkshopProposalSubmission_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 4) WorkshopProposalReview (audit trail)
CREATE TABLE IF NOT EXISTS "WorkshopProposalReview" (
  "id"                       TEXT                                       NOT NULL,
  "submissionId"             TEXT                                       NOT NULL,
  "reviewerId"               TEXT                                       NOT NULL,
  "clarityRating"            INTEGER,
  "engagementRating"         INTEGER,
  "feasibilityRating"        INTEGER,
  "ageAppropriatenessRating" INTEGER,
  "preparednessRating"       INTEGER,
  "alignmentRating"          INTEGER,
  "overallRecommendation"    "WorkshopProposalReviewRecommendation",
  "applicantFeedback"        TEXT,
  "internalNote"             TEXT,
  "committed"                BOOLEAN                                    NOT NULL DEFAULT FALSE,
  "committedAt"              TIMESTAMP(3),
  "createdAt"                TIMESTAMP(3)                               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                TIMESTAMP(3)                               NOT NULL,

  CONSTRAINT "WorkshopProposalReview_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WorkshopProposalReview_submissionId_idx"          ON "WorkshopProposalReview" ("submissionId");
CREATE INDEX IF NOT EXISTS "WorkshopProposalReview_reviewerId_idx"            ON "WorkshopProposalReview" ("reviewerId");
CREATE INDEX IF NOT EXISTS "WorkshopProposalReview_overallRecommendation_idx" ON "WorkshopProposalReview" ("overallRecommendation");

DO $$ BEGIN
  ALTER TABLE "WorkshopProposalReview"
    ADD CONSTRAINT "WorkshopProposalReview_submissionId_fkey"
    FOREIGN KEY ("submissionId") REFERENCES "WorkshopProposalSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "WorkshopProposalReview"
    ADD CONSTRAINT "WorkshopProposalReview_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
