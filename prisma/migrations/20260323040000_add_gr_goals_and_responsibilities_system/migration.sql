-- Migration: add_gr_goals_and_responsibilities_system
-- Creates all G&R (Goals & Responsibilities) tables that are referenced in the
-- Prisma schema but missing from migration history.

-- ============================================================
-- ENUMS
-- ============================================================

DO $$
BEGIN
  CREATE TYPE "GRTimePhase" AS ENUM ('FIRST_MONTH', 'FIRST_QUARTER', 'FULL_YEAR');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "GRDocumentStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "GRGoalChangeStatus" AS ENUM ('PROPOSED', 'APPROVED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "GRBulkUpdatePolicy" AS ENUM ('NEW_ONLY', 'IMMEDIATE_ALL', 'NEXT_CYCLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "GRTemplateStatus" AS ENUM ('GR_DRAFT', 'IN_REVIEW', 'GR_APPROVED', 'GR_ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "KPISourceType" AS ENUM (
    'AUTO_PARENT_FEEDBACK',
    'AUTO_TRAINING_COMPLETION',
    'AUTO_COMMUNITY_ENGAGEMENT',
    'AUTO_ATTENDANCE',
    'MANUAL_MENTOR_RATING',
    'MANUAL_QUALITATIVE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "OpsRuleSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "OpsRuleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================
-- OPS RULES & VIOLATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "OpsRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "severity" "OpsRuleSeverity" NOT NULL DEFAULT 'WARNING',
    "status" "OpsRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "metricKey" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "chapterId" TEXT,
    "escalateToRoles" TEXT[] NOT NULL,
    "autoNotify" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OpsRule_status_idx" ON "OpsRule"("status");
CREATE INDEX IF NOT EXISTS "OpsRule_metricKey_idx" ON "OpsRule"("metricKey");
CREATE INDEX IF NOT EXISTS "OpsRule_chapterId_idx" ON "OpsRule"("chapterId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OpsRule_chapterId_fkey') THEN
    ALTER TABLE "OpsRule" ADD CONSTRAINT "OpsRule_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OpsRule_createdById_fkey') THEN
    ALTER TABLE "OpsRule" ADD CONSTRAINT "OpsRule_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "OpsRuleViolation" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsRuleViolation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OpsRuleViolation_ruleId_idx" ON "OpsRuleViolation"("ruleId");
CREATE INDEX IF NOT EXISTS "OpsRuleViolation_chapterId_idx" ON "OpsRuleViolation"("chapterId");
CREATE INDEX IF NOT EXISTS "OpsRuleViolation_acknowledged_idx" ON "OpsRuleViolation"("acknowledged");
CREATE INDEX IF NOT EXISTS "OpsRuleViolation_snapshotDate_idx" ON "OpsRuleViolation"("snapshotDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OpsRuleViolation_ruleId_fkey') THEN
    ALTER TABLE "OpsRuleViolation" ADD CONSTRAINT "OpsRuleViolation_ruleId_fkey"
      FOREIGN KEY ("ruleId") REFERENCES "OpsRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OpsRuleViolation_chapterId_fkey') THEN
    ALTER TABLE "OpsRuleViolation" ADD CONSTRAINT "OpsRuleViolation_chapterId_fkey"
      FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- GR SHARED RESOURCE LIBRARY
-- ============================================================

CREATE TABLE IF NOT EXISTS "GRResource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "isUpload" BOOLEAN NOT NULL DEFAULT false,
    "fileUploadId" TEXT,
    "tags" TEXT[] NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRResource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRResource_tags_idx" ON "GRResource" USING GIN ("tags");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRResource_fileUploadId_fkey') THEN
    ALTER TABLE "GRResource" ADD CONSTRAINT "GRResource_fileUploadId_fkey"
      FOREIGN KEY ("fileUploadId") REFERENCES "FileUpload"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRResource_createdById_fkey') THEN
    ALTER TABLE "GRResource" ADD CONSTRAINT "GRResource_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- GR TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS "GRTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "roleType" "MenteeRoleType" NOT NULL,
    "officerPosition" TEXT,
    "roleMission" TEXT NOT NULL,
    "status" "GRTemplateStatus" NOT NULL DEFAULT 'GR_DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "lastEditedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRTemplate_roleType_idx" ON "GRTemplate"("roleType");
CREATE INDEX IF NOT EXISTS "GRTemplate_officerPosition_idx" ON "GRTemplate"("officerPosition");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplate_createdById_fkey') THEN
    ALTER TABLE "GRTemplate" ADD CONSTRAINT "GRTemplate_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplate_lastEditedById_fkey') THEN
    ALTER TABLE "GRTemplate" ADD CONSTRAINT "GRTemplate_lastEditedById_fkey"
      FOREIGN KEY ("lastEditedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- GR TEMPLATE CHILD TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "GRTemplateGoal" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timePhase" "GRTimePhase" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRTemplateGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRTemplateGoal_templateId_timePhase_idx" ON "GRTemplateGoal"("templateId", "timePhase");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplateGoal_templateId_fkey') THEN
    ALTER TABLE "GRTemplateGoal" ADD CONSTRAINT "GRTemplateGoal_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "GRTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRTemplateSuccessCriteria" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "timePhase" "GRTimePhase" NOT NULL,
    "criteria" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRTemplateSuccessCriteria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRTemplateSuccessCriteria_templateId_timePhase_key"
  ON "GRTemplateSuccessCriteria"("templateId", "timePhase");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplateSuccessCriteria_templateId_fkey') THEN
    ALTER TABLE "GRTemplateSuccessCriteria" ADD CONSTRAINT "GRTemplateSuccessCriteria_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "GRTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRTemplateResource" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GRTemplateResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRTemplateResource_templateId_resourceId_key"
  ON "GRTemplateResource"("templateId", "resourceId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplateResource_templateId_fkey') THEN
    ALTER TABLE "GRTemplateResource" ADD CONSTRAINT "GRTemplateResource_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "GRTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplateResource_resourceId_fkey') THEN
    ALTER TABLE "GRTemplateResource" ADD CONSTRAINT "GRTemplateResource_resourceId_fkey"
      FOREIGN KEY ("resourceId") REFERENCES "GRResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRTemplateComment" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRTemplateComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRTemplateComment_templateId_idx" ON "GRTemplateComment"("templateId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplateComment_templateId_fkey') THEN
    ALTER TABLE "GRTemplateComment" ADD CONSTRAINT "GRTemplateComment_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "GRTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplateComment_authorId_fkey') THEN
    ALTER TABLE "GRTemplateComment" ADD CONSTRAINT "GRTemplateComment_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedBy" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRTemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRTemplateVersion_templateId_version_key"
  ON "GRTemplateVersion"("templateId", "version");

CREATE INDEX IF NOT EXISTS "GRTemplateVersion_templateId_idx" ON "GRTemplateVersion"("templateId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRTemplateVersion_templateId_fkey') THEN
    ALTER TABLE "GRTemplateVersion" ADD CONSTRAINT "GRTemplateVersion_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "GRTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- GR KPI DEFINITIONS (linked to template goals)
-- ============================================================

CREATE TABLE IF NOT EXISTS "GRKPIDefinition" (
    "id" TEXT NOT NULL,
    "templateGoalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceType" "KPISourceType" NOT NULL,
    "targetValue" TEXT,
    "unit" TEXT,

    CONSTRAINT "GRKPIDefinition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRKPIDefinition_templateGoalId_idx" ON "GRKPIDefinition"("templateGoalId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRKPIDefinition_templateGoalId_fkey') THEN
    ALTER TABLE "GRKPIDefinition" ADD CONSTRAINT "GRKPIDefinition_templateGoalId_fkey"
      FOREIGN KEY ("templateGoalId") REFERENCES "GRTemplateGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- GR DOCUMENTS (per-person instantiation)
-- ============================================================

CREATE TABLE IF NOT EXISTS "GRDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mentorshipId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "roleMission" TEXT NOT NULL,
    "mentorInfo" JSONB,
    "officerInfo" JSONB,
    "roleStartDate" TIMESTAMP(3) NOT NULL,
    "status" "GRDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRDocument_userId_templateId_key"
  ON "GRDocument"("userId", "templateId");

CREATE INDEX IF NOT EXISTS "GRDocument_userId_idx" ON "GRDocument"("userId");
CREATE INDEX IF NOT EXISTS "GRDocument_mentorshipId_idx" ON "GRDocument"("mentorshipId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocument_userId_fkey') THEN
    ALTER TABLE "GRDocument" ADD CONSTRAINT "GRDocument_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocument_mentorshipId_fkey') THEN
    ALTER TABLE "GRDocument" ADD CONSTRAINT "GRDocument_mentorshipId_fkey"
      FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocument_templateId_fkey') THEN
    ALTER TABLE "GRDocument" ADD CONSTRAINT "GRDocument_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "GRTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- GR DOCUMENT CHILD TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS "GRDocumentGoal" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "templateGoalId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "timePhase" "GRTimePhase" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRDocumentGoal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRDocumentGoal_documentId_timePhase_idx" ON "GRDocumentGoal"("documentId", "timePhase");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentGoal_documentId_fkey') THEN
    ALTER TABLE "GRDocumentGoal" ADD CONSTRAINT "GRDocumentGoal_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "GRDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentGoal_templateGoalId_fkey') THEN
    ALTER TABLE "GRDocumentGoal" ADD CONSTRAINT "GRDocumentGoal_templateGoalId_fkey"
      FOREIGN KEY ("templateGoalId") REFERENCES "GRTemplateGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRDocumentSuccessCriteria" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "templateCriteriaId" TEXT,
    "timePhase" "GRTimePhase" NOT NULL,
    "criteria" TEXT NOT NULL,

    CONSTRAINT "GRDocumentSuccessCriteria_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRDocumentSuccessCriteria_documentId_timePhase_key"
  ON "GRDocumentSuccessCriteria"("documentId", "timePhase");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentSuccessCriteria_documentId_fkey') THEN
    ALTER TABLE "GRDocumentSuccessCriteria" ADD CONSTRAINT "GRDocumentSuccessCriteria_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "GRDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentSuccessCriteria_templateCriteriaId_fkey') THEN
    ALTER TABLE "GRDocumentSuccessCriteria" ADD CONSTRAINT "GRDocumentSuccessCriteria_templateCriteriaId_fkey"
      FOREIGN KEY ("templateCriteriaId") REFERENCES "GRTemplateSuccessCriteria"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRDocumentResource" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "GRDocumentResource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRDocumentResource_documentId_resourceId_key"
  ON "GRDocumentResource"("documentId", "resourceId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentResource_documentId_fkey') THEN
    ALTER TABLE "GRDocumentResource" ADD CONSTRAINT "GRDocumentResource_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "GRDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentResource_resourceId_fkey') THEN
    ALTER TABLE "GRDocumentResource" ADD CONSTRAINT "GRDocumentResource_resourceId_fkey"
      FOREIGN KEY ("resourceId") REFERENCES "GRResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRPlanOfAction" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "cycleNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "reflectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GRPlanOfAction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRPlanOfAction_documentId_cycleNumber_key"
  ON "GRPlanOfAction"("documentId", "cycleNumber");

CREATE INDEX IF NOT EXISTS "GRPlanOfAction_documentId_idx" ON "GRPlanOfAction"("documentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRPlanOfAction_documentId_fkey') THEN
    ALTER TABLE "GRPlanOfAction" ADD CONSTRAINT "GRPlanOfAction_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "GRDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRGoalChange" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "proposedById" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "goalId" TEXT,
    "proposedData" JSONB NOT NULL,
    "reason" TEXT,
    "status" "GRGoalChangeStatus" NOT NULL DEFAULT 'PROPOSED',
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRGoalChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRGoalChange_documentId_status_idx" ON "GRGoalChange"("documentId", "status");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRGoalChange_documentId_fkey') THEN
    ALTER TABLE "GRGoalChange" ADD CONSTRAINT "GRGoalChange_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "GRDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRGoalChange_proposedById_fkey') THEN
    ALTER TABLE "GRGoalChange" ADD CONSTRAINT "GRGoalChange_proposedById_fkey"
      FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRGoalChange_reviewedById_fkey') THEN
    ALTER TABLE "GRGoalChange" ADD CONSTRAINT "GRGoalChange_reviewedById_fkey"
      FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "GRDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changedById" TEXT NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GRDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GRDocumentVersion_documentId_version_key"
  ON "GRDocumentVersion"("documentId", "version");

CREATE INDEX IF NOT EXISTS "GRDocumentVersion_documentId_idx" ON "GRDocumentVersion"("documentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentVersion_documentId_fkey') THEN
    ALTER TABLE "GRDocumentVersion" ADD CONSTRAINT "GRDocumentVersion_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "GRDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRDocumentVersion_changedById_fkey') THEN
    ALTER TABLE "GRDocumentVersion" ADD CONSTRAINT "GRDocumentVersion_changedById_fkey"
      FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;

-- ============================================================
-- GR KPI VALUES (per-person measurements)
-- ============================================================

CREATE TABLE IF NOT EXISTS "GRKPIValue" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "definitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "GRKPIValue_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GRKPIValue_goalId_idx" ON "GRKPIValue"("goalId");
CREATE INDEX IF NOT EXISTS "GRKPIValue_definitionId_idx" ON "GRKPIValue"("definitionId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRKPIValue_goalId_fkey') THEN
    ALTER TABLE "GRKPIValue" ADD CONSTRAINT "GRKPIValue_goalId_fkey"
      FOREIGN KEY ("goalId") REFERENCES "GRDocumentGoal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GRKPIValue_definitionId_fkey') THEN
    ALTER TABLE "GRKPIValue" ADD CONSTRAINT "GRKPIValue_definitionId_fkey"
      FOREIGN KEY ("definitionId") REFERENCES "GRKPIDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
