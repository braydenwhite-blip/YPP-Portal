-- Migration: add_quarterly_review
-- People Strategy — Quarterly Reviews (ENABLE_QUARTERLY_REVIEWS).
-- Adds the QuarterlyReview table: a per-user, per-quarter placement on the
-- Performance x Potential succession matrix. Both axes REUSE the live
-- GoalRatingColor enum; the matrix LABEL is never persisted (it is derived
-- purely from the two ratings in lib/matrix.ts). successionFlag is stored so
-- the CPO dashboard can filter candidates without recomputing.
-- @@unique(userId, quarter) guarantees exactly one review per user/quarter.
-- Written idempotently (IF NOT EXISTS / DO $$ guards) to match repo convention.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "QuarterlyReviewDecision" AS ENUM (
    'PROMOTION',
    'ACHIEVEMENT_AWARD',
    'ROLE_CHANGE',
    'PIP',
    'CONTINUATION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "QuarterlyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "quarter" TEXT NOT NULL,
    "performanceRating" "GoalRatingColor" NOT NULL,
    "potentialRating" "GoalRatingColor" NOT NULL,
    "decision" "QuarterlyReviewDecision" NOT NULL,
    "successionFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuarterlyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "QuarterlyReview_userId_quarter_key" ON "QuarterlyReview"("userId", "quarter");
CREATE INDEX IF NOT EXISTS "QuarterlyReview_userId_idx" ON "QuarterlyReview"("userId");
CREATE INDEX IF NOT EXISTS "QuarterlyReview_createdById_idx" ON "QuarterlyReview"("createdById");
CREATE INDEX IF NOT EXISTS "QuarterlyReview_successionFlag_idx" ON "QuarterlyReview"("successionFlag");

-- AddForeignKey: QuarterlyReview -> User (subject)
DO $$ BEGIN
  ALTER TABLE "QuarterlyReview" ADD CONSTRAINT "QuarterlyReview_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: QuarterlyReview -> User (author)
DO $$ BEGIN
  ALTER TABLE "QuarterlyReview" ADD CONSTRAINT "QuarterlyReview_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
