-- Migration: external_intake_and_manual_email
--
-- Adds first-class support for "external intake, internal review":
-- applicants who arrive through Google Forms, CSV import, or manual admin
-- entry feed into the same InstructorApplication / ChapterPresidentApplication
-- / Application records that portal-native applicants do, so the existing
-- review, interview, rubric, and chair-decision pipelines apply uniformly.
--
-- All changes are strictly additive:
--   * New enums: ApplicationSource, ManualEmailKind, ManualEmailStatus
--   * New columns on InstructorApplication / ChapterPresidentApplication /
--     Application: source (default PORTAL), externalSubmittedAt,
--     externalImportedAt, externalResponseUrl, externalAnswersCopy,
--     internalNotes, importedById
--   * New table ManualEmailTask for manual email tracking (no auto-send)
--
-- Existing rows default to source = PORTAL so behavior is unchanged for
-- portal-native applications. Re-running this migration is idempotent.

-- 1) Enums -------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "ApplicationSource" AS ENUM (
    'PORTAL',
    'GOOGLE_FORMS',
    'CSV_IMPORT',
    'MANUAL_ADMIN_ENTRY'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ManualEmailKind" AS ENUM (
    'APPLICATION_CONFIRMATION',
    'MISSING_INFORMATION_REQUEST',
    'REVIEW_UPDATE',
    'INTERVIEW_INVITATION',
    'INTERVIEW_CONFIRMATION',
    'INTERVIEW_REMINDER',
    'POST_INTERVIEW_FOLLOWUP',
    'ACCEPTANCE',
    'WAITLIST',
    'REJECTION',
    'WITHDRAWAL_CONFIRMATION',
    'GENERAL_FOLLOWUP'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ManualEmailStatus" AS ENUM (
    'PENDING',
    'SENT',
    'NOT_NEEDED',
    'HANDLED_EXTERNALLY'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2) InstructorApplication: source + external intake fields -----------------

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "source" "ApplicationSource" NOT NULL DEFAULT 'PORTAL';

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "externalSubmittedAt" TIMESTAMP(3);

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "externalImportedAt" TIMESTAMP(3);

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "externalResponseUrl" TEXT;

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "externalAnswersCopy" TEXT;

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "importedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "InstructorApplication"
    ADD CONSTRAINT "InstructorApplication_importedById_fkey"
    FOREIGN KEY ("importedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "InstructorApplication_source_idx"
  ON "InstructorApplication"("source");

CREATE INDEX IF NOT EXISTS "InstructorApplication_importedById_idx"
  ON "InstructorApplication"("importedById");

-- 3) ChapterPresidentApplication: source + external intake fields -----------

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "source" "ApplicationSource" NOT NULL DEFAULT 'PORTAL';

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "externalSubmittedAt" TIMESTAMP(3);

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "externalImportedAt" TIMESTAMP(3);

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "externalResponseUrl" TEXT;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "externalAnswersCopy" TEXT;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "importedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "ChapterPresidentApplication"
    ADD CONSTRAINT "ChapterPresidentApplication_importedById_fkey"
    FOREIGN KEY ("importedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_source_idx"
  ON "ChapterPresidentApplication"("source");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_importedById_idx"
  ON "ChapterPresidentApplication"("importedById");

-- 4) Application (generic positions): source + external intake fields -------

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "source" "ApplicationSource" NOT NULL DEFAULT 'PORTAL';

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "externalSubmittedAt" TIMESTAMP(3);

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "externalImportedAt" TIMESTAMP(3);

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "externalResponseUrl" TEXT;

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "externalAnswersCopy" TEXT;

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

ALTER TABLE "Application"
  ADD COLUMN IF NOT EXISTS "importedById" TEXT;

DO $$ BEGIN
  ALTER TABLE "Application"
    ADD CONSTRAINT "Application_importedById_fkey"
    FOREIGN KEY ("importedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "Application_source_idx"
  ON "Application"("source");

CREATE INDEX IF NOT EXISTS "Application_importedById_idx"
  ON "Application"("importedById");

-- 5) ManualEmailTask --------------------------------------------------------

CREATE TABLE IF NOT EXISTS "ManualEmailTask" (
  "id"                            TEXT NOT NULL,
  "instructorApplicationId"       TEXT,
  "chapterPresidentApplicationId" TEXT,
  "genericApplicationId"          TEXT,
  "kind"                          "ManualEmailKind" NOT NULL,
  "status"                        "ManualEmailStatus" NOT NULL DEFAULT 'PENDING',
  "suggestedSubject"              TEXT,
  "suggestedBody"                 TEXT,
  "notes"                         TEXT,
  "markedSentAt"                  TIMESTAMP(3),
  "markedSentById"                TEXT,
  "createdById"                   TEXT,
  "createdAt"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                     TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManualEmailTask_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ManualEmailTask"
    ADD CONSTRAINT "ManualEmailTask_instructorApplicationId_fkey"
    FOREIGN KEY ("instructorApplicationId") REFERENCES "InstructorApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ManualEmailTask"
    ADD CONSTRAINT "ManualEmailTask_chapterPresidentApplicationId_fkey"
    FOREIGN KEY ("chapterPresidentApplicationId") REFERENCES "ChapterPresidentApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ManualEmailTask"
    ADD CONSTRAINT "ManualEmailTask_genericApplicationId_fkey"
    FOREIGN KEY ("genericApplicationId") REFERENCES "Application"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ManualEmailTask"
    ADD CONSTRAINT "ManualEmailTask_markedSentById_fkey"
    FOREIGN KEY ("markedSentById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ManualEmailTask"
    ADD CONSTRAINT "ManualEmailTask_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "ManualEmailTask_instructorApplicationId_status_idx"
  ON "ManualEmailTask"("instructorApplicationId", "status");

CREATE INDEX IF NOT EXISTS "ManualEmailTask_chapterPresidentApplicationId_status_idx"
  ON "ManualEmailTask"("chapterPresidentApplicationId", "status");

CREATE INDEX IF NOT EXISTS "ManualEmailTask_genericApplicationId_status_idx"
  ON "ManualEmailTask"("genericApplicationId", "status");

CREATE INDEX IF NOT EXISTS "ManualEmailTask_kind_idx" ON "ManualEmailTask"("kind");
CREATE INDEX IF NOT EXISTS "ManualEmailTask_status_idx" ON "ManualEmailTask"("status");
CREATE INDEX IF NOT EXISTS "ManualEmailTask_markedSentById_idx" ON "ManualEmailTask"("markedSentById");
CREATE INDEX IF NOT EXISTS "ManualEmailTask_createdById_idx" ON "ManualEmailTask"("createdById");
