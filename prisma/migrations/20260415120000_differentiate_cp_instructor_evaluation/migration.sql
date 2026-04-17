-- Differentiate Chapter President (true interview) from Instructor (curriculum review) evaluations.
-- Adds:
--   1. RECOMMENDATION_SUBMITTED status to ChapterPresidentApplicationStatus enum
--   2. Interview-specific score fields + interviewSummary on ChapterPresidentApplication
--   3. Curriculum-review-specific score fields + curriculumReviewSummary on InstructorApplication

-- 1. Add RECOMMENDATION_SUBMITTED to ChapterPresidentApplicationStatus enum
DO $$ BEGIN
  ALTER TYPE "ChapterPresidentApplicationStatus" ADD VALUE IF NOT EXISTS 'RECOMMENDATION_SUBMITTED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Chapter President Application: interview rubric fields
ALTER TABLE "ChapterPresidentApplication"
  ADD COLUMN IF NOT EXISTS "scoreCommunication" INTEGER,
  ADD COLUMN IF NOT EXISTS "interviewSummary"   TEXT;

-- 3. Instructor Application: curriculum review rubric fields
ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "scoreSubjectKnowledge"    INTEGER,
  ADD COLUMN IF NOT EXISTS "scoreTeachingMethodology" INTEGER,
  ADD COLUMN IF NOT EXISTS "scoreCurriculumAlignment" INTEGER,
  ADD COLUMN IF NOT EXISTS "curriculumReviewSummary"  TEXT;
