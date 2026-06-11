-- Migration: knowledge_os_v2_foundation
-- Knowledge OS V2, Phase 1 (docs/ypp-organizational-knowledge-os-master-plan.md §26).
--
-- Three additive groups, no changes to existing rows:
--
-- 1. Partner Relationship Operations — PartnerContact, PartnerRequest,
--    PartnerAgreement, PartnerAgreementCondition. Status/kind/role columns are
--    TEXT vocabularies validated in lib/partners-constants.ts (the repo's
--    actionType / partner.stage convention); user references (ownerId,
--    createdById, userId) are intentionally FK-less, mirroring
--    PartnerNote.authorId. Deliberately NO PartnerMeeting table: partner
--    meetings reuse OfficerMeeting + relatedEntityType='PARTNER'.
--
-- 2. Advisor check-in scheduling — StudentAdvisorAssignment gains
--    checkInCadenceDays (default 14) + nextCheckInDueAt so "check-in overdue"
--    becomes a stored, queryable fact (plan §12).
--
-- 3. YPP Help Agent search infrastructure — SearchDocument (deterministic
--    entity index; display fields only, authorization stays in the
--    entity-360 loaders), SavedQuery (generalizes SavedActionView), and
--    RecentEntityView (recents for the palette + sidebar).
--
-- Written idempotently (CREATE TABLE / INDEX IF NOT EXISTS, ADD COLUMN IF NOT
-- EXISTS, DO-guarded foreign keys) so the whole migration is re-runnable.

-- ---------------------------------------------------------------------------
-- 1. Partner Relationship Operations
-- ---------------------------------------------------------------------------

-- CreateTable: PartnerContact
CREATE TABLE IF NOT EXISTS "PartnerContact" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "role" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerContact_partnerId_isPrimary_idx"
    ON "PartnerContact"("partnerId", "isPrimary");

DO $$
BEGIN
  ALTER TABLE "PartnerContact"
    ADD CONSTRAINT "PartnerContact_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: PartnerRequest
CREATE TABLE IF NOT EXISTS "PartnerRequest" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "ownerId" TEXT,
    "dueAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerRequest_partnerId_status_idx"
    ON "PartnerRequest"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "PartnerRequest_status_dueAt_idx"
    ON "PartnerRequest"("status", "dueAt");

DO $$
BEGIN
  ALTER TABLE "PartnerRequest"
    ADD CONSTRAINT "PartnerRequest_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: PartnerAgreement
CREATE TABLE IF NOT EXISTS "PartnerAgreement" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'MOU',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "renewalNoteAt" TIMESTAMP(3),
    "terms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAgreement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerAgreement_partnerId_status_idx"
    ON "PartnerAgreement"("partnerId", "status");

DO $$
BEGIN
  ALTER TABLE "PartnerAgreement"
    ADD CONSTRAINT "PartnerAgreement_partnerId_fkey"
    FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable: PartnerAgreementCondition
CREATE TABLE IF NOT EXISTS "PartnerAgreementCondition" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "satisfiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerAgreementCondition_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PartnerAgreementCondition_agreementId_status_idx"
    ON "PartnerAgreementCondition"("agreementId", "status");

DO $$
BEGIN
  ALTER TABLE "PartnerAgreementCondition"
    ADD CONSTRAINT "PartnerAgreementCondition_agreementId_fkey"
    FOREIGN KEY ("agreementId") REFERENCES "PartnerAgreement"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Advisor check-in scheduling
-- ---------------------------------------------------------------------------

ALTER TABLE "StudentAdvisorAssignment"
    ADD COLUMN IF NOT EXISTS "checkInCadenceDays" INTEGER NOT NULL DEFAULT 14;
ALTER TABLE "StudentAdvisorAssignment"
    ADD COLUMN IF NOT EXISTS "nextCheckInDueAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 3. YPP Help Agent search infrastructure
-- ---------------------------------------------------------------------------

-- CreateTable: SearchDocument
CREATE TABLE IF NOT EXISTS "SearchDocument" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "keywords" TEXT,
    "visibilityTier" TEXT NOT NULL DEFAULT 'OFFICER',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SearchDocument_entityType_entityId_key"
    ON "SearchDocument"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "SearchDocument_visibilityTier_entityType_idx"
    ON "SearchDocument"("visibilityTier", "entityType");

-- CreateTable: SavedQuery
CREATE TABLE IF NOT EXISTS "SavedQuery" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'PERSONAL',
    "name" TEXT NOT NULL,
    "targetPage" TEXT NOT NULL,
    "params" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedQuery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SavedQuery_ownerId_idx" ON "SavedQuery"("ownerId");
CREATE INDEX IF NOT EXISTS "SavedQuery_scope_idx" ON "SavedQuery"("scope");

-- CreateTable: RecentEntityView
CREATE TABLE IF NOT EXISTS "RecentEntityView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecentEntityView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RecentEntityView_userId_entityType_entityId_key"
    ON "RecentEntityView"("userId", "entityType", "entityId");
CREATE INDEX IF NOT EXISTS "RecentEntityView_userId_viewedAt_idx"
    ON "RecentEntityView"("userId", "viewedAt");
