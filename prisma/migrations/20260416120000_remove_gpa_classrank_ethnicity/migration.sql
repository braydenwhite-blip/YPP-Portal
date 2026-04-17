-- Remove GPA, class rank, and ethnicity fields from instructor applications.
-- These fields are no longer collected during the application process.
ALTER TABLE "InstructorApplication" DROP COLUMN IF EXISTS "gpa";
ALTER TABLE "InstructorApplication" DROP COLUMN IF EXISTS "classRank";
ALTER TABLE "InstructorApplication" DROP COLUMN IF EXISTS "ethnicity";
