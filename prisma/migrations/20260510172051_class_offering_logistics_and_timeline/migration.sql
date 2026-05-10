-- Migration: class_offering_logistics_and_timeline
--
-- Adds in-person logistics fields to ClassOffering and an append-only
-- audit timeline (ClassOfferingTimelineEvent) for admin actions.
--
-- All statements are idempotent so the migration is safe to re-run
-- against a partial state.

-- ============================================================
-- 1. In-person logistics columns on ClassOffering
-- ============================================================

ALTER TABLE "ClassOffering"
  ADD COLUMN IF NOT EXISTS "room" TEXT,
  ADD COLUMN IF NOT EXISTS "arrivalInstructions" TEXT,
  ADD COLUMN IF NOT EXISTS "materialsList" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- ============================================================
-- 2. ClassOfferingTimelineKind enum
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "ClassOfferingTimelineKind" AS ENUM (
    'PROPOSAL_SUBMITTED',
    'PROPOSAL_APPROVED',
    'PROPOSAL_CHANGES_REQUESTED',
    'PROPOSAL_REJECTED',
    'PUBLISHED',
    'UNPUBLISHED',
    'ENROLLMENT_OPENED',
    'ENROLLMENT_CLOSED',
    'CANCELLED',
    'COMPLETED',
    'CAPACITY_CHANGED',
    'INSTRUCTOR_REASSIGNED',
    'WAITLIST_PROMOTION',
    'ENROLLMENT_STATUS_CHANGED',
    'NOTE'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 3. ClassOfferingTimelineEvent table
-- ============================================================

CREATE TABLE IF NOT EXISTS "ClassOfferingTimelineEvent" (
  "id"         TEXT                        NOT NULL,
  "offeringId" TEXT                        NOT NULL,
  "actorId"    TEXT,
  "kind"       "ClassOfferingTimelineKind" NOT NULL,
  "summary"    TEXT,
  "payload"    JSONB,
  "createdAt"  TIMESTAMP(3)                NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClassOfferingTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
DO $$ BEGIN
  ALTER TABLE "ClassOfferingTimelineEvent"
    ADD CONSTRAINT "ClassOfferingTimelineEvent_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "ClassOfferingTimelineEvent"
    ADD CONSTRAINT "ClassOfferingTimelineEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "ClassOfferingTimelineEvent_offeringId_createdAt_idx"
  ON "ClassOfferingTimelineEvent" ("offeringId", "createdAt");

CREATE INDEX IF NOT EXISTS "ClassOfferingTimelineEvent_kind_createdAt_idx"
  ON "ClassOfferingTimelineEvent" ("kind", "createdAt");

CREATE INDEX IF NOT EXISTS "ClassOfferingTimelineEvent_actorId_idx"
  ON "ClassOfferingTimelineEvent" ("actorId");
