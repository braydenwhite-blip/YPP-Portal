-- Migration: mentorship_transferability
-- Phase 4 of the Roles/Mentorship/Reviews/Access plan
-- (docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
--
-- Makes mentor assignments transferable, dated, dual-track, and fully audited:
--   * MentorshipFocusArea enum (instruction development vs leadership)
--   * Mentorship.focusArea / isTemporary
--   * MentorshipCircleMember.isTemporary
--   * MentorshipAssignmentHistory (append-only who-mentored-whom trail)
--
-- Additive, nullable/defaulted, and idempotent. No existing rows are modified;
-- reassignment preserves notes, check-ins, and reviews (nothing is deleted).

-- Focus-area enum ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipFocusArea') THEN
    CREATE TYPE "MentorshipFocusArea" AS ENUM ('INSTRUCTION', 'LEADERSHIP');
  END IF;
END $$;

-- Mentorship columns ---------------------------------------------------------
ALTER TABLE "Mentorship" ADD COLUMN IF NOT EXISTS "focusArea" "MentorshipFocusArea";
ALTER TABLE "Mentorship" ADD COLUMN IF NOT EXISTS "isTemporary" BOOLEAN NOT NULL DEFAULT false;

-- Support-circle column ------------------------------------------------------
ALTER TABLE "MentorshipCircleMember" ADD COLUMN IF NOT EXISTS "isTemporary" BOOLEAN NOT NULL DEFAULT false;

-- Assignment history ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS "MentorshipAssignmentHistory" (
  "id" TEXT NOT NULL,
  "menteeId" TEXT NOT NULL,
  "mentorId" TEXT NOT NULL,
  "focusArea" "MentorshipFocusArea",
  "role" TEXT NOT NULL DEFAULT 'PRIMARY_MENTOR',
  "mentorshipId" TEXT,
  "isTemporary" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "reason" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MentorshipAssignmentHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MentorshipAssignmentHistory_menteeId_endedAt_idx"
  ON "MentorshipAssignmentHistory"("menteeId", "endedAt");
CREATE INDEX IF NOT EXISTS "MentorshipAssignmentHistory_mentorId_endedAt_idx"
  ON "MentorshipAssignmentHistory"("mentorId", "endedAt");
CREATE INDEX IF NOT EXISTS "MentorshipAssignmentHistory_mentorshipId_idx"
  ON "MentorshipAssignmentHistory"("mentorshipId");

-- Foreign keys ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipAssignmentHistory_menteeId_fkey') THEN
    ALTER TABLE "MentorshipAssignmentHistory"
      ADD CONSTRAINT "MentorshipAssignmentHistory_menteeId_fkey"
      FOREIGN KEY ("menteeId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipAssignmentHistory_mentorId_fkey') THEN
    ALTER TABLE "MentorshipAssignmentHistory"
      ADD CONSTRAINT "MentorshipAssignmentHistory_mentorId_fkey"
      FOREIGN KEY ("mentorId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MentorshipAssignmentHistory_actorId_fkey') THEN
    ALTER TABLE "MentorshipAssignmentHistory"
      ADD CONSTRAINT "MentorshipAssignmentHistory_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
