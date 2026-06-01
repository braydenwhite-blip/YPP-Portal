-- Migration: add_feedback_request
-- People Strategy — 360-style monthly feedback requests (gated by
-- ENABLE_ACTION_TRACKER_EMAILS). One row per (subject, collaborator, month);
-- `responseBody` is confidential and only the CPO/Board may read it. The unique
-- (subjectUserId, collaboratorId, month) constraint makes sendFeedbackRequest
-- idempotent across re-runs.
-- Written idempotently (IF NOT EXISTS / DO $$ guards) to match the repo's
-- migration convention.

-- CreateTable
CREATE TABLE IF NOT EXISTS "FeedbackRequest" (
    "id" TEXT NOT NULL,
    "subjectUserId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "responseBody" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FeedbackRequest_subjectUserId_collaboratorId_month_key" ON "FeedbackRequest"("subjectUserId", "collaboratorId", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeedbackRequest_subjectUserId_month_idx" ON "FeedbackRequest"("subjectUserId", "month");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeedbackRequest_collaboratorId_submittedAt_idx" ON "FeedbackRequest"("collaboratorId", "submittedAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_subjectUserId_fkey" FOREIGN KEY ("subjectUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
