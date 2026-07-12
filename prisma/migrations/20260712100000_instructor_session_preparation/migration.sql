-- Link each class session to its exact reusable lesson plan and record
-- per-instructor preparation review. Idempotent so deploy retries are safe.

ALTER TABLE "ClassSession"
  ADD COLUMN IF NOT EXISTS "lessonPlanId" TEXT;

CREATE INDEX IF NOT EXISTS "ClassSession_lessonPlanId_idx"
  ON "ClassSession"("lessonPlanId");

DO $$ BEGIN
  ALTER TABLE "ClassSession"
    ADD CONSTRAINT "ClassSession_lessonPlanId_fkey"
    FOREIGN KEY ("lessonPlanId") REFERENCES "LessonPlan"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "InstructorSessionPreparation" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "instructorId" TEXT NOT NULL,
  "lessonReviewedAt" TIMESTAMP(3),
  "materialsReviewedAt" TIMESTAMP(3),
  "studentContextReviewedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "reviewFingerprint" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InstructorSessionPreparation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InstructorSessionPreparation"
  ADD COLUMN IF NOT EXISTS "reviewFingerprint" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "InstructorSessionPreparation_sessionId_instructorId_key"
  ON "InstructorSessionPreparation"("sessionId", "instructorId");

CREATE INDEX IF NOT EXISTS "InstructorSessionPreparation_instructorId_completedAt_idx"
  ON "InstructorSessionPreparation"("instructorId", "completedAt");

DO $$ BEGIN
  ALTER TABLE "InstructorSessionPreparation"
    ADD CONSTRAINT "InstructorSessionPreparation_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ClassSession"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
