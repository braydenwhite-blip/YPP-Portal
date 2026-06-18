-- Migration: org_person_spine
-- Phase 3 of the Roles/Mentorship/Reviews/Access plan
-- (docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
--
-- Persists the org authority spine so it survives promotions and history:
--   * User.internalLevel / ladder / canonicalTitle / cohortId (all nullable)
--   * Cohort (people cohorts)
--   * Committee + CommitteeMembership (general committees, separate from titles)
--
-- Fully additive, nullable, and idempotent. No existing rows are modified here;
-- the operator backfill (scripts/backfill-org-authority.ts) populates the new
-- columns afterwards.

-- Ladder enum -----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrgLadder') THEN
    CREATE TYPE "OrgLadder" AS ENUM ('INSTRUCTION', 'LEADERSHIP');
  END IF;
END $$;

-- User columns ----------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "internalLevel" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "ladder" "OrgLadder";
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "canonicalTitle" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cohortId" TEXT;

-- Cohort ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Cohort" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Cohort_name_key" ON "Cohort"("name");

-- Committee -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Committee" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT,
  "kind" TEXT,
  "description" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Committee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Committee_name_key" ON "Committee"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Committee_slug_key" ON "Committee"("slug");
CREATE INDEX IF NOT EXISTS "Committee_archivedAt_idx" ON "Committee"("archivedAt");

-- CommitteeMembership ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "CommitteeMembership" (
  "id" TEXT NOT NULL,
  "committeeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommitteeMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CommitteeMembership_committeeId_userId_key"
  ON "CommitteeMembership"("committeeId", "userId");
CREATE INDEX IF NOT EXISTS "CommitteeMembership_userId_isActive_idx"
  ON "CommitteeMembership"("userId", "isActive");
CREATE INDEX IF NOT EXISTS "CommitteeMembership_committeeId_isActive_idx"
  ON "CommitteeMembership"("committeeId", "isActive");

-- Foreign keys ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_cohortId_fkey') THEN
    ALTER TABLE "User"
      ADD CONSTRAINT "User_cohortId_fkey"
      FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommitteeMembership_committeeId_fkey') THEN
    ALTER TABLE "CommitteeMembership"
      ADD CONSTRAINT "CommitteeMembership_committeeId_fkey"
      FOREIGN KEY ("committeeId") REFERENCES "Committee"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommitteeMembership_userId_fkey') THEN
    ALTER TABLE "CommitteeMembership"
      ADD CONSTRAINT "CommitteeMembership_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
