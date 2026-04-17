-- Migration: instructor_review_workflow
-- Adds structured application and interview review workflow for instructor applicants.

ALTER TYPE "InstructorApplicationStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';

CREATE TYPE "StructuredReviewStatus" AS ENUM ('DRAFT', 'SUBMITTED');
CREATE TYPE "InstructorReviewCategoryKey" AS ENUM (
  'CURRICULUM_STRENGTH',
  'RELATIONSHIP_BUILDING',
  'ORGANIZATION_AND_COMMITMENT',
  'COMMUNITY_FIT',
  'LONG_TERM_POTENTIAL',
  'PROFESSIONALISM_AND_FOLLOW_THROUGH'
);
CREATE TYPE "InstructorApplicationNextStep" AS ENUM (
  'MOVE_TO_INTERVIEW',
  'REQUEST_INFO',
  'HOLD',
  'REJECT'
);
CREATE TYPE "InstructorInterviewRecommendation" AS ENUM (
  'ACCEPT',
  'ACCEPT_WITH_REVISIONS',
  'HOLD',
  'REJECT'
);
CREATE TYPE "InterviewQuestionSource" AS ENUM ('DEFAULT', 'CUSTOM');

CREATE TABLE "InstructorApplicationReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "curriculumDraftId" TEXT,
    "status" "StructuredReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "isLeadReview" BOOLEAN NOT NULL DEFAULT false,
    "overallRating" "ProgressStatus",
    "nextStep" "InstructorApplicationNextStep",
    "summary" TEXT,
    "notes" TEXT,
    "concerns" TEXT,
    "applicantMessage" TEXT,
    "flagForLeadership" BOOLEAN NOT NULL DEFAULT false,
    "draftOverrideUsed" BOOLEAN NOT NULL DEFAULT false,
    "draftOverrideReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorApplicationReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorApplicationReviewCategory" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "category" "InstructorReviewCategoryKey" NOT NULL,
    "rating" "ProgressStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorApplicationReviewCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorInterviewQuestionBank" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "helperText" TEXT,
    "followUpPrompt" TEXT,
    "topic" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorInterviewQuestionBank_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorInterviewReview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "curriculumDraftId" TEXT,
    "status" "StructuredReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "isLeadReview" BOOLEAN NOT NULL DEFAULT false,
    "overallRating" "ProgressStatus",
    "recommendation" "InstructorInterviewRecommendation",
    "summary" TEXT,
    "overallNotes" TEXT,
    "curriculumFeedback" TEXT,
    "revisionRequirements" TEXT,
    "applicantMessage" TEXT,
    "flagForLeadership" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorInterviewReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorInterviewReviewCategory" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "category" "InstructorReviewCategoryKey" NOT NULL,
    "rating" "ProgressStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorInterviewReviewCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InstructorInterviewQuestionResponse" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "questionBankId" TEXT,
    "source" "InterviewQuestionSource" NOT NULL DEFAULT 'DEFAULT',
    "prompt" TEXT NOT NULL,
    "followUpPrompt" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorInterviewQuestionResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InstructorApplicationReview_applicationId_reviewerId_key" ON "InstructorApplicationReview"("applicationId", "reviewerId");
CREATE INDEX "InstructorApplicationReview_applicationId_isLeadReview_idx" ON "InstructorApplicationReview"("applicationId", "isLeadReview");
CREATE INDEX "InstructorApplicationReview_reviewerId_status_idx" ON "InstructorApplicationReview"("reviewerId", "status");
CREATE INDEX "InstructorApplicationReview_curriculumDraftId_idx" ON "InstructorApplicationReview"("curriculumDraftId");

CREATE UNIQUE INDEX "InstructorApplicationReviewCategory_reviewId_category_key" ON "InstructorApplicationReviewCategory"("reviewId", "category");
CREATE INDEX "InstructorApplicationReviewCategory_category_idx" ON "InstructorApplicationReviewCategory"("category");

CREATE UNIQUE INDEX "InstructorInterviewQuestionBank_slug_key" ON "InstructorInterviewQuestionBank"("slug");
CREATE INDEX "InstructorInterviewQuestionBank_isActive_sortOrder_idx" ON "InstructorInterviewQuestionBank"("isActive", "sortOrder");

CREATE UNIQUE INDEX "InstructorInterviewReview_applicationId_reviewerId_key" ON "InstructorInterviewReview"("applicationId", "reviewerId");
CREATE INDEX "InstructorInterviewReview_applicationId_isLeadReview_idx" ON "InstructorInterviewReview"("applicationId", "isLeadReview");
CREATE INDEX "InstructorInterviewReview_reviewerId_status_idx" ON "InstructorInterviewReview"("reviewerId", "status");
CREATE INDEX "InstructorInterviewReview_curriculumDraftId_idx" ON "InstructorInterviewReview"("curriculumDraftId");

CREATE UNIQUE INDEX "InstructorInterviewReviewCategory_reviewId_category_key" ON "InstructorInterviewReviewCategory"("reviewId", "category");
CREATE INDEX "InstructorInterviewReviewCategory_category_idx" ON "InstructorInterviewReviewCategory"("category");

CREATE INDEX "InstructorInterviewQuestionResponse_reviewId_sortOrder_idx" ON "InstructorInterviewQuestionResponse"("reviewId", "sortOrder");
CREATE INDEX "InstructorInterviewQuestionResponse_questionBankId_idx" ON "InstructorInterviewQuestionResponse"("questionBankId");

ALTER TABLE "InstructorApplicationReview"
  ADD CONSTRAINT "InstructorApplicationReview_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "InstructorApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationReview"
  ADD CONSTRAINT "InstructorApplicationReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationReview"
  ADD CONSTRAINT "InstructorApplicationReview_curriculumDraftId_fkey"
  FOREIGN KEY ("curriculumDraftId") REFERENCES "CurriculumDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorApplicationReviewCategory"
  ADD CONSTRAINT "InstructorApplicationReviewCategory_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "InstructorApplicationReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewReview"
  ADD CONSTRAINT "InstructorInterviewReview_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "InstructorApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewReview"
  ADD CONSTRAINT "InstructorInterviewReview_reviewerId_fkey"
  FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewReview"
  ADD CONSTRAINT "InstructorInterviewReview_curriculumDraftId_fkey"
  FOREIGN KEY ("curriculumDraftId") REFERENCES "CurriculumDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewReviewCategory"
  ADD CONSTRAINT "InstructorInterviewReviewCategory_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "InstructorInterviewReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewQuestionResponse"
  ADD CONSTRAINT "InstructorInterviewQuestionResponse_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "InstructorInterviewReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InstructorInterviewQuestionResponse"
  ADD CONSTRAINT "InstructorInterviewQuestionResponse_questionBankId_fkey"
  FOREIGN KEY ("questionBankId") REFERENCES "InstructorInterviewQuestionBank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "InstructorInterviewQuestionBank" ("id", "slug", "prompt", "helperText", "followUpPrompt", "topic", "sortOrder", "isActive", "createdAt", "updatedAt")
VALUES
  ('iqb_motivation', 'motivation_for_applying', 'Why do you want to teach this class through YPP?', 'Look for authentic motivation, student-centered purpose, and clarity about what they want students to gain.', 'What would make this class meaningful for students in your chapter?', 'Motivation', 1, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_subject', 'passion_for_subject', 'What makes this topic exciting enough that students would want to keep showing up for it?', 'Probe for genuine enthusiasm and whether the idea feels compelling, not just technically interesting.', 'What part of this topic do you think students will care about most?', 'Subject Passion', 2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_community', 'community_fit', 'How do you see yourself contributing to the YPP community beyond teaching one class?', 'Listen for collaboration, chapter-mindedness, and willingness to invest in the community.', 'How would you build trust with families and other chapter leaders?', 'Community Fit', 3, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_structure', 'class_structure', 'Walk us through the structure of your class and how students would move through it week by week.', 'Review whether the class has a realistic flow, strong sequencing, and a teachable scope.', 'Where do you expect students to struggle, and how would you support them?', 'Class Structure', 4, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_teach', 'teach_in_60_seconds', 'Explain a concept from your class in 60 seconds the way you would actually teach it.', 'This is the core teaching-performance question. Focus on clarity, pacing, warmth, and whether they can truly teach the material.', 'What would you do if students looked confused after that explanation?', 'Teaching Demo', 5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_experience', 'prior_teaching_experience', 'What prior teaching, tutoring, mentoring, or facilitation experience has prepared you for this role?', 'Look for real evidence of leading others, adapting explanations, and handling mixed readiness levels.', 'What did that experience teach you about working with students?', 'Prior Experience', 6, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_commitment', 'time_commitment', 'What else is on your plate, and how will you make sure you can stay organized and responsive if you teach with YPP?', 'Probe reliability, responsiveness, and seriousness of commitment.', 'What would your communication habits look like with parents and chapter leadership?', 'Commitment', 7, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_student', 'student_scenario', 'How would you respond if a student in your class seemed disengaged, discouraged, or far behind?', 'Look for warmth, maturity, and practical support strategies.', 'How would you keep standards high while still supporting that student?', 'Student Scenario', 8, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('iqb_parent', 'parent_scenario', 'How would you handle a parent who was worried that the class was disorganized or not meeting expectations?', 'Probe communication, professionalism, trust-building, and ownership.', 'What would you say, and what follow-up would you make sure happened next?', 'Parent Scenario', 9, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
