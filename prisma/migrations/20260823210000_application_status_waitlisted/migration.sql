-- Add WAITLISTED to legacy Position ApplicationStatus so staff / mentor /
-- other role openings can sit on the hiring waitlist like instructor + CP.

DO $$ BEGIN
  ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
