-- Add OFFICER to manually logged instructor feedback sources.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'InstructorFeedbackSource'
      AND e.enumlabel = 'OFFICER'
  ) THEN
    ALTER TYPE "InstructorFeedbackSource" ADD VALUE 'OFFICER';
  END IF;
END $$;
