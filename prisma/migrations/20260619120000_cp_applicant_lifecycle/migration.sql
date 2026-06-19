-- Chapter President applicant lifecycle expansion.
-- Additive by design: legacy CP statuses remain valid so existing rows and
-- older imports continue to read while the portal moves to the clearer CP flow.

ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'INITIAL_REVIEW';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'NEEDS_MORE_INFO';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'INTERVIEW_NEEDED';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'INTERVIEW_COMPLETE';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'DECISION_NEEDED';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'ACCEPTED';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'DECLINED';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'ONBOARDING';
ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'ACTIVE_CP';

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "grade" TEXT,
  ADD COLUMN IF NOT EXISTS "currentYppInvolvement" TEXT,
  ADD COLUMN IF NOT EXISTS "communityServiceExperience" TEXT,
  ADD COLUMN IF NOT EXISTS "potentialChapterLocation" TEXT,
  ADD COLUMN IF NOT EXISTS "firstThreeActions" TEXT,
  ADD COLUMN IF NOT EXISTS "scoreRecruiting" INTEGER,
  ADD COLUMN IF NOT EXISTS "scoreOverallConfidence" INTEGER,
  ADD COLUMN IF NOT EXISTS "interviewNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "interviewScore" INTEGER,
  ADD COLUMN IF NOT EXISTS "interviewConcerns" TEXT,
  ADD COLUMN IF NOT EXISTS "interviewFollowUpQuestions" TEXT,
  ADD COLUMN IF NOT EXISTS "finalDecisionNote" TEXT,
  ADD COLUMN IF NOT EXISTS "decisionMakerId" TEXT,
  ADD COLUMN IF NOT EXISTS "decisionAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptanceEmailSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "linkedPersonId" TEXT,
  ADD COLUMN IF NOT EXISTS "roleAssignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "mentorAdvisorId" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "starterActionsCreatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activeAt" TIMESTAMP(3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentApplication_decisionMakerId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentApplication"
      ADD CONSTRAINT "ChapterPresidentApplication_decisionMakerId_fkey"
      FOREIGN KEY ("decisionMakerId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentApplication_linkedPersonId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentApplication"
      ADD CONSTRAINT "ChapterPresidentApplication_linkedPersonId_fkey"
      FOREIGN KEY ("linkedPersonId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ChapterPresidentApplication_mentorAdvisorId_fkey'
  ) THEN
    ALTER TABLE "ChapterPresidentApplication"
      ADD CONSTRAINT "ChapterPresidentApplication_mentorAdvisorId_fkey"
      FOREIGN KEY ("mentorAdvisorId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_decisionMakerId_idx"
  ON "ChapterPresidentApplication"("decisionMakerId");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_linkedPersonId_idx"
  ON "ChapterPresidentApplication"("linkedPersonId");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_mentorAdvisorId_idx"
  ON "ChapterPresidentApplication"("mentorAdvisorId");

CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_activeAt_idx"
  ON "ChapterPresidentApplication"("activeAt");
