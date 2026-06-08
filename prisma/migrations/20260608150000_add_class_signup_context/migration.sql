-- Migration: add_class_signup_context
-- Capture the student's guided fit-check answers at enrollment so the people
-- teaching the class know why each student is there. Additive + nullable, so
-- existing rows are unaffected. Written idempotently to match the repo's
-- convention (ADD COLUMN IF NOT EXISTS).

ALTER TABLE "ClassEnrollment" ADD COLUMN IF NOT EXISTS "signupGoal" TEXT;
ALTER TABLE "ClassEnrollment" ADD COLUMN IF NOT EXISTS "signupNote" TEXT;
