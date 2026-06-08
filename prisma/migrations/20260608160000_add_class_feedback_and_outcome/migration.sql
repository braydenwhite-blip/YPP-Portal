-- Migration: add_class_feedback_and_outcome
--
-- Adds the class feedback + completion-outcome layer:
--   • ClassFeedback — one row per (offering, student): rating + liked + improve.
--   • ClassOutcome  — one row per offering (1:1): instructor wrap-up reflection
--     plus the admin completion outcome and repeat-recommendation taxonomy.
--
-- Everything is additive — no existing table is altered apart from the implicit
-- back-relations — so existing offerings are unaffected. All statements are
-- idempotent so the migration is safe to re-run against a partial state.

-- ============================================================
-- 1. Enums
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "ClassOutcomeStatus" AS ENUM (
    'PENDING',
    'STRONG',
    'SOLID',
    'MIXED',
    'UNDERPERFORMED',
    'DID_NOT_RUN'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClassRepeatRecommendation" AS ENUM (
    'REPEAT_AS_IS',
    'REPEAT_WITH_TWEAKS',
    'REPEAT_NEW_INSTRUCTOR',
    'REPEAT_LATER',
    'NEEDS_REWORK',
    'DO_NOT_REPEAT',
    'UNDECIDED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. ClassFeedback table (per-student feedback)
-- ============================================================

CREATE TABLE IF NOT EXISTS "ClassFeedback" (
  "id"             TEXT         NOT NULL,
  "offeringId"     TEXT         NOT NULL,
  "studentId"      TEXT         NOT NULL,
  "rating"         INTEGER      NOT NULL,
  "liked"          TEXT,
  "improve"        TEXT,
  "wouldRecommend" BOOLEAN,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClassFeedback_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClassFeedback"
    ADD CONSTRAINT "ClassFeedback_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClassFeedback_offeringId_studentId_key"
  ON "ClassFeedback" ("offeringId", "studentId");

CREATE INDEX IF NOT EXISTS "ClassFeedback_offeringId_idx"
  ON "ClassFeedback" ("offeringId");

CREATE INDEX IF NOT EXISTS "ClassFeedback_studentId_idx"
  ON "ClassFeedback" ("studentId");

CREATE INDEX IF NOT EXISTS "ClassFeedback_rating_idx"
  ON "ClassFeedback" ("rating");

-- ============================================================
-- 3. ClassOutcome table (per-offering completion outcome)
-- ============================================================

CREATE TABLE IF NOT EXISTS "ClassOutcome" (
  "id"                        TEXT                 NOT NULL,
  "offeringId"                TEXT                 NOT NULL,
  "instructorId"              TEXT,
  "instructorWentWell"        TEXT,
  "instructorChallenges"      TEXT,
  "instructorStudentImpact"   TEXT,
  "instructorWouldTeachAgain" BOOLEAN,
  "instructorReflectedAt"     TIMESTAMP(3),
  "status"                    "ClassOutcomeStatus" NOT NULL DEFAULT 'PENDING',
  "repeatRecommendation"      "ClassRepeatRecommendation",
  "gotGoodFeedback"           BOOLEAN              NOT NULL DEFAULT false,
  "adminNotes"                TEXT,
  "recordedById"              TEXT,
  "recordedAt"                TIMESTAMP(3),
  "createdAt"                 TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                 TIMESTAMP(3)         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClassOutcome_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ClassOutcome"
    ADD CONSTRAINT "ClassOutcome_offeringId_fkey"
    FOREIGN KEY ("offeringId") REFERENCES "ClassOffering"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ClassOutcome_offeringId_key"
  ON "ClassOutcome" ("offeringId");

CREATE INDEX IF NOT EXISTS "ClassOutcome_status_idx"
  ON "ClassOutcome" ("status");

CREATE INDEX IF NOT EXISTS "ClassOutcome_repeatRecommendation_idx"
  ON "ClassOutcome" ("repeatRecommendation");

CREATE INDEX IF NOT EXISTS "ClassOutcome_gotGoodFeedback_idx"
  ON "ClassOutcome" ("gotGoodFeedback");
