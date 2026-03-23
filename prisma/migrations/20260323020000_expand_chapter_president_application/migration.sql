-- Migration: expand_chapter_president_application
-- Adds comprehensive fields to ChapterPresidentApplication mirroring the instructor
-- application improvements: personal info, location, academic background, chapter-specific
-- essays, referral, availability, and reviewer scoring rubric.

-- Personal Information
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "legalName"          TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "preferredFirstName" TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "phoneNumber"        TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "dateOfBirth"        TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "hearAboutYPP"       TEXT;

-- Location
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "city"          TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "stateProvince" TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "zipCode"       TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "country"       TEXT;

-- Academic Background
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "schoolName"      TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "graduationYear"  INTEGER;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "gpa"            TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "classRank"      TEXT;

-- Chapter-specific essays
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "whyChapterPresident" TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "partnerSchool"       TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "recruitmentPlan"     TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "launchPlan"          TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "extracurriculars"    TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "priorOrganizing"     TEXT;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "specialSkills"       TEXT;

-- Referral
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "referralEmails" TEXT;

-- Availability details
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "hoursPerWeek"       INTEGER;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "preferredStartDate" TEXT;

-- Optional demographics
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "ethnicity" TEXT;

-- Reviewer scoring rubric (1-5 scale per dimension)
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "scoreLeadership"   INTEGER;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "scoreVision"       INTEGER;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "scoreOrganization" INTEGER;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "scoreCommitment"   INTEGER;
ALTER TABLE "ChapterPresidentApplication" ADD COLUMN IF NOT EXISTS "scoreFit"          INTEGER;

-- Indexes for new filterable columns
CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_graduationYear_idx" ON "ChapterPresidentApplication"("graduationYear");
CREATE INDEX IF NOT EXISTS "ChapterPresidentApplication_stateProvince_idx"  ON "ChapterPresidentApplication"("stateProvince");
