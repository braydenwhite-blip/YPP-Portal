-- Universal Performance-Development Cycle — foundation schema.
--
-- Purely additive: one new enum (GRGoalKind), and nullable columns/FKs on
-- existing models so the review cycle (process), review document (artifact),
-- and current G&R (living state) stay distinct while sharing one page/flow.
-- No existing column is altered or dropped; no MentorshipCycleStage enum
-- values are added (comment-collection status is a live-computed dimension,
-- never a stored stage — see lib/mentorship/lifecycle.ts).

-- CreateEnum: GRGoalKind — distinguishes a normal time-phased goal from a
-- fixed competency-rubric row that is copied once and re-rated every cycle.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GRGoalKind') THEN
    CREATE TYPE "GRGoalKind" AS ENUM ('GOAL', 'COMPETENCY');
  END IF;
END $$;

-- GRTemplate: competency-rubric columns + editable default reflection questions.
ALTER TABLE "GRTemplate"
  ADD COLUMN IF NOT EXISTS "columns" JSONB,
  ADD COLUMN IF NOT EXISTS "reflectionQuestions" JSONB;

-- GRTemplateGoal: kind discriminator + per-column guidance bullets.
ALTER TABLE "GRTemplateGoal"
  ADD COLUMN IF NOT EXISTS "kind" "GRGoalKind" NOT NULL DEFAULT 'GOAL',
  ADD COLUMN IF NOT EXISTS "levelGuidance" JSONB;

CREATE INDEX IF NOT EXISTS "GRTemplateGoal_templateId_kind_idx"
  ON "GRTemplateGoal"("templateId", "kind");

-- GRDocumentGoal: same kind discriminator, per-person instance side.
ALTER TABLE "GRDocumentGoal"
  ADD COLUMN IF NOT EXISTS "kind" "GRGoalKind" NOT NULL DEFAULT 'GOAL';

CREATE INDEX IF NOT EXISTS "GRDocumentGoal_documentId_kind_idx"
  ON "GRDocumentGoal"("documentId", "kind");

-- ReviewCycle: per-cycle reflection question wording override.
ALTER TABLE "ReviewCycle"
  ADD COLUMN IF NOT EXISTS "reflectionQuestionsJson" JSONB;

-- FeedbackRequest: merge into the universal review cycle (link + cancel),
-- instead of remaining a fully standalone People Strategy feature.
ALTER TABLE "FeedbackRequest"
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "reviewCycleParticipantId" TEXT;

CREATE INDEX IF NOT EXISTS "FeedbackRequest_reviewCycleParticipantId_idx"
  ON "FeedbackRequest"("reviewCycleParticipantId");

DO $$ BEGIN
  ALTER TABLE "FeedbackRequest" ADD CONSTRAINT "FeedbackRequest_reviewCycleParticipantId_fkey"
    FOREIGN KEY ("reviewCycleParticipantId") REFERENCES "ReviewCycleParticipant"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- MentorGoalReview: snapshot which template version + rubric column/level
-- this review was written against, so later template edits or promotions
-- never rewrite how a historical review reads.
ALTER TABLE "MentorGoalReview"
  ADD COLUMN IF NOT EXISTS "templateVersion" INTEGER,
  ADD COLUMN IF NOT EXISTS "columnLabel" TEXT;

-- MentorGoalReviewGoalSnapshot: freeze competency guidance/rating-label copy
-- at submit time, mirroring the existing goal-field snapshot columns.
ALTER TABLE "MentorGoalReviewGoalSnapshot"
  ADD COLUMN IF NOT EXISTS "levelGuidanceAtSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "ratingLabelsAtSnapshot" JSONB;

-- GoalReviewRating: carry a mentor's proposed goal progress/lifecycle update
-- from submit time through to chair approval. Applied to the live
-- GRDocumentGoal only in approveGoalReview() (release) — never at
-- draft/submit time, so a pending review can't change the person's current
-- G&R before it's actually approved.
ALTER TABLE "GoalReviewRating"
  ADD COLUMN IF NOT EXISTS "proposedProgressState" "GoalProgressState",
  ADD COLUMN IF NOT EXISTS "proposedLifecycleStatus" "GoalLifecycleStatus";

-- MentorshipActionItem: the other direction from sourceReviewId — which
-- current-G&R goal this action item advances, so completed work between
-- reviews becomes that goal's evidence trail for the next cycle.
ALTER TABLE "MentorshipActionItem"
  ADD COLUMN IF NOT EXISTS "grDocumentGoalId" TEXT;

CREATE INDEX IF NOT EXISTS "MentorshipActionItem_grDocumentGoalId_idx"
  ON "MentorshipActionItem"("grDocumentGoalId");

DO $$ BEGIN
  ALTER TABLE "MentorshipActionItem" ADD CONSTRAINT "MentorshipActionItem_grDocumentGoalId_fkey"
    FOREIGN KEY ("grDocumentGoalId") REFERENCES "GRDocumentGoal"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
