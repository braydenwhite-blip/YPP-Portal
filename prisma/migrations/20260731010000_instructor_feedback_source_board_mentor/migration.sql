-- Mentorship-collected feedback sources about a mentee.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'InstructorFeedbackSource'
      AND e.enumlabel = 'BOARD'
  ) THEN
    ALTER TYPE "InstructorFeedbackSource" ADD VALUE 'BOARD';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'InstructorFeedbackSource'
      AND e.enumlabel = 'MENTOR'
  ) THEN
    ALTER TYPE "InstructorFeedbackSource" ADD VALUE 'MENTOR';
  END IF;
END $$;
