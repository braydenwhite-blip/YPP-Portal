-- Migration: add_people_strategy_check_in
-- People Strategy — Monthly Check-Ins & Quarterly Reviews (ENABLE_QUARTERLY_REVIEWS).
-- Adds the CheckIn table: a per-user, per-month COMPILATION that references the
-- existing MonthlySelfReflection and MentorGoalReview and stores a
-- performanceRating DERIVED from the live GoalRatingColor goal-progress data.
-- It does NOT introduce a new rating enum or a second monthly performance input.
-- @@unique(userId, month) guarantees exactly one check-in per user/month.
-- Written idempotently (IF NOT EXISTS / DO $$ guards) to match repo convention.

-- CreateTable
CREATE TABLE IF NOT EXISTS "CheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "selfReflectionId" TEXT,
    "mentorGoalReviewId" TEXT,
    "performanceRating" "GoalRatingColor",
    "compiledNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CheckIn_userId_month_key" ON "CheckIn"("userId", "month");
CREATE INDEX IF NOT EXISTS "CheckIn_userId_idx" ON "CheckIn"("userId");
CREATE INDEX IF NOT EXISTS "CheckIn_selfReflectionId_idx" ON "CheckIn"("selfReflectionId");
CREATE INDEX IF NOT EXISTS "CheckIn_mentorGoalReviewId_idx" ON "CheckIn"("mentorGoalReviewId");

-- AddForeignKey: CheckIn -> User
DO $$ BEGIN
  ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: CheckIn -> MonthlySelfReflection
DO $$ BEGIN
  ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_selfReflectionId_fkey"
    FOREIGN KEY ("selfReflectionId") REFERENCES "MonthlySelfReflection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey: CheckIn -> MentorGoalReview
DO $$ BEGIN
  ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_mentorGoalReviewId_fkey"
    FOREIGN KEY ("mentorGoalReviewId") REFERENCES "MentorGoalReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
