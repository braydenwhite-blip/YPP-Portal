-- Migration: journey_editor_init
-- Adds the Journey/JourneyVersion layer above InteractiveJourney so admins
-- can draft, version, gate, assign, audit, and roll back interactive
-- training journeys without invalidating learner progress.
--
-- See docs/admin-journey-editor-plan.md.
--
-- Strategy:
--   1. Create new enums (JourneyVersionStatus, JourneyAudienceRole, JourneyGateKind).
--   2. Create new tables (Journey, JourneyVersion, JourneyGate,
--      JourneyAssignmentRule, JourneyAuditLog).
--   3. Add nullable `journeyVersionId` columns to InteractiveBeat and
--      InteractiveJourneyCompletion + foreign keys + indexes.
--   4. Replace the existing UNIQUE(journeyId, sortOrder) on InteractiveBeat
--      with a non-unique index, and add UNIQUE(journeyVersionId, sortOrder)
--      so a single Journey can hold multiple versions of the same sortOrder
--      across DRAFT/PUBLISHED snapshots without collision.
--   5. Backfill: for every existing InteractiveJourney, insert one Journey
--      (slug derived from TrainingModule.contentKey) and one PUBLISHED
--      JourneyVersion (versionNumber=1), then point existing beats and
--      completions at that version.
--
-- All steps are idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`,
-- `WHERE journeyVersionId IS NULL`). Re-running the migration is safe.

-- ============================================================
-- 1. Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "JourneyVersionStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED',
    'ARCHIVED'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "JourneyAudienceRole" AS ENUM (
    'STUDENT',
    'INSTRUCTOR',
    'CHAPTER_PRESIDENT',
    'CHAPTER_LEAD',
    'LEADERSHIP',
    'SUMMER_WORKSHOP_INSTRUCTOR',
    'MENTOR'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "JourneyGateKind" AS ENUM (
    'READINESS_CHECK',
    'BEAT_COMPLETE',
    'MODULE_COMPLETE',
    'SCORE_THRESHOLD'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. Table: Journey
-- ============================================================

CREATE TABLE IF NOT EXISTS "Journey" (
  "id"          TEXT         NOT NULL,
  "slug"        TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "description" TEXT,
  "archivedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Journey_slug_key"
  ON "Journey" ("slug");

CREATE INDEX IF NOT EXISTS "Journey_archivedAt_idx"
  ON "Journey" ("archivedAt");

-- ============================================================
-- 3. Table: JourneyVersion
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyVersion" (
  "id"               TEXT                   NOT NULL,
  "journeyId"        TEXT                   NOT NULL,
  "versionNumber"    INTEGER                NOT NULL,
  "status"           "JourneyVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"            TEXT,
  "estimatedMinutes" INTEGER                NOT NULL DEFAULT 0,
  "passScorePct"     INTEGER                NOT NULL DEFAULT 80,
  "strictMode"       BOOLEAN                NOT NULL DEFAULT false,
  "moduleId"         TEXT,
  "publishedAt"      TIMESTAMP(3),
  "publishedById"    TEXT,
  "createdById"      TEXT,
  "createdAt"        TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JourneyVersion_journeyId_versionNumber_key"
  ON "JourneyVersion" ("journeyId", "versionNumber");

CREATE INDEX IF NOT EXISTS "JourneyVersion_status_journeyId_idx"
  ON "JourneyVersion" ("status", "journeyId");

CREATE INDEX IF NOT EXISTS "JourneyVersion_moduleId_idx"
  ON "JourneyVersion" ("moduleId");

ALTER TABLE "JourneyVersion"
  DROP CONSTRAINT IF EXISTS "JourneyVersion_journeyId_fkey";
ALTER TABLE "JourneyVersion"
  ADD CONSTRAINT "JourneyVersion_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "Journey"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JourneyVersion"
  DROP CONSTRAINT IF EXISTS "JourneyVersion_moduleId_fkey";
ALTER TABLE "JourneyVersion"
  ADD CONSTRAINT "JourneyVersion_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 4. Table: JourneyGate
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyGate" (
  "id"               TEXT              NOT NULL,
  "journeyVersionId" TEXT              NOT NULL,
  "kind"             "JourneyGateKind" NOT NULL,
  "targetRef"        TEXT              NOT NULL,
  "requiredRef"      TEXT              NOT NULL,
  "threshold"        INTEGER,
  "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyGate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JourneyGate_journeyVersionId_idx"
  ON "JourneyGate" ("journeyVersionId");

ALTER TABLE "JourneyGate"
  DROP CONSTRAINT IF EXISTS "JourneyGate_journeyVersionId_fkey";
ALTER TABLE "JourneyGate"
  ADD CONSTRAINT "JourneyGate_journeyVersionId_fkey"
  FOREIGN KEY ("journeyVersionId") REFERENCES "JourneyVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 5. Table: JourneyAssignmentRule
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyAssignmentRule" (
  "id"         TEXT                  NOT NULL,
  "journeyId"  TEXT                  NOT NULL,
  "audience"   "JourneyAudienceRole" NOT NULL,
  "autoEnroll" BOOLEAN               NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyAssignmentRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JourneyAssignmentRule_journeyId_audience_key"
  ON "JourneyAssignmentRule" ("journeyId", "audience");

ALTER TABLE "JourneyAssignmentRule"
  DROP CONSTRAINT IF EXISTS "JourneyAssignmentRule_journeyId_fkey";
ALTER TABLE "JourneyAssignmentRule"
  ADD CONSTRAINT "JourneyAssignmentRule_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "Journey"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 6. Table: JourneyAuditLog (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyAuditLog" (
  "id"               TEXT         NOT NULL,
  "journeyId"        TEXT         NOT NULL,
  "journeyVersionId" TEXT,
  "actorId"          TEXT,
  "action"           TEXT         NOT NULL,
  "diff"             JSONB,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JourneyAuditLog_journeyId_createdAt_idx"
  ON "JourneyAuditLog" ("journeyId", "createdAt");

CREATE INDEX IF NOT EXISTS "JourneyAuditLog_actorId_createdAt_idx"
  ON "JourneyAuditLog" ("actorId", "createdAt");

ALTER TABLE "JourneyAuditLog"
  DROP CONSTRAINT IF EXISTS "JourneyAuditLog_journeyId_fkey";
ALTER TABLE "JourneyAuditLog"
  ADD CONSTRAINT "JourneyAuditLog_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "Journey"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 7. InteractiveBeat: add journeyVersionId + swap unique constraints
-- ============================================================

ALTER TABLE "InteractiveBeat"
  ADD COLUMN IF NOT EXISTS "journeyVersionId" TEXT;

-- Drop the old (journeyId, sortOrder) unique so a single InteractiveJourney
-- can carry multiple versions worth of sortOrders during the version
-- transition. Replace with a non-unique index for query performance.
DROP INDEX IF EXISTS "InteractiveBeat_journeyId_sortOrder_key";

CREATE INDEX IF NOT EXISTS "InteractiveBeat_journeyId_sortOrder_idx"
  ON "InteractiveBeat" ("journeyId", "sortOrder");

-- New uniqueness scope: per JourneyVersion. Postgres treats NULLs as
-- distinct, so beats not yet versioned (none after backfill) won't collide.
CREATE UNIQUE INDEX IF NOT EXISTS "InteractiveBeat_journeyVersionId_sortOrder_key"
  ON "InteractiveBeat" ("journeyVersionId", "sortOrder");

ALTER TABLE "InteractiveBeat"
  DROP CONSTRAINT IF EXISTS "InteractiveBeat_journeyVersionId_fkey";
ALTER TABLE "InteractiveBeat"
  ADD CONSTRAINT "InteractiveBeat_journeyVersionId_fkey"
  FOREIGN KEY ("journeyVersionId") REFERENCES "JourneyVersion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 8. InteractiveJourneyCompletion: add journeyVersionId
-- ============================================================

ALTER TABLE "InteractiveJourneyCompletion"
  ADD COLUMN IF NOT EXISTS "journeyVersionId" TEXT;

CREATE INDEX IF NOT EXISTS "InteractiveJourneyCompletion_journeyVersionId_idx"
  ON "InteractiveJourneyCompletion" ("journeyVersionId");

ALTER TABLE "InteractiveJourneyCompletion"
  DROP CONSTRAINT IF EXISTS "InteractiveJourneyCompletion_journeyVersionId_fkey";
ALTER TABLE "InteractiveJourneyCompletion"
  ADD CONSTRAINT "InteractiveJourneyCompletion_journeyVersionId_fkey"
  FOREIGN KEY ("journeyVersionId") REFERENCES "JourneyVersion"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 9. Backfill: 1 Journey + 1 PUBLISHED JourneyVersion per InteractiveJourney
-- ============================================================
--
-- Idempotent: re-running skips InteractiveJourneys that already have a
-- matching Journey/JourneyVersion (matched by slug + versionNumber). The
-- subsequent UPDATEs only touch rows where journeyVersionId IS NULL.

DO $$
DECLARE
  rec RECORD;
  v_journey_id TEXT;
  v_version_id TEXT;
  v_slug TEXT;
BEGIN
  FOR rec IN
    SELECT
      ij."id"               AS runtime_id,
      ij."moduleId"         AS module_id,
      ij."estimatedMinutes" AS estimated_minutes,
      ij."passScorePct"     AS pass_score_pct,
      ij."strictMode"       AS strict_mode,
      tm."contentKey"       AS content_key,
      tm."title"            AS module_title
    FROM "InteractiveJourney" ij
    JOIN "TrainingModule" tm ON tm."id" = ij."moduleId"
  LOOP
    v_slug := COALESCE(rec.content_key, 'journey-' || rec.runtime_id);

    -- Upsert Journey by slug.
    SELECT "id" INTO v_journey_id FROM "Journey" WHERE "slug" = v_slug;
    IF v_journey_id IS NULL THEN
      v_journey_id := gen_random_uuid()::text;
      INSERT INTO "Journey" ("id", "slug", "title", "createdAt", "updatedAt")
      VALUES (v_journey_id, v_slug, rec.module_title, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
    END IF;

    -- Upsert JourneyVersion v1 (PUBLISHED) for this Journey.
    SELECT "id" INTO v_version_id
    FROM "JourneyVersion"
    WHERE "journeyId" = v_journey_id AND "versionNumber" = 1;
    IF v_version_id IS NULL THEN
      v_version_id := gen_random_uuid()::text;
      INSERT INTO "JourneyVersion" (
        "id", "journeyId", "versionNumber", "status",
        "estimatedMinutes", "passScorePct", "strictMode",
        "moduleId", "publishedAt", "createdAt", "updatedAt"
      ) VALUES (
        v_version_id, v_journey_id, 1, 'PUBLISHED',
        rec.estimated_minutes, rec.pass_score_pct, rec.strict_mode,
        rec.module_id, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      );
    END IF;

    -- Point existing beats at the new JourneyVersion (only if unset).
    UPDATE "InteractiveBeat"
    SET "journeyVersionId" = v_version_id
    WHERE "journeyId" = rec.runtime_id
      AND "journeyVersionId" IS NULL;

    -- Point existing completions at the new JourneyVersion (only if unset).
    UPDATE "InteractiveJourneyCompletion"
    SET "journeyVersionId" = v_version_id
    WHERE "journeyId" = rec.runtime_id
      AND "journeyVersionId" IS NULL;
  END LOOP;
END $$;
