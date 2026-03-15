-- Migration: add_chapter_pres_app_and_related_tables
-- Adds ChapterPresidentApplication, ApplicationFormTemplate/Field/Response,
-- ApplicationCohort, ChapterPresidentOnboarding, and ParentFeedback/Survey models.
-- Also adds cohortId to InstructorApplication.

-- ============================================================
-- ENUMS
-- ============================================================

DO $$
BEGIN
  CREATE TYPE "ChapterPresidentApplicationStatus" AS ENUM (
    'SUBMITTED',
    'UNDER_REVIEW',
    'INFO_REQUESTED',
    'INTERVIEW_SCHEDULED',
    'INTERVIEW_COMPLETED',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "ApplicationFormFieldType" AS ENUM (
    'SHORT_TEXT',
    'LONG_TEXT',
    'MULTIPLE_CHOICE',
    'RATING_SCALE',
    'FILE_UPLOAD'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "ApplicationCohortType" AS ENUM (
    'APPLICATION_CYCLE',
    'TRAINING'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "OnboardingStatus" AS ENUM (
    'NOT_STARTED',
    'IN_PROGRESS',
    'COMPLETED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "ParentFeedbackType" AS ENUM (
    'CHAPTER_FEEDBACK',
    'INSTRUCTOR_FEEDBACK',
    'PRESIDENT_FEEDBACK',
    'PROGRAM_FEEDBACK'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "SurveyStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PositionType" AS ENUM (
    'INSTRUCTOR',
    'CHAPTER_PRESIDENT',
    'MENTOR',
    'STAFF',
    'GLOBAL_ADMIN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================
-- APPLICATION COHORTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "ApplicationCohort" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "type"        "ApplicationCohortType" NOT NULL,
    "roleType"    "PositionType" NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationCohort_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationCohort_type_roleType_idx"
  ON "ApplicationCohort"("type", "roleType");

CREATE INDEX IF NOT EXISTS "ApplicationCohort_createdById_idx"
  ON "ApplicationCohort"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationCohort_createdById_fkey'
  ) THEN
    ALTER TABLE "ApplicationCohort"
      ADD CONSTRAINT "ApplicationCohort_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- APPLICATION FORM BUILDER
-- ============================================================

CREATE TABLE IF NOT EXISTS "ApplicationFormTemplate" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "roleType"  "PositionType" NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationFormTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationFormTemplate_roleType_isActive_idx"
  ON "ApplicationFormTemplate"("roleType", "isActive");

CREATE TABLE IF NOT EXISTS "ApplicationFormField" (
    "id"          TEXT NOT NULL,
    "templateId"  TEXT NOT NULL,
    "label"       TEXT NOT NULL,
    "fieldType"   "ApplicationFormFieldType" NOT NULL,
    "required"    BOOLEAN NOT NULL DEFAULT true,
    "placeholder" TEXT,
    "helpText"    TEXT,
    "options"     TEXT,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationFormField_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationFormField_templateId_sortOrder_idx"
  ON "ApplicationFormField"("templateId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationFormField_templateId_fkey'
  ) THEN
    ALTER TABLE "ApplicationFormField"
      ADD CONSTRAINT "ApplicationFormField_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "ApplicationFormTemplate"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- CHAPTER PRESIDENT APPLICATION
-- ============================================================

CREATE TABLE IF NOT EXISTS "ChapterPresidentApplication" (
    "id"                   TEXT NOT NULL,
    "applicantId"          TEXT NOT NULL,
    "chapterId"            TEXT,
    "status"               "ChapterPresidentApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "leadershipExperience" TEXT NOT NULL,
    "chapterVision"        TEXT NOT NULL,
    "availability"         TEXT NOT NULL,
    "reviewerId"           TEXT,
    "reviewerNotes"        TEXT,
    "infoRequest"          TEXT,
    "applicantResponse"    TEXT,
    "rejectionReason"      TEXT,
    "interviewScheduledAt" TIMESTAMP(3),
    "approvedAt"           TIMESTAMP(3),
    "rejectedAt"           TIMESTAMP(3),
    "cohortId"             TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterPresidentApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterPresidentApplication_applicantId_key"
  ON "ChapterPresidentApplication"("applicantId");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_status_idx"
  ON "ChapterPresidentApplication"("status");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_reviewerId_idx"
  ON "ChapterPresidentApplication"("reviewerId");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_chapterId_idx"
  ON "ChapterPresidentApplication"("chapterId");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_cohortId_idx"
  ON "ChapterPresidentApplication"("cohortId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentApplication_applicantId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentApplication"
      ADD CONSTRAINT "ChapterPresidentApplication_applicantId_fkey"
      FOREIGN KEY ("applicantId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentApplication_chapterId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentApplication"
      ADD CONSTRAINT "ChapterPresidentApplication_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentApplication_reviewerId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentApplication"
      ADD CONSTRAINT "ChapterPresidentApplication_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentApplication_cohortId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentApplication"
      ADD CONSTRAINT "ChapterPresidentApplication_cohortId_fkey"
      FOREIGN KEY ("cohortId") REFERENCES "ApplicationCohort"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- APPLICATION FORM RESPONSES
-- (references both InstructorApplication and ChapterPresidentApplication)
-- ============================================================

CREATE TABLE IF NOT EXISTS "ApplicationFormResponse" (
    "id"                            TEXT NOT NULL,
    "fieldId"                       TEXT NOT NULL,
    "instructorApplicationId"       TEXT,
    "chapterPresidentApplicationId" TEXT,
    "value"                         TEXT NOT NULL,
    "fileUrl"                       TEXT,
    "createdAt"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationFormResponse_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationFormResponse_fieldId_idx"
  ON "ApplicationFormResponse"("fieldId");

CREATE INDEX IF NOT EXISTS "ApplicationFormResponse_instructorApplicationId_idx"
  ON "ApplicationFormResponse"("instructorApplicationId");

CREATE INDEX IF NOT EXISTS "ApplicationFormResponse_chapterPresidentApplicationId_idx"
  ON "ApplicationFormResponse"("chapterPresidentApplicationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationFormResponse_fieldId_fkey'
  ) THEN
    ALTER TABLE "ApplicationFormResponse"
      ADD CONSTRAINT "ApplicationFormResponse_fieldId_fkey"
      FOREIGN KEY ("fieldId") REFERENCES "ApplicationFormField"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationFormResponse_instructorApplicationId_fkey'
  ) THEN
    ALTER TABLE "ApplicationFormResponse"
      ADD CONSTRAINT "ApplicationFormResponse_instructorApplicationId_fkey"
      FOREIGN KEY ("instructorApplicationId") REFERENCES "InstructorApplication"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ApplicationFormResponse_chapterPresidentApplicationId_fkey'
  ) THEN
    ALTER TABLE "ApplicationFormResponse"
      ADD CONSTRAINT "ApplicationFormResponse_chapterPresidentApplicationId_fkey"
      FOREIGN KEY ("chapterPresidentApplicationId") REFERENCES "ChapterPresidentApplication"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- ADD cohortId TO InstructorApplication
-- ============================================================

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "cohortId" TEXT;

CREATE INDEX IF NOT EXISTS "InstructorApplication_cohortId_idx"
  ON "InstructorApplication"("cohortId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'InstructorApplication_cohortId_fkey'
  ) THEN
    ALTER TABLE "InstructorApplication"
      ADD CONSTRAINT "InstructorApplication_cohortId_fkey"
      FOREIGN KEY ("cohortId") REFERENCES "ApplicationCohort"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- CHAPTER PRESIDENT ONBOARDING
-- ============================================================

CREATE TABLE IF NOT EXISTS "ChapterPresidentOnboarding" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "chapterId"         TEXT NOT NULL,
    "status"            "OnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "metTeam"           BOOLEAN NOT NULL DEFAULT false,
    "setChapterGoals"   BOOLEAN NOT NULL DEFAULT false,
    "reviewedResources" BOOLEAN NOT NULL DEFAULT false,
    "introMessageSent"  BOOLEAN NOT NULL DEFAULT false,
    "completedAt"       TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterPresidentOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChapterPresidentOnboarding_userId_key"
  ON "ChapterPresidentOnboarding"("userId");

CREATE INDEX IF NOT EXISTS "ChapterPresidentOnboarding_chapterId_idx"
  ON "ChapterPresidentOnboarding"("chapterId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentOnboarding_userId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentOnboarding"
      ADD CONSTRAINT "ChapterPresidentOnboarding_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentOnboarding_chapterId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentOnboarding"
      ADD CONSTRAINT "ChapterPresidentOnboarding_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- PARENT FEEDBACK & SURVEYS
-- ============================================================

CREATE TABLE IF NOT EXISTS "ParentChapterFeedback" (
    "id"           TEXT NOT NULL,
    "parentId"     TEXT NOT NULL,
    "chapterId"    TEXT NOT NULL,
    "type"         "ParentFeedbackType" NOT NULL,
    "targetUserId" TEXT,
    "rating"       INTEGER NOT NULL,
    "comments"     TEXT NOT NULL,
    "wouldRecommend" BOOLEAN,
    "isAnonymous"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentChapterFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ParentChapterFeedback_chapterId_type_idx"
  ON "ParentChapterFeedback"("chapterId", "type");

CREATE INDEX IF NOT EXISTS "ParentChapterFeedback_parentId_idx"
  ON "ParentChapterFeedback"("parentId");

CREATE INDEX IF NOT EXISTS "ParentChapterFeedback_targetUserId_idx"
  ON "ParentChapterFeedback"("targetUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentChapterFeedback_parentId_fkey'
  ) THEN
    ALTER TABLE "ParentChapterFeedback"
      ADD CONSTRAINT "ParentChapterFeedback_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentChapterFeedback_chapterId_fkey'
  ) THEN
    ALTER TABLE "ParentChapterFeedback"
      ADD CONSTRAINT "ParentChapterFeedback_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentChapterFeedback_targetUserId_fkey'
  ) THEN
    ALTER TABLE "ParentChapterFeedback"
      ADD CONSTRAINT "ParentChapterFeedback_targetUserId_fkey"
      FOREIGN KEY ("targetUserId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ParentSurvey" (
    "id"          TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "status"      "SurveyStatus" NOT NULL DEFAULT 'DRAFT',
    "chapterId"   TEXT,
    "opensAt"     TIMESTAMP(3),
    "closesAt"    TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentSurvey_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ParentSurvey_status_idx"
  ON "ParentSurvey"("status");

CREATE INDEX IF NOT EXISTS "ParentSurvey_chapterId_idx"
  ON "ParentSurvey"("chapterId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSurvey_chapterId_fkey'
  ) THEN
    ALTER TABLE "ParentSurvey"
      ADD CONSTRAINT "ParentSurvey_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSurvey_createdById_fkey'
  ) THEN
    ALTER TABLE "ParentSurvey"
      ADD CONSTRAINT "ParentSurvey_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ParentSurveyQuestion" (
    "id"        TEXT NOT NULL,
    "surveyId"  TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "fieldType" "ApplicationFormFieldType" NOT NULL,
    "required"  BOOLEAN NOT NULL DEFAULT true,
    "options"   TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParentSurveyQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ParentSurveyQuestion_surveyId_sortOrder_idx"
  ON "ParentSurveyQuestion"("surveyId", "sortOrder");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSurveyQuestion_surveyId_fkey'
  ) THEN
    ALTER TABLE "ParentSurveyQuestion"
      ADD CONSTRAINT "ParentSurveyQuestion_surveyId_fkey"
      FOREIGN KEY ("surveyId") REFERENCES "ParentSurvey"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ParentSurveyResponse" (
    "id"          TEXT NOT NULL,
    "surveyId"    TEXT NOT NULL,
    "parentId"    TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ParentSurveyResponse_surveyId_parentId_key"
  ON "ParentSurveyResponse"("surveyId", "parentId");

CREATE INDEX IF NOT EXISTS "ParentSurveyResponse_parentId_idx"
  ON "ParentSurveyResponse"("parentId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSurveyResponse_surveyId_fkey'
  ) THEN
    ALTER TABLE "ParentSurveyResponse"
      ADD CONSTRAINT "ParentSurveyResponse_surveyId_fkey"
      FOREIGN KEY ("surveyId") REFERENCES "ParentSurvey"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSurveyResponse_parentId_fkey'
  ) THEN
    ALTER TABLE "ParentSurveyResponse"
      ADD CONSTRAINT "ParentSurveyResponse_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "User"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ParentSurveyAnswer" (
    "id"         TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "value"      TEXT NOT NULL,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParentSurveyAnswer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ParentSurveyAnswer_responseId_idx"
  ON "ParentSurveyAnswer"("responseId");

CREATE INDEX IF NOT EXISTS "ParentSurveyAnswer_questionId_idx"
  ON "ParentSurveyAnswer"("questionId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSurveyAnswer_responseId_fkey'
  ) THEN
    ALTER TABLE "ParentSurveyAnswer"
      ADD CONSTRAINT "ParentSurveyAnswer_responseId_fkey"
      FOREIGN KEY ("responseId") REFERENCES "ParentSurveyResponse"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ParentSurveyAnswer_questionId_fkey'
  ) THEN
    ALTER TABLE "ParentSurveyAnswer"
      ADD CONSTRAINT "ParentSurveyAnswer_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "ParentSurveyQuestion"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
