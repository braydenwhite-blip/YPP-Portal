-- Remove long-form essay fields from instructor applications (video + teaching experience remain).
ALTER TABLE "InstructorApplication" DROP COLUMN IF EXISTS "whyYPP";
ALTER TABLE "InstructorApplication" DROP COLUMN IF EXISTS "extracurriculars";
ALTER TABLE "InstructorApplication" DROP COLUMN IF EXISTS "priorLeadership";
ALTER TABLE "InstructorApplication" DROP COLUMN IF EXISTS "specialSkills";
