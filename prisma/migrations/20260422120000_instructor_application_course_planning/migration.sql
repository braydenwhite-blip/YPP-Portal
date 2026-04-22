-- Add course planning fields collected during the instructor application
ALTER TABLE "InstructorApplication" ADD COLUMN IF NOT EXISTS "textbook" TEXT;
ALTER TABLE "InstructorApplication" ADD COLUMN IF NOT EXISTS "courseOutline" TEXT;
ALTER TABLE "InstructorApplication" ADD COLUMN IF NOT EXISTS "firstClassPlan" TEXT;
