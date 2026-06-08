-- Migration: add_mentorship_2_match_recommendations
-- Mentorship 2.0 (Action Tracker 3.0, Phase M2).
--
-- Adds MentorshipMatchRecommendation: a scored, explainable mentor suggestion
-- for a MentorshipApplication. One application fans out to many SUGGESTED rows;
-- at most one becomes APPROVED and drives the canonical Mentorship pair (losing
-- siblings auto-SUPERSEDED). `scoreBreakdownJson` stores the matching engine's
-- per-factor breakdown so admins can inspect WHY a mentor was recommended.
--
-- `status` is a TEXT vocabulary validated in application code
-- (lib/mentorship-2/constants.ts) — no Postgres enum, matching the repo's
-- actionType / partner.stage convention so the vocabulary stays editable without
-- a migration.
--
-- Purely additive: a single new table, no ALTER/DROP on existing tables (the
-- User / MentorshipApplication back-relations are virtual Prisma relations, not
-- SQL columns). Written idempotently (CREATE TABLE / INDEX IF NOT EXISTS, guarded
-- foreign keys) to match the repo's hand-written migration convention, so the
-- whole migration is safe to re-run. Runtime stays dark behind ENABLE_MENTORSHIP_2.

-- CreateTable: MentorshipMatchRecommendation
CREATE TABLE IF NOT EXISTS "MentorshipMatchRecommendation" (
    "id" TEXT NOT NULL,
    "mentorshipApplicationId" TEXT NOT NULL,
    "menteeUserId" TEXT NOT NULL,
    "mentorUserId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "scoreBreakdownJson" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "adminNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorshipMatchRecommendation_pkey" PRIMARY KEY ("id")
);

-- Idempotent regeneration: the engine upserts on (application, mentor) instead of
-- creating duplicate suggestions for the same pair. Index name matches Prisma's
-- derived name for @@unique([mentorshipApplicationId, mentorUserId]).
CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipMatchRecommendation_mentorshipApplicationId_mentorUserId_key"
    ON "MentorshipMatchRecommendation"("mentorshipApplicationId", "mentorUserId");

CREATE INDEX IF NOT EXISTS "MentorshipMatchRecommendation_mentorshipApplicationId_idx"
    ON "MentorshipMatchRecommendation"("mentorshipApplicationId");
CREATE INDEX IF NOT EXISTS "MentorshipMatchRecommendation_menteeUserId_idx"
    ON "MentorshipMatchRecommendation"("menteeUserId");
CREATE INDEX IF NOT EXISTS "MentorshipMatchRecommendation_mentorUserId_idx"
    ON "MentorshipMatchRecommendation"("mentorUserId");
CREATE INDEX IF NOT EXISTS "MentorshipMatchRecommendation_status_idx"
    ON "MentorshipMatchRecommendation"("status");
CREATE INDEX IF NOT EXISTS "MentorshipMatchRecommendation_score_idx"
    ON "MentorshipMatchRecommendation"("score");

-- AddForeignKey (guarded — Postgres has no ADD CONSTRAINT IF NOT EXISTS)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipMatchRecommendation_mentorshipApplicationId_fkey') THEN
    ALTER TABLE "MentorshipMatchRecommendation"
      ADD CONSTRAINT "MentorshipMatchRecommendation_mentorshipApplicationId_fkey"
      FOREIGN KEY ("mentorshipApplicationId") REFERENCES "MentorshipApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipMatchRecommendation_menteeUserId_fkey') THEN
    ALTER TABLE "MentorshipMatchRecommendation"
      ADD CONSTRAINT "MentorshipMatchRecommendation_menteeUserId_fkey"
      FOREIGN KEY ("menteeUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipMatchRecommendation_mentorUserId_fkey') THEN
    ALTER TABLE "MentorshipMatchRecommendation"
      ADD CONSTRAINT "MentorshipMatchRecommendation_mentorUserId_fkey"
      FOREIGN KEY ("mentorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipMatchRecommendation_decidedByUserId_fkey') THEN
    ALTER TABLE "MentorshipMatchRecommendation"
      ADD CONSTRAINT "MentorshipMatchRecommendation_decidedByUserId_fkey"
      FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
