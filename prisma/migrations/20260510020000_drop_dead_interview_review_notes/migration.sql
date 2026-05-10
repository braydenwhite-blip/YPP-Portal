-- Migration: drop_dead_interview_review_notes
-- Removes seven columns on InstructorInterviewReview that were stored but never
-- editable from the live interview workspace. The category-level notes
-- (InstructorInterviewReviewCategory.notes) and per-question notes
-- (InstructorInterviewQuestionResponse.notes) replace these fields.
--
-- Idempotent: uses IF EXISTS so reruns are safe.

ALTER TABLE "InstructorInterviewReview" DROP COLUMN IF EXISTS "overallNotes";
ALTER TABLE "InstructorInterviewReview" DROP COLUMN IF EXISTS "demeanorNotes";
ALTER TABLE "InstructorInterviewReview" DROP COLUMN IF EXISTS "maturityNotes";
ALTER TABLE "InstructorInterviewReview" DROP COLUMN IF EXISTS "communicationNotes";
ALTER TABLE "InstructorInterviewReview" DROP COLUMN IF EXISTS "professionalismNotes";
ALTER TABLE "InstructorInterviewReview" DROP COLUMN IF EXISTS "followUpItems";
ALTER TABLE "InstructorInterviewReview" DROP COLUMN IF EXISTS "curriculumFeedback";
