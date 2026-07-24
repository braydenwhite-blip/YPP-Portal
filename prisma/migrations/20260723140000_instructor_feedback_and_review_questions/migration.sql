-- Instructor received feedback (manual email logging) + configurable GR questions.

DO $$ BEGIN
  CREATE TYPE "InstructorFeedbackSource" AS ENUM ('PARENT', 'STUDENT', 'PARTNER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InstructorReceivedFeedback" (
  "id" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "source" "InstructorFeedbackSource" NOT NULL,
  "feedbackDate" TIMESTAMP(3) NOT NULL,
  "category" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorReceivedFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorReceivedFeedback_instructorId_feedbackDate_idx"
  ON "InstructorReceivedFeedback"("instructorId", "feedbackDate");
CREATE INDEX IF NOT EXISTS "InstructorReceivedFeedback_source_category_idx"
  ON "InstructorReceivedFeedback"("source", "category");
CREATE INDEX IF NOT EXISTS "InstructorReceivedFeedback_createdById_idx"
  ON "InstructorReceivedFeedback"("createdById");

DO $$ BEGIN
  ALTER TABLE "InstructorReceivedFeedback"
    ADD CONSTRAINT "InstructorReceivedFeedback_instructorId_fkey"
    FOREIGN KEY ("instructorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorReceivedFeedback"
    ADD CONSTRAINT "InstructorReceivedFeedback_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InstructorReviewQuestion" (
  "id" TEXT NOT NULL,
  "prompt" TEXT NOT NULL,
  "category" TEXT,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "optionsJson" TEXT NOT NULL,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorReviewQuestion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InstructorReviewQuestion_isActive_sortOrder_idx"
  ON "InstructorReviewQuestion"("isActive", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "InstructorReviewQuestion"
    ADD CONSTRAINT "InstructorReviewQuestion_updatedById_fkey"
    FOREIGN KEY ("updatedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InstructorReviewAnswer" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "rating" INTEGER,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InstructorReviewAnswer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorReviewAnswer_reviewId_questionId_key"
  ON "InstructorReviewAnswer"("reviewId", "questionId");
CREATE INDEX IF NOT EXISTS "InstructorReviewAnswer_instructorId_createdAt_idx"
  ON "InstructorReviewAnswer"("instructorId", "createdAt");
CREATE INDEX IF NOT EXISTS "InstructorReviewAnswer_questionId_idx"
  ON "InstructorReviewAnswer"("questionId");
CREATE INDEX IF NOT EXISTS "InstructorReviewAnswer_authorId_idx"
  ON "InstructorReviewAnswer"("authorId");

DO $$ BEGIN
  ALTER TABLE "InstructorReviewAnswer"
    ADD CONSTRAINT "InstructorReviewAnswer_questionId_fkey"
    FOREIGN KEY ("questionId") REFERENCES "InstructorReviewQuestion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorReviewAnswer"
    ADD CONSTRAINT "InstructorReviewAnswer_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "MentorGoalReview"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "InstructorReviewAnswer"
    ADD CONSTRAINT "InstructorReviewAnswer_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Seed a starter question set (idempotent via prompt match).
INSERT INTO "InstructorReviewQuestion" ("id", "prompt", "category", "sortOrder", "isActive", "optionsJson", "createdAt", "updatedAt")
SELECT
  'irq_prep_' || md5(prompt),
  prompt,
  category,
  sort_order,
  true,
  options_json,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (VALUES
  ('How prepared was the instructor for class sessions?', 'Preparation', 10, '["1 - Not prepared","2","3","4","5 - Fully prepared"]'),
  ('How effectively did they engage students?', 'Teaching', 20, '["1 - Needs work","2","3","4","5 - Excellent"]'),
  ('How reliable were they with communication and follow-through?', 'Reliability', 30, '["1 - Unreliable","2","3","4","5 - Very reliable"]')
) AS seed(prompt, category, sort_order, options_json)
WHERE NOT EXISTS (
  SELECT 1 FROM "InstructorReviewQuestion" q WHERE q."prompt" = seed.prompt
);
