-- Manual board/mentor-only opt-out for the People mentorship roster.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mentorshipExempt" BOOLEAN NOT NULL DEFAULT false;
