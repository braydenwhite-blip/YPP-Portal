-- Migration: promotion_record
-- Phase 8 of the Roles/Mentorship/Reviews/Access plan
-- (docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
--
-- Adds PromotionRecord — the append-only history of APPLIED promotions / role
-- changes made non-destructively from the person profile. Stores the before/after
-- snapshot, reason, effective date, actor, and pending-setup state (which drives
-- the Promotion Setup queue). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "PromotionRecord" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "effectiveDate" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "previousTitle" TEXT,
  "newTitle" TEXT,
  "previousInternalLevel" INTEGER,
  "newInternalLevel" INTEGER,
  "previousLadder" "OrgLadder",
  "newLadder" "OrgLadder",
  "previousChapterId" TEXT,
  "newChapterId" TEXT,
  "previousCohortId" TEXT,
  "newCohortId" TEXT,
  "committeesAdded" TEXT,
  "committeesRemoved" TEXT,
  "pendingSetup" TEXT,
  "setupComplete" BOOLEAN NOT NULL DEFAULT false,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromotionRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PromotionRecord_userId_createdAt_idx"
  ON "PromotionRecord"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "PromotionRecord_setupComplete_idx"
  ON "PromotionRecord"("setupComplete");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromotionRecord_userId_fkey') THEN
    ALTER TABLE "PromotionRecord"
      ADD CONSTRAINT "PromotionRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PromotionRecord_actorId_fkey') THEN
    ALTER TABLE "PromotionRecord"
      ADD CONSTRAINT "PromotionRecord_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
