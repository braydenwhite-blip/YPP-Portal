-- Migration: add_leadership_roles_contributions
-- Leadership Roles & Contributions (ENABLE_LEADERSHIP_ROLES).
--
-- Adds the concrete leadership-role layer for instructors: the flexible
-- LeadershipContribution record (role category + title + status + expected
-- level + weight + optional student/class/partner/program links + admin
-- owner + review visibility), its append-only
-- LeadershipContributionActivity log, and the first-class Student Advisor
-- workflow tables (StudentAdvisorAssignment, AdvisingNote,
-- AdvisingRecommendation). Advisor assignments back-link to the advisor's
-- STUDENT_ADVISOR contribution so advising work rolls up into reviews.
--
-- Four stable Postgres enums (LeadershipRoleCategory,
-- LeadershipContributionStatus, LeadershipExpectedLevel, AdvisingStatus)
-- model the role taxonomy and lifecycles. Activity kinds, advising note
-- kinds, and recommendation kinds/statuses are TEXT vocabularies validated
-- in lib/leadership/constants.ts, matching the repo's actionType /
-- partner.stage convention so they stay editable without a migration.
--
-- Purely additive: new tables + four new enums; the only relationship to
-- existing tables is virtual Prisma back-relations on User, ClassOffering
-- and Partner (the FK columns live on the new tables). Written idempotently
-- (CREATE TABLE / INDEX IF NOT EXISTS, DO-guarded enums + foreign keys) so
-- the whole migration is re-runnable.

-- CreateEnum: LeadershipRoleCategory
DO $$
BEGIN
  CREATE TYPE "LeadershipRoleCategory" AS ENUM (
    'STUDENT_ADVISOR',
    'INSTRUCTOR_MENTOR',
    'CURRICULUM_REVIEWER',
    'INTERVIEWER',
    'ONBOARDING_HELPER',
    'CLASS_QUALITY_REVIEWER',
    'STUDENT_PROJECT_MENTOR',
    'INSTRUCTION_COMMITTEE',
    'LEAD_INSTRUCTOR',
    'PARTNER_RELATIONSHIP_LEAD',
    'RECRUITMENT_LEAD',
    'TRAINING_DEVELOPMENT_LEAD',
    'STUDENT_SUCCESS_LEAD',
    'MENTORSHIP_PROGRAM_LEAD',
    'CURRICULUM_LEAD',
    'INITIATIVE_OWNER',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateEnum: LeadershipContributionStatus
DO $$
BEGIN
  CREATE TYPE "LeadershipContributionStatus" AS ENUM (
    'SUGGESTED',
    'ASSIGNED',
    'ACTIVE',
    'COMPLETED',
    'PAUSED',
    'NEEDS_ATTENTION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateEnum: LeadershipExpectedLevel
DO $$
BEGIN
  CREATE TYPE "LeadershipExpectedLevel" AS ENUM (
    'SENIOR_INSTRUCTOR',
    'LEAD_INSTRUCTOR',
    'EITHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateEnum: AdvisingStatus
DO $$
BEGIN
  CREATE TYPE "AdvisingStatus" AS ENUM (
    'ENGAGED',
    'NEEDS_ATTENTION',
    'INACTIVE',
    'READY_FOR_NEXT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable: LeadershipContribution (one leadership role held by an instructor)
CREATE TABLE IF NOT EXISTS "LeadershipContribution" (
    "id" TEXT NOT NULL,
    "instructorId" TEXT NOT NULL,
    "category" "LeadershipRoleCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "LeadershipContributionStatus" NOT NULL DEFAULT 'ASSIGNED',
    "expectedLevel" "LeadershipExpectedLevel" NOT NULL DEFAULT 'EITHER',
    "weight" INTEGER NOT NULL DEFAULT 2,
    "isOwnership" BOOLEAN NOT NULL DEFAULT false,
    "relatedUserId" TEXT,
    "relatedOfferingId" TEXT,
    "relatedPartnerId" TEXT,
    "relatedProgram" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "adminOwnerId" TEXT,
    "reviewVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadershipContribution_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadershipContribution_instructorId_status_idx" ON "LeadershipContribution"("instructorId", "status");
CREATE INDEX IF NOT EXISTS "LeadershipContribution_category_status_idx" ON "LeadershipContribution"("category", "status");
CREATE INDEX IF NOT EXISTS "LeadershipContribution_status_idx" ON "LeadershipContribution"("status");
CREATE INDEX IF NOT EXISTS "LeadershipContribution_adminOwnerId_idx" ON "LeadershipContribution"("adminOwnerId");
CREATE INDEX IF NOT EXISTS "LeadershipContribution_relatedPartnerId_idx" ON "LeadershipContribution"("relatedPartnerId");
CREATE INDEX IF NOT EXISTS "LeadershipContribution_relatedOfferingId_idx" ON "LeadershipContribution"("relatedOfferingId");
CREATE INDEX IF NOT EXISTS "LeadershipContribution_relatedUserId_idx" ON "LeadershipContribution"("relatedUserId");

-- CreateTable: LeadershipContributionActivity (append-only evidence log)
CREATE TABLE IF NOT EXISTS "LeadershipContributionActivity" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeadershipContributionActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeadershipContributionActivity_contributionId_createdAt_idx" ON "LeadershipContributionActivity"("contributionId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadershipContributionActivity_authorId_idx" ON "LeadershipContributionActivity"("authorId");

-- CreateTable: StudentAdvisorAssignment (one advisor's responsibility for one student)
CREATE TABLE IF NOT EXISTS "StudentAdvisorAssignment" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "contributionId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "advisingStatus" "AdvisingStatus" NOT NULL DEFAULT 'ENGAGED',
    "needsFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "nextSteps" TEXT,
    "lastCheckInAt" TIMESTAMP(3),
    "assignedById" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudentAdvisorAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StudentAdvisorAssignment_advisorId_studentId_key" ON "StudentAdvisorAssignment"("advisorId", "studentId");
CREATE INDEX IF NOT EXISTS "StudentAdvisorAssignment_studentId_isActive_idx" ON "StudentAdvisorAssignment"("studentId", "isActive");
CREATE INDEX IF NOT EXISTS "StudentAdvisorAssignment_advisorId_isActive_idx" ON "StudentAdvisorAssignment"("advisorId", "isActive");
CREATE INDEX IF NOT EXISTS "StudentAdvisorAssignment_isActive_needsFollowUp_idx" ON "StudentAdvisorAssignment"("isActive", "needsFollowUp");
CREATE INDEX IF NOT EXISTS "StudentAdvisorAssignment_isActive_advisingStatus_idx" ON "StudentAdvisorAssignment"("isActive", "advisingStatus");

-- CreateTable: AdvisingNote (advising note or logged check-in)
CREATE TABLE IF NOT EXISTS "AdvisingNote" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvisingNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdvisingNote_assignmentId_createdAt_idx" ON "AdvisingNote"("assignmentId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdvisingNote_authorId_idx" ON "AdvisingNote"("authorId");

-- CreateTable: AdvisingRecommendation (advisor-recommended next step)
CREATE TABLE IF NOT EXISTS "AdvisingRecommendation" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OPPORTUNITY',
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "href" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvisingRecommendation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AdvisingRecommendation_assignmentId_status_idx" ON "AdvisingRecommendation"("assignmentId", "status");
CREATE INDEX IF NOT EXISTS "AdvisingRecommendation_authorId_idx" ON "AdvisingRecommendation"("authorId");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS).
-- All FKs added after every table exists, so creation order is irrelevant.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContribution_instructorId_fkey') THEN
    ALTER TABLE "LeadershipContribution" ADD CONSTRAINT "LeadershipContribution_instructorId_fkey"
      FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContribution_relatedUserId_fkey') THEN
    ALTER TABLE "LeadershipContribution" ADD CONSTRAINT "LeadershipContribution_relatedUserId_fkey"
      FOREIGN KEY ("relatedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContribution_relatedOfferingId_fkey') THEN
    ALTER TABLE "LeadershipContribution" ADD CONSTRAINT "LeadershipContribution_relatedOfferingId_fkey"
      FOREIGN KEY ("relatedOfferingId") REFERENCES "ClassOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContribution_relatedPartnerId_fkey') THEN
    ALTER TABLE "LeadershipContribution" ADD CONSTRAINT "LeadershipContribution_relatedPartnerId_fkey"
      FOREIGN KEY ("relatedPartnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContribution_adminOwnerId_fkey') THEN
    ALTER TABLE "LeadershipContribution" ADD CONSTRAINT "LeadershipContribution_adminOwnerId_fkey"
      FOREIGN KEY ("adminOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContribution_createdById_fkey') THEN
    ALTER TABLE "LeadershipContribution" ADD CONSTRAINT "LeadershipContribution_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContributionActivity_contributionId_fkey') THEN
    ALTER TABLE "LeadershipContributionActivity" ADD CONSTRAINT "LeadershipContributionActivity_contributionId_fkey"
      FOREIGN KEY ("contributionId") REFERENCES "LeadershipContribution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadershipContributionActivity_authorId_fkey') THEN
    ALTER TABLE "LeadershipContributionActivity" ADD CONSTRAINT "LeadershipContributionActivity_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAdvisorAssignment_advisorId_fkey') THEN
    ALTER TABLE "StudentAdvisorAssignment" ADD CONSTRAINT "StudentAdvisorAssignment_advisorId_fkey"
      FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAdvisorAssignment_studentId_fkey') THEN
    ALTER TABLE "StudentAdvisorAssignment" ADD CONSTRAINT "StudentAdvisorAssignment_studentId_fkey"
      FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAdvisorAssignment_contributionId_fkey') THEN
    ALTER TABLE "StudentAdvisorAssignment" ADD CONSTRAINT "StudentAdvisorAssignment_contributionId_fkey"
      FOREIGN KEY ("contributionId") REFERENCES "LeadershipContribution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StudentAdvisorAssignment_assignedById_fkey') THEN
    ALTER TABLE "StudentAdvisorAssignment" ADD CONSTRAINT "StudentAdvisorAssignment_assignedById_fkey"
      FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvisingNote_assignmentId_fkey') THEN
    ALTER TABLE "AdvisingNote" ADD CONSTRAINT "AdvisingNote_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "StudentAdvisorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvisingNote_authorId_fkey') THEN
    ALTER TABLE "AdvisingNote" ADD CONSTRAINT "AdvisingNote_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvisingRecommendation_assignmentId_fkey') THEN
    ALTER TABLE "AdvisingRecommendation" ADD CONSTRAINT "AdvisingRecommendation_assignmentId_fkey"
      FOREIGN KEY ("assignmentId") REFERENCES "StudentAdvisorAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvisingRecommendation_authorId_fkey') THEN
    ALTER TABLE "AdvisingRecommendation" ADD CONSTRAINT "AdvisingRecommendation_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$$;
