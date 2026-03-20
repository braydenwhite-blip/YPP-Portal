-- Migration: chapter_first_pathways
-- Adds chapter-run metadata for pathways, pathway-linked class offerings,
-- chapter-scoped pathway events, and cross-chapter fallback requests.

-- ============================================================
-- ENUMS
-- ============================================================

DO $$
BEGIN
  CREATE TYPE "ChapterPathwayRunStatus" AS ENUM (
    'NOT_OFFERED',
    'COMING_SOON',
    'ACTIVE',
    'PAUSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "PathwayFallbackRequestStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- ============================================================
-- TABLE CHANGES
-- ============================================================

ALTER TABLE "ClassOffering"
  ADD COLUMN "pathwayStepId" TEXT;

ALTER TABLE "ChapterPathway"
  ADD COLUMN "runStatus" "ChapterPathwayRunStatus" NOT NULL DEFAULT 'NOT_OFFERED',
  ADD COLUMN "ownerId" TEXT;

ALTER TABLE "PathwayEvent"
  ADD COLUMN "chapterId" TEXT,
  ADD COLUMN "pathwayStepId" TEXT;

CREATE TABLE "PathwayFallbackRequest" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "pathwayId" TEXT NOT NULL,
  "pathwayStepId" TEXT NOT NULL,
  "fromChapterId" TEXT,
  "toChapterId" TEXT,
  "targetOfferingId" TEXT,
  "status" "PathwayFallbackRequestStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PathwayFallbackRequest_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX "ClassOffering_chapterId_idx" ON "ClassOffering"("chapterId");
CREATE INDEX "ClassOffering_pathwayStepId_idx" ON "ClassOffering"("pathwayStepId");

CREATE INDEX "PathwayEvent_chapterId_idx" ON "PathwayEvent"("chapterId");
CREATE INDEX "PathwayEvent_pathwayStepId_idx" ON "PathwayEvent"("pathwayStepId");

CREATE INDEX "PathwayFallbackRequest_studentId_idx" ON "PathwayFallbackRequest"("studentId");
CREATE INDEX "PathwayFallbackRequest_pathwayId_idx" ON "PathwayFallbackRequest"("pathwayId");
CREATE INDEX "PathwayFallbackRequest_pathwayStepId_idx" ON "PathwayFallbackRequest"("pathwayStepId");
CREATE INDEX "PathwayFallbackRequest_targetOfferingId_idx" ON "PathwayFallbackRequest"("targetOfferingId");
CREATE INDEX "PathwayFallbackRequest_status_idx" ON "PathwayFallbackRequest"("status");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

ALTER TABLE "ClassOffering"
  ADD CONSTRAINT "ClassOffering_pathwayStepId_fkey"
  FOREIGN KEY ("pathwayStepId") REFERENCES "PathwayStep"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ChapterPathway"
  ADD CONSTRAINT "ChapterPathway_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayEvent"
  ADD CONSTRAINT "PathwayEvent_chapterId_fkey"
  FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayEvent"
  ADD CONSTRAINT "PathwayEvent_pathwayStepId_fkey"
  FOREIGN KEY ("pathwayStepId") REFERENCES "PathwayStep"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest"
  ADD CONSTRAINT "PathwayFallbackRequest_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest"
  ADD CONSTRAINT "PathwayFallbackRequest_pathwayId_fkey"
  FOREIGN KEY ("pathwayId") REFERENCES "Pathway"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest"
  ADD CONSTRAINT "PathwayFallbackRequest_pathwayStepId_fkey"
  FOREIGN KEY ("pathwayStepId") REFERENCES "PathwayStep"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest"
  ADD CONSTRAINT "PathwayFallbackRequest_fromChapterId_fkey"
  FOREIGN KEY ("fromChapterId") REFERENCES "Chapter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest"
  ADD CONSTRAINT "PathwayFallbackRequest_toChapterId_fkey"
  FOREIGN KEY ("toChapterId") REFERENCES "Chapter"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest"
  ADD CONSTRAINT "PathwayFallbackRequest_targetOfferingId_fkey"
  FOREIGN KEY ("targetOfferingId") REFERENCES "ClassOffering"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PathwayFallbackRequest"
  ADD CONSTRAINT "PathwayFallbackRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
