-- Quarterly Role Committee Review + Pathway Decision (Phase 2).
--
-- Purely additive: two new tables plus one new enum. Does NOT touch
-- QuarterlyReview or its (userId, quarter) unique constraint — that model is
-- a live, leadership-only succession-matrix tool with its own single-author
-- upsert (lib/people-strategy/quarterly-review-actions.ts) and must keep
-- working unchanged. MentorshipQuarterlyReview is a separate table with its
-- own (mentorshipId, quarter) uniqueness, reusing QuarterlyReviewDecision
-- only as a value vocabulary, never as a foreign key or shared row.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorshipQuarterlyReviewStatus') THEN
    CREATE TYPE "MentorshipQuarterlyReviewStatus" AS ENUM (
      'DRAFT',
      'PENDING_CHAIR_APPROVAL',
      'CHANGES_REQUESTED',
      'PENDING_BOARD_APPROVAL',
      'APPROVED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MentorshipQuarterlyReview" (
  "id" TEXT NOT NULL,
  "mentorshipId" TEXT NOT NULL,
  "menteeId" TEXT NOT NULL,
  "quarter" TEXT NOT NULL,
  "cycleNumber" INTEGER NOT NULL,
  "broaderFeedbackSummary" TEXT,
  "committeeNotes" TEXT,
  "decision" "QuarterlyReviewDecision",
  "decisionRationale" TEXT,
  "status" "MentorshipQuarterlyReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "recommendedById" TEXT,
  "recommendedAt" TIMESTAMP(3),
  "chairApproverId" TEXT,
  "chairApprovedAt" TIMESTAMP(3),
  "chairComments" TEXT,
  "requiresBoardApproval" BOOLEAN NOT NULL DEFAULT false,
  "boardApproverId" TEXT,
  "boardApprovedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MentorshipQuarterlyReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipQuarterlyReview_mentorshipId_quarter_key"
  ON "MentorshipQuarterlyReview"("mentorshipId", "quarter");
CREATE INDEX IF NOT EXISTS "MentorshipQuarterlyReview_menteeId_idx"
  ON "MentorshipQuarterlyReview"("menteeId");
CREATE INDEX IF NOT EXISTS "MentorshipQuarterlyReview_status_idx"
  ON "MentorshipQuarterlyReview"("status");

DO $$ BEGIN
  ALTER TABLE "MentorshipQuarterlyReview" ADD CONSTRAINT "MentorshipQuarterlyReview_mentorshipId_fkey"
    FOREIGN KEY ("mentorshipId") REFERENCES "Mentorship"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipQuarterlyReview" ADD CONSTRAINT "MentorshipQuarterlyReview_menteeId_fkey"
    FOREIGN KEY ("menteeId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipQuarterlyReview" ADD CONSTRAINT "MentorshipQuarterlyReview_recommendedById_fkey"
    FOREIGN KEY ("recommendedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipQuarterlyReview" ADD CONSTRAINT "MentorshipQuarterlyReview_chairApproverId_fkey"
    FOREIGN KEY ("chairApproverId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipQuarterlyReview" ADD CONSTRAINT "MentorshipQuarterlyReview_boardApproverId_fkey"
    FOREIGN KEY ("boardApproverId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Evidence join: which monthly MentorGoalReviews a quarterly review is based on.
CREATE TABLE IF NOT EXISTS "MentorshipQuarterlyReviewEvidence" (
  "id" TEXT NOT NULL,
  "quarterlyReviewId" TEXT NOT NULL,
  "monthlyReviewId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MentorshipQuarterlyReviewEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipQuarterlyReviewEvidence_quarterlyReviewId_monthlyReviewId_key"
  ON "MentorshipQuarterlyReviewEvidence"("quarterlyReviewId", "monthlyReviewId");
CREATE INDEX IF NOT EXISTS "MentorshipQuarterlyReviewEvidence_monthlyReviewId_idx"
  ON "MentorshipQuarterlyReviewEvidence"("monthlyReviewId");

DO $$ BEGIN
  ALTER TABLE "MentorshipQuarterlyReviewEvidence" ADD CONSTRAINT "MentorshipQuarterlyReviewEvidence_quarterlyReviewId_fkey"
    FOREIGN KEY ("quarterlyReviewId") REFERENCES "MentorshipQuarterlyReview"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "MentorshipQuarterlyReviewEvidence" ADD CONSTRAINT "MentorshipQuarterlyReviewEvidence_monthlyReviewId_fkey"
    FOREIGN KEY ("monthlyReviewId") REFERENCES "MentorGoalReview"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
