-- Role Committee lane split — Officers vs. Global Directors/Managers.
--
-- The Mentorship Process Overview names four Role Committees (Officers,
-- Global Directors/Managers, Chapter Presidents, Instructors), each with its
-- own Chair. Today MentorCommitteeChair.roleType only has three buckets
-- (INSTRUCTOR, CHAPTER_PRESIDENT, GLOBAL_LEADERSHIP) because points/rubric
-- are legitimately shared between Officers and Global Directors/Managers.
-- `lane` is a purely additive, orthogonal column: it distinguishes which
-- named committee a chair leads without touching review-approval routing
-- (still governed by roleType, unchanged).
--
-- INSTRUCTOR and CHAPTER_PRESIDENT chairs backfill 1:1 (unambiguous).
-- GLOBAL_LEADERSHIP chairs are left with lane = NULL — splitting them into
-- OFFICER vs GLOBAL_DIRECTOR_MANAGER requires a human decision (an admin
-- picks in the Chairs panel), not a guessed backfill.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MentorCommitteeLane') THEN
    CREATE TYPE "MentorCommitteeLane" AS ENUM (
      'OFFICER',
      'GLOBAL_DIRECTOR_MANAGER',
      'CHAPTER_PRESIDENT',
      'INSTRUCTOR'
    );
  END IF;
END $$;

ALTER TABLE "MentorCommitteeChair"
  ADD COLUMN IF NOT EXISTS "lane" "MentorCommitteeLane";

CREATE INDEX IF NOT EXISTS "MentorCommitteeChair_lane_idx"
  ON "MentorCommitteeChair"("lane");

DO $$ BEGIN
  ALTER TABLE "MentorCommitteeChair"
    ADD CONSTRAINT "MentorCommitteeChair_userId_lane_key" UNIQUE ("userId", "lane");
EXCEPTION WHEN duplicate_object THEN null; END $$;

UPDATE "MentorCommitteeChair" SET "lane" = 'INSTRUCTOR'
  WHERE "roleType" = 'INSTRUCTOR' AND "lane" IS NULL;

UPDATE "MentorCommitteeChair" SET "lane" = 'CHAPTER_PRESIDENT'
  WHERE "roleType" = 'CHAPTER_PRESIDENT' AND "lane" IS NULL;
