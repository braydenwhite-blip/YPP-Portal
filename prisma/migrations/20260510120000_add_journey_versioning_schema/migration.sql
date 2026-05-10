-- Migration: add_journey_versioning_schema
-- Commit 2 of the Admin Journey Editor (docs/admin-journey-editor-plan.md).
--
-- Adds:
--   * Enums: JourneyVersionStatus, JourneyAudienceRole, JourneyGateKind,
--            JourneyAuditAction
--   * Tables: Journey, JourneyVersion, JourneyGate,
--             JourneyAssignmentRule, JourneyAuditLog
--   * Nullable columns: InteractiveBeat.journeyVersionId,
--             InteractiveJourneyCompletion.journeyVersionId
--   * Loosens InteractiveBeat ordering uniqueness (drops
--     UNIQUE(journeyId, sortOrder), keeps it as a plain index) so the
--     admin editor can drag-reorder beats without temp shuffles.
--   * Backfills one Journey + one PUBLISHED JourneyVersion (v1) per
--     existing InteractiveJourney, and points existing beats /
--     completions at the new snapshot.
--
-- Idempotency:
--   * IF NOT EXISTS on every CREATE.
--   * DO $$ ... EXCEPTION WHEN duplicate_object guards on enums and FKs.
--   * Backfill INSERT ... ON CONFLICT DO NOTHING; UPDATE only WHERE
--     journeyVersionId IS NULL.
--
-- Safety:
--   * No existing rows are deleted or rewritten.
--   * Legacy columns (InteractiveBeat.journeyId, completion.journeyId,
--     and the InteractiveJourney table) are preserved unchanged.
--   * Learner attempts (InteractiveBeatAttempt) are untouched — they
--     still FK to InteractiveBeat.id, which now belongs to a v1
--     PUBLISHED snapshot.

-- ============================================================
-- 1. Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "JourneyVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "JourneyGateKind" AS ENUM (
    'READINESS_CHECK',
    'BEAT_COMPLETE',
    'MODULE_COMPLETE',
    'SCORE_THRESHOLD'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "JourneyAuditAction" AS ENUM (
    'CREATE',
    'UPDATE',
    'PUBLISH',
    'ROLLBACK',
    'ARCHIVE',
    'DELETE',
    'ASSIGNMENT_CHANGE',
    'GATE_CHANGE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Table: Journey (stable identity per training journey)
-- ============================================================

CREATE TABLE IF NOT EXISTS "Journey" (
  "id"          TEXT         NOT NULL,
  "slug"        TEXT         NOT NULL,
  "title"       TEXT         NOT NULL,
  "description" TEXT,
  "archivedAt"  TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Journey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Journey_slug_key"     ON "Journey" ("slug");
CREATE INDEX        IF NOT EXISTS "Journey_archivedAt_idx" ON "Journey" ("archivedAt");

DO $$ BEGIN
  ALTER TABLE "Journey"
    ADD CONSTRAINT "Journey_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 3. Table: JourneyVersion (DRAFT/PUBLISHED/ARCHIVED snapshot)
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyVersion" (
  "id"               TEXT                   NOT NULL,
  "journeyId"        TEXT                   NOT NULL,
  "versionNumber"    INTEGER                NOT NULL,
  "status"           "JourneyVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "moduleId"         TEXT,
  "estimatedMinutes" INTEGER                NOT NULL DEFAULT 0,
  "passScorePct"     INTEGER                NOT NULL DEFAULT 80,
  "strictMode"       BOOLEAN                NOT NULL DEFAULT false,
  "notes"            TEXT,
  "publishedAt"      TIMESTAMP(3),
  "publishedById"    TEXT,
  "createdById"      TEXT,
  "createdAt"        TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)           NOT NULL,
  CONSTRAINT "JourneyVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JourneyVersion_journeyId_versionNumber_key"
  ON "JourneyVersion" ("journeyId", "versionNumber");
CREATE INDEX IF NOT EXISTS "JourneyVersion_journeyId_status_versionNumber_idx"
  ON "JourneyVersion" ("journeyId", "status", "versionNumber");
CREATE INDEX IF NOT EXISTS "JourneyVersion_status_idx"
  ON "JourneyVersion" ("status");
CREATE INDEX IF NOT EXISTS "JourneyVersion_moduleId_idx"
  ON "JourneyVersion" ("moduleId");

DO $$ BEGIN
  ALTER TABLE "JourneyVersion"
    ADD CONSTRAINT "JourneyVersion_journeyId_fkey"
    FOREIGN KEY ("journeyId") REFERENCES "Journey"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JourneyVersion"
    ADD CONSTRAINT "JourneyVersion_moduleId_fkey"
    FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JourneyVersion"
    ADD CONSTRAINT "JourneyVersion_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JourneyVersion"
    ADD CONSTRAINT "JourneyVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 4. Table: JourneyGate (per-version unlock rules)
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyGate" (
  "id"               TEXT              NOT NULL,
  "journeyVersionId" TEXT              NOT NULL,
  "kind"             "JourneyGateKind" NOT NULL,
  "targetRef"        TEXT              NOT NULL,
  "requiredRef"      TEXT              NOT NULL,
  "threshold"        INTEGER,
  "createdAt"        TIMESTAMP(3)      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3)      NOT NULL,
  CONSTRAINT "JourneyGate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JourneyGate_journeyVersionId_idx"
  ON "JourneyGate" ("journeyVersionId");
CREATE INDEX IF NOT EXISTS "JourneyGate_kind_idx"
  ON "JourneyGate" ("kind");

DO $$ BEGIN
  ALTER TABLE "JourneyGate"
    ADD CONSTRAINT "JourneyGate_journeyVersionId_fkey"
    FOREIGN KEY ("journeyVersionId") REFERENCES "JourneyVersion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. Table: JourneyAssignmentRule (audience -> journey, autoEnroll)
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyAssignmentRule" (
  "id"         TEXT                  NOT NULL,
  "journeyId"  TEXT                  NOT NULL,
  "audience"   "JourneyAudienceRole" NOT NULL,
  "autoEnroll" BOOLEAN               NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3)          NOT NULL,
  CONSTRAINT "JourneyAssignmentRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "JourneyAssignmentRule_journeyId_audience_key"
  ON "JourneyAssignmentRule" ("journeyId", "audience");
CREATE INDEX IF NOT EXISTS "JourneyAssignmentRule_audience_idx"
  ON "JourneyAssignmentRule" ("audience");

DO $$ BEGIN
  ALTER TABLE "JourneyAssignmentRule"
    ADD CONSTRAINT "JourneyAssignmentRule_journeyId_fkey"
    FOREIGN KEY ("journeyId") REFERENCES "Journey"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. Table: JourneyAuditLog (append-only)
-- ============================================================

CREATE TABLE IF NOT EXISTS "JourneyAuditLog" (
  "id"               TEXT                 NOT NULL,
  "journeyId"        TEXT                 NOT NULL,
  "journeyVersionId" TEXT,
  "action"           "JourneyAuditAction" NOT NULL,
  "actorId"          TEXT,
  "summary"          TEXT,
  "diff"             JSONB,
  "createdAt"        TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JourneyAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "JourneyAuditLog_journeyId_createdAt_idx"
  ON "JourneyAuditLog" ("journeyId", "createdAt");
CREATE INDEX IF NOT EXISTS "JourneyAuditLog_journeyVersionId_idx"
  ON "JourneyAuditLog" ("journeyVersionId");
CREATE INDEX IF NOT EXISTS "JourneyAuditLog_action_idx"
  ON "JourneyAuditLog" ("action");

DO $$ BEGIN
  ALTER TABLE "JourneyAuditLog"
    ADD CONSTRAINT "JourneyAuditLog_journeyId_fkey"
    FOREIGN KEY ("journeyId") REFERENCES "Journey"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JourneyAuditLog"
    ADD CONSTRAINT "JourneyAuditLog_journeyVersionId_fkey"
    FOREIGN KEY ("journeyVersionId") REFERENCES "JourneyVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "JourneyAuditLog"
    ADD CONSTRAINT "JourneyAuditLog_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 7. Add nullable journeyVersionId columns + FKs to legacy tables
-- ============================================================

ALTER TABLE "InteractiveBeat"
  ADD COLUMN IF NOT EXISTS "journeyVersionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "InteractiveBeat"
    ADD CONSTRAINT "InteractiveBeat_journeyVersionId_fkey"
    FOREIGN KEY ("journeyVersionId") REFERENCES "JourneyVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "InteractiveJourneyCompletion"
  ADD COLUMN IF NOT EXISTS "journeyVersionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "InteractiveJourneyCompletion"
    ADD CONSTRAINT "InteractiveJourneyCompletion_journeyVersionId_fkey"
    FOREIGN KEY ("journeyVersionId") REFERENCES "JourneyVersion"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "InteractiveJourneyCompletion_journeyVersionId_idx"
  ON "InteractiveJourneyCompletion" ("journeyVersionId");

-- ============================================================
-- 8. Loosen InteractiveBeat ordering uniqueness for reorder workflows
-- ============================================================
--
-- Drop UNIQUE(journeyId, sortOrder) so drag-reorder doesn't need a
-- temp shuffle. Sort-order uniqueness is enforced at validation time
-- (lib/journey-editor/validation.ts, Commit 3). We replace it with a
-- plain index for the same query patterns.

DROP INDEX IF EXISTS "InteractiveBeat_journeyId_sortOrder_key";

CREATE INDEX IF NOT EXISTS "InteractiveBeat_journeyId_sortOrder_idx"
  ON "InteractiveBeat" ("journeyId", "sortOrder");

CREATE INDEX IF NOT EXISTS "InteractiveBeat_journeyVersionId_sortOrder_idx"
  ON "InteractiveBeat" ("journeyVersionId", "sortOrder");

-- Per-version sourceKey uniqueness. NULLs do not collide in PG
-- composite unique indexes, so legacy rows (journeyVersionId IS NULL)
-- coexist safely.
CREATE UNIQUE INDEX IF NOT EXISTS "InteractiveBeat_journeyVersionId_sourceKey_key"
  ON "InteractiveBeat" ("journeyVersionId", "sourceKey");

-- ============================================================
-- 9. Backfill — one Journey + one PUBLISHED v1 per existing journey
-- ============================================================
--
-- Strategy:
--   * For each InteractiveJourney row, derive a slug from the linked
--     TrainingModule.contentKey (fallback `journey-<id>`), insert a
--     Journey using the same id (so slug-based lookups stay stable
--     and re-running the migration is idempotent).
--   * Insert a JourneyVersion (versionNumber=1, status=PUBLISHED) using
--     the same id as the InteractiveJourney for stable backfill.
--   * Update InteractiveBeat.journeyVersionId and
--     InteractiveJourneyCompletion.journeyVersionId only where NULL,
--     so a re-run is a no-op.
--
-- Re-using ids keeps the migration deterministic and safe to re-run.
-- The new admin editor allocates fresh cuids for everything it
-- creates, so there is no id-space collision.

INSERT INTO "Journey" ("id", "slug", "title", "description", "createdAt", "updatedAt")
SELECT
  ij."id",
  COALESCE(tm."contentKey", 'journey-' || ij."id"),
  COALESCE(tm."title", 'Untitled journey'),
  tm."description",
  ij."createdAt",
  ij."updatedAt"
FROM "InteractiveJourney" ij
LEFT JOIN "TrainingModule" tm ON tm."id" = ij."moduleId"
ON CONFLICT ("id") DO NOTHING;

-- If two journeys somehow share a contentKey, keep the first and
-- disambiguate the rest. (Defensive; shouldn't happen with current
-- data.)
UPDATE "Journey" j
SET "slug" = j."slug" || '-' || j."id"
WHERE EXISTS (
  SELECT 1 FROM "Journey" j2
  WHERE j2."slug" = j."slug" AND j2."id" <> j."id" AND j2."createdAt" < j."createdAt"
);

INSERT INTO "JourneyVersion" (
  "id",
  "journeyId",
  "versionNumber",
  "status",
  "moduleId",
  "estimatedMinutes",
  "passScorePct",
  "strictMode",
  "publishedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  ij."id",
  ij."id",
  1,
  'PUBLISHED'::"JourneyVersionStatus",
  ij."moduleId",
  ij."estimatedMinutes",
  ij."passScorePct",
  ij."strictMode",
  ij."createdAt",
  ij."createdAt",
  ij."updatedAt"
FROM "InteractiveJourney" ij
ON CONFLICT ("id") DO NOTHING;

-- Point legacy beats at the new snapshot. Only updates rows that have
-- not already been backfilled (idempotent).
UPDATE "InteractiveBeat" b
SET "journeyVersionId" = b."journeyId"
WHERE b."journeyVersionId" IS NULL
  AND EXISTS (SELECT 1 FROM "JourneyVersion" v WHERE v."id" = b."journeyId");

-- Point legacy completions at the new snapshot.
UPDATE "InteractiveJourneyCompletion" c
SET "journeyVersionId" = c."journeyId"
WHERE c."journeyVersionId" IS NULL
  AND EXISTS (SELECT 1 FROM "JourneyVersion" v WHERE v."id" = c."journeyId");
