ALTER TABLE "InstructorApplication" ADD COLUMN IF NOT EXISTS "courseIdea" TEXT;

UPDATE "InstructorApplication"
SET "courseIdea" = "textbook"
WHERE "courseIdea" IS NULL
  AND "textbook" IS NOT NULL;
