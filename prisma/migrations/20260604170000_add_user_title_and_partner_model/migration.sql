-- Migration: add_user_title_and_partner_model
-- People Strategy Command Center — Phase 4 (Profiles & Classes integration).
--
--   1. User.title — a stored, human-readable job/role title (comment #6, #18).
--      Optional; getUserTitle() falls back to the admin-subtype label or a
--      formatted primaryRole when null.
--   2. Partner — a clean org/school partner table carrying a Relationship Lead,
--      with ClassOffering.partnerId linking a class to its Partner (comment #9).
--
-- Idempotent and additive (nullable column + new table + nullable FK), so safe
-- to re-run and low-risk for existing rows.

-- 1. User.title -------------------------------------------------------------
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "title" TEXT;

-- 2. Partner table ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Partner" (
  "id"                 TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "type"               TEXT,
  "website"            TEXT,
  "notes"              TEXT,
  "relationshipLeadId" TEXT,
  "archivedAt"         TIMESTAMP(3),
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Partner_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Partner_name_key" ON "Partner"("name");
CREATE INDEX IF NOT EXISTS "Partner_relationshipLeadId_idx" ON "Partner"("relationshipLeadId");
CREATE INDEX IF NOT EXISTS "Partner_archivedAt_idx" ON "Partner"("archivedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Partner_relationshipLeadId_fkey'
  ) THEN
    ALTER TABLE "Partner"
      ADD CONSTRAINT "Partner_relationshipLeadId_fkey"
      FOREIGN KEY ("relationshipLeadId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. ClassOffering.partnerId ------------------------------------------------
ALTER TABLE "ClassOffering" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;

CREATE INDEX IF NOT EXISTS "ClassOffering_partnerId_idx" ON "ClassOffering"("partnerId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ClassOffering_partnerId_fkey'
  ) THEN
    ALTER TABLE "ClassOffering"
      ADD CONSTRAINT "ClassOffering_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "Partner"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
