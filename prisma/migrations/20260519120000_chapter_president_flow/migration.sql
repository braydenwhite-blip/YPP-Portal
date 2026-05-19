-- Migration: chapter_president_flow
-- Builds out the chapter president lifecycle:
--  * decisionRecommendation + recommendationRationale on
--    ChapterPresidentApplication so the RECOMMENDATION_SUBMITTED stage
--    carries a real recommendation + rationale into the final decision.
--  * chapterGoals + introMessage on ChapterPresidentOnboarding so the
--    onboarding steps capture real content instead of bare checkboxes.

ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "decisionRecommendation" "HiringRecommendation",
  ADD COLUMN IF NOT EXISTS "recommendationRationale" TEXT;

ALTER TABLE "ChapterPresidentOnboarding"
  ADD COLUMN IF NOT EXISTS "chapterGoals" TEXT,
  ADD COLUMN IF NOT EXISTS "introMessage" TEXT;
