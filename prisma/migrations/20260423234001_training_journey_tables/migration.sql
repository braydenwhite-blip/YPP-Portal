-- Migration: training_journey_tables
-- Phase 1 of the interactive training journey rebuild.
-- Creates the `InteractiveBeatKind` enum and the four journey tables:
--   InteractiveJourney, InteractiveBeat, InteractiveBeatAttempt,
--   InteractiveJourneyCompletion.
--
-- See plan §7 (Data Model) and §10 Phase 1 for the full rationale.
-- No data is backfilled here — the subsequent seed migration
-- (Phase 3: YYYYMMDD_training_journey_seed) will populate curriculum rows
-- via the `training:import` script.

-- ============================================================
-- 1. Enum: InteractiveBeatKind
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "InteractiveBeatKind" AS ENUM (
    'CONCEPT_REVEAL',
    'SCENARIO_CHOICE',
    'MULTI_SELECT',
    'SORT_ORDER',
    'MATCH_PAIRS',
    'SPOT_THE_MISTAKE',
    'FILL_IN_BLANK',
    'BRANCHING_SCENARIO',
    'REFLECTION',
    'COMPARE',
    'HOTSPOT',
    'MESSAGE_COMPOSER'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. Table: InteractiveJourney (one per TrainingModule of type INTERACTIVE_JOURNEY)
-- ============================================================

CREATE TABLE IF NOT EXISTS "InteractiveJourney" (
  "id"               TEXT        NOT NULL,
  "moduleId"         TEXT        NOT NULL,
  "estimatedMinutes" INTEGER     NOT NULL,
  "passScorePct"     INTEGER     NOT NULL DEFAULT 80,
  "strictMode"       BOOLEAN     NOT NULL DEFAULT false,
  "version"          INTEGER     NOT NULL DEFAULT 1,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InteractiveJourney_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InteractiveJourney_moduleId_key"
  ON "InteractiveJourney" ("moduleId");

ALTER TABLE "InteractiveJourney"
  DROP CONSTRAINT IF EXISTS "InteractiveJourney_moduleId_fkey";
ALTER TABLE "InteractiveJourney"
  ADD CONSTRAINT "InteractiveJourney_moduleId_fkey"
  FOREIGN KEY ("moduleId") REFERENCES "TrainingModule"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 3. Table: InteractiveBeat (ordered beats per journey; branches via parentBeatId)
-- ============================================================

CREATE TABLE IF NOT EXISTS "InteractiveBeat" (
  "id"             TEXT                  NOT NULL,
  "journeyId"      TEXT                  NOT NULL,
  "sourceKey"      TEXT                  NOT NULL,
  "sortOrder"      INTEGER               NOT NULL,
  "kind"           "InteractiveBeatKind" NOT NULL,
  "title"          TEXT                  NOT NULL,
  "prompt"         TEXT                  NOT NULL,
  "mediaUrl"       TEXT,
  "config"         JSONB                 NOT NULL,
  "schemaVersion"  INTEGER               NOT NULL DEFAULT 1,
  "scoringWeight"  INTEGER               NOT NULL DEFAULT 10,
  "scoringRule"    TEXT,
  "parentBeatId"   TEXT,
  "showWhen"       JSONB,
  "removedAt"      TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3)          NOT NULL,
  CONSTRAINT "InteractiveBeat_pkey" PRIMARY KEY ("id")
);

-- Stable sourceKey per journey (idempotent re-import target).
CREATE UNIQUE INDEX IF NOT EXISTS "InteractiveBeat_journeyId_sourceKey_key"
  ON "InteractiveBeat" ("journeyId", "sourceKey");

-- No two beats share a sortOrder within a journey.
CREATE UNIQUE INDEX IF NOT EXISTS "InteractiveBeat_journeyId_sortOrder_key"
  ON "InteractiveBeat" ("journeyId", "sortOrder");

-- Branch-tree lookups (`WHERE parentBeatId = ...`).
CREATE INDEX IF NOT EXISTS "InteractiveBeat_parentBeatId_idx"
  ON "InteractiveBeat" ("parentBeatId");

ALTER TABLE "InteractiveBeat"
  DROP CONSTRAINT IF EXISTS "InteractiveBeat_journeyId_fkey";
ALTER TABLE "InteractiveBeat"
  ADD CONSTRAINT "InteractiveBeat_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "InteractiveJourney"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InteractiveBeat"
  DROP CONSTRAINT IF EXISTS "InteractiveBeat_parentBeatId_fkey";
ALTER TABLE "InteractiveBeat"
  ADD CONSTRAINT "InteractiveBeat_parentBeatId_fkey"
  FOREIGN KEY ("parentBeatId") REFERENCES "InteractiveBeat"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. Table: InteractiveBeatAttempt (append-only per (userId, beatId, attemptNumber))
-- ============================================================

CREATE TABLE IF NOT EXISTS "InteractiveBeatAttempt" (
  "id"                    TEXT         NOT NULL,
  "beatId"                TEXT         NOT NULL,
  "userId"                TEXT         NOT NULL,
  "attemptNumber"         INTEGER      NOT NULL,
  "response"              JSONB        NOT NULL,
  "responseSchemaVersion" INTEGER      NOT NULL DEFAULT 1,
  "correct"               BOOLEAN      NOT NULL,
  "score"                 INTEGER      NOT NULL,
  "timeMs"                INTEGER,
  "hintsShown"            INTEGER      NOT NULL DEFAULT 0,
  "attemptedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InteractiveBeatAttempt_pkey" PRIMARY KEY ("id")
);

-- Idempotency + ordering guarantee: one row per (beat, user, attemptNumber).
CREATE UNIQUE INDEX IF NOT EXISTS "InteractiveBeatAttempt_beatId_userId_attemptNumber_key"
  ON "InteractiveBeatAttempt" ("beatId", "userId", "attemptNumber");

-- Latest-attempt-per-beat reads (journey player resume, scoring).
CREATE INDEX IF NOT EXISTS "InteractiveBeatAttempt_userId_beatId_attemptedAt_idx"
  ON "InteractiveBeatAttempt" ("userId", "beatId", "attemptedAt");

-- Admin analytics scans (user activity timelines).
CREATE INDEX IF NOT EXISTS "InteractiveBeatAttempt_userId_attemptedAt_idx"
  ON "InteractiveBeatAttempt" ("userId", "attemptedAt");

ALTER TABLE "InteractiveBeatAttempt"
  DROP CONSTRAINT IF EXISTS "InteractiveBeatAttempt_beatId_fkey";
ALTER TABLE "InteractiveBeatAttempt"
  ADD CONSTRAINT "InteractiveBeatAttempt_beatId_fkey"
  FOREIGN KEY ("beatId") REFERENCES "InteractiveBeat"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InteractiveBeatAttempt"
  DROP CONSTRAINT IF EXISTS "InteractiveBeatAttempt_userId_fkey";
ALTER TABLE "InteractiveBeatAttempt"
  ADD CONSTRAINT "InteractiveBeatAttempt_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 5. Table: InteractiveJourneyCompletion (one per (journey, user); retakes overwrite)
-- ============================================================

CREATE TABLE IF NOT EXISTS "InteractiveJourneyCompletion" (
  "id"                   TEXT         NOT NULL,
  "journeyId"            TEXT         NOT NULL,
  "userId"               TEXT         NOT NULL,
  "totalScore"           INTEGER      NOT NULL,
  "maxScore"             INTEGER      NOT NULL,
  "scorePct"             INTEGER      NOT NULL,
  "passed"               BOOLEAN      NOT NULL,
  "firstTryCorrectCount" INTEGER      NOT NULL DEFAULT 0,
  "xpEarned"             INTEGER      NOT NULL DEFAULT 0,
  "visitedBeatCount"     INTEGER      NOT NULL,
  "moduleBreakdown"      JSONB,
  "personalizedTips"     JSONB,
  "completedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InteractiveJourneyCompletion_pkey" PRIMARY KEY ("id")
);

-- Upsert-on-replay target.
CREATE UNIQUE INDEX IF NOT EXISTS "InteractiveJourneyCompletion_journeyId_userId_key"
  ON "InteractiveJourneyCompletion" ("journeyId", "userId");

-- Dashboard list-by-user.
CREATE INDEX IF NOT EXISTS "InteractiveJourneyCompletion_userId_completedAt_idx"
  ON "InteractiveJourneyCompletion" ("userId", "completedAt");

ALTER TABLE "InteractiveJourneyCompletion"
  DROP CONSTRAINT IF EXISTS "InteractiveJourneyCompletion_journeyId_fkey";
ALTER TABLE "InteractiveJourneyCompletion"
  ADD CONSTRAINT "InteractiveJourneyCompletion_journeyId_fkey"
  FOREIGN KEY ("journeyId") REFERENCES "InteractiveJourney"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InteractiveJourneyCompletion"
  DROP CONSTRAINT IF EXISTS "InteractiveJourneyCompletion_userId_fkey";
ALTER TABLE "InteractiveJourneyCompletion"
  ADD CONSTRAINT "InteractiveJourneyCompletion_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
