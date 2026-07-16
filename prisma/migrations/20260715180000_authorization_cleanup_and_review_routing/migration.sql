-- Migration: authorization_cleanup_and_review_routing
--
-- Adds ReviewRoutingException — the DB-backed home for review-routing
-- carve-outs (Phase 8 promotion of the plan's Phase 1 config-file
-- exceptions in lib/org/review-exceptions.ts), editable from
-- /admin/review-routing instead of requiring a code change.
--
-- Idempotent / additive-safe: use IF NOT EXISTS, enum + FK creation are
-- wrapped in DO $$ blocks.

DO $$
BEGIN
  CREATE TYPE "ReviewRoutingExceptionKind" AS ENUM ('SELF_FINALIZE', 'BOARD_APPROVAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "ReviewRoutingException" (
  "id" TEXT NOT NULL,
  "kind" "ReviewRoutingExceptionKind" NOT NULL,
  "mentorId" TEXT,
  "mentorName" TEXT,
  "menteeId" TEXT,
  "menteeName" TEXT,
  "topInstructionMentees" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "effectiveFrom" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewRoutingException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReviewRoutingException_kind_isActive_idx"
  ON "ReviewRoutingException"("kind", "isActive");
CREATE INDEX IF NOT EXISTS "ReviewRoutingException_mentorId_isActive_idx"
  ON "ReviewRoutingException"("mentorId", "isActive");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReviewRoutingException_mentorId_fkey') THEN
    ALTER TABLE "ReviewRoutingException"
      ADD CONSTRAINT "ReviewRoutingException_mentorId_fkey"
      FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReviewRoutingException_menteeId_fkey') THEN
    ALTER TABLE "ReviewRoutingException"
      ADD CONSTRAINT "ReviewRoutingException_menteeId_fkey"
      FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReviewRoutingException_createdById_fkey') THEN
    ALTER TABLE "ReviewRoutingException"
      ADD CONSTRAINT "ReviewRoutingException_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
