-- G&R Loop Upgrades: unified goal ratings, lifecycle tracking, monthly phase,
-- goal snapshots, notification deduplication.

-- ============================================================
-- 1. New NotificationType values
-- ============================================================
DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GR_REFLECTION_DUE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GR_REVIEW_DUE';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GR_CHAIR_APPROVAL_PENDING';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'GR_REVIEW_RELEASED';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. Notification.dedupeKey
-- ============================================================
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
CREATE INDEX IF NOT EXISTS "Notification_dedupeKey_createdAt_idx" ON "Notification"("dedupeKey", "createdAt");

-- ============================================================
-- 3. GoalReviewRating: make goalId nullable, add grDocumentGoalId
-- ============================================================
ALTER TABLE "GoalReviewRating" ALTER COLUMN "goalId" DROP NOT NULL;

ALTER TABLE "GoalReviewRating" ADD COLUMN IF NOT EXISTS "grDocumentGoalId" TEXT;

DO $$ BEGIN
  ALTER TABLE "GoalReviewRating"
    ADD CONSTRAINT "GoalReviewRating_grDocumentGoalId_fkey"
    FOREIGN KEY ("grDocumentGoalId")
    REFERENCES "GRDocumentGoal"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop old unique and replace with non-unique index + partial unique indexes
DROP INDEX IF EXISTS "GoalReviewRating_reviewId_goalId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "GoalReviewRating_reviewId_goalId_uidx"
  ON "GoalReviewRating"("reviewId", "goalId")
  WHERE "goalId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "GoalReviewRating_reviewId_grDocumentGoalId_uidx"
  ON "GoalReviewRating"("reviewId", "grDocumentGoalId")
  WHERE "grDocumentGoalId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "GoalReviewRating_reviewId_idx" ON "GoalReviewRating"("reviewId");
CREATE INDEX IF NOT EXISTS "GoalReviewRating_grDocumentGoalId_idx" ON "GoalReviewRating"("grDocumentGoalId");

-- ============================================================
-- 4. New enum values for GRTimePhase
-- ============================================================
DO $$ BEGIN
  ALTER TYPE "GRTimePhase" ADD VALUE IF NOT EXISTS 'LONG_TERM';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "GRTimePhase" ADD VALUE IF NOT EXISTS 'MONTHLY';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. New enums: GoalLifecycleStatus, GoalProgressState, GoalPriority
-- ============================================================
DO $$ BEGIN
  CREATE TYPE "GoalLifecycleStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoalProgressState" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "GoalPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. GRTemplate.maxActiveMonthlyGoals
-- ============================================================
ALTER TABLE "GRTemplate" ADD COLUMN IF NOT EXISTS "maxActiveMonthlyGoals" INTEGER NOT NULL DEFAULT 5;

-- ============================================================
-- 7. GRDocumentGoal new fields
-- ============================================================
ALTER TABLE "GRDocumentGoal"
  ADD COLUMN IF NOT EXISTS "lifecycleStatus" "GoalLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS "progressState"   "GoalProgressState"   NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS "priority"        "GoalPriority"        NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS "dueDate"         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "completedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "sourceReviewId"  TEXT;

DO $$ BEGIN
  ALTER TABLE "GRDocumentGoal"
    ADD CONSTRAINT "GRDocumentGoal_sourceReviewId_fkey"
    FOREIGN KEY ("sourceReviewId")
    REFERENCES "MentorGoalReview"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "GRDocumentGoal_documentId_lifecycleStatus_dueDate_idx"
  ON "GRDocumentGoal"("documentId", "lifecycleStatus", "dueDate");

-- ============================================================
-- 8. MentorGoalReviewGoalSnapshot table
-- ============================================================
CREATE TABLE IF NOT EXISTS "MentorGoalReviewGoalSnapshot" (
  "id"                        TEXT NOT NULL,
  "reviewId"                  TEXT NOT NULL,
  "grDocumentGoalId"          TEXT,
  "title"                     TEXT NOT NULL,
  "description"               TEXT NOT NULL,
  "timePhase"                 "GRTimePhase" NOT NULL,
  "priority"                  "GoalPriority" NOT NULL DEFAULT 'NORMAL',
  "dueDateAtSnapshot"         TIMESTAMPTZ,
  "lifecycleStatusAtSnapshot" "GoalLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MentorGoalReviewGoalSnapshot_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "MentorGoalReviewGoalSnapshot"
    ADD CONSTRAINT "MentorGoalReviewGoalSnapshot_reviewId_fkey"
    FOREIGN KEY ("reviewId")
    REFERENCES "MentorGoalReview"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "MentorGoalReviewGoalSnapshot"
    ADD CONSTRAINT "MentorGoalReviewGoalSnapshot_grDocumentGoalId_fkey"
    FOREIGN KEY ("grDocumentGoalId")
    REFERENCES "GRDocumentGoal"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "MentorGoalReviewGoalSnapshot_reviewId_idx"
  ON "MentorGoalReviewGoalSnapshot"("reviewId");

CREATE INDEX IF NOT EXISTS "MentorGoalReviewGoalSnapshot_grDocumentGoalId_idx"
  ON "MentorGoalReviewGoalSnapshot"("grDocumentGoalId");
