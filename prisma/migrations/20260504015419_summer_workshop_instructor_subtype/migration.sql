-- Migration: summer_workshop_instructor_subtype
--
-- Adds the Summer Workshop Instructor pathway as a subtype of the existing
-- Instructor application/role. All changes are additive and default to the
-- existing standard behavior so the standard instructor pipeline is unchanged.
--
-- See docs/summer-workshop-instructor-plan.md §4 for the full data model spec.
--
-- Adds:
--   * Enum `InstructorSubtype` (STANDARD | SUMMER_WORKSHOP)
--   * Enum `ApplicationTrack`  (STANDARD_INSTRUCTOR | SUMMER_WORKSHOP_INSTRUCTOR)
--   * Columns on `InstructorApplication`:
--       - applicationTrack       (defaults STANDARD_INSTRUCTOR)
--       - instructorSubtype      (defaults STANDARD)
--       - workshopOutline        (Json, nullable)
--       - promotionEligibility   (Json, nullable)
--       - subtypeChangedAt       (timestamp, nullable)
--       - subtypeChangedById     (FK -> User.id, nullable)
--   * Indexes on applicationTrack and instructorSubtype
--   * FK from subtypeChangedById -> User(id)

-- 1) Enums (split into their own DO blocks so re-running is safe)
DO $$ BEGIN
  CREATE TYPE "InstructorSubtype" AS ENUM (
    'STANDARD',
    'SUMMER_WORKSHOP'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ApplicationTrack" AS ENUM (
    'STANDARD_INSTRUCTOR',
    'SUMMER_WORKSHOP_INSTRUCTOR'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2) Columns on InstructorApplication
ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "applicationTrack" "ApplicationTrack" NOT NULL DEFAULT 'STANDARD_INSTRUCTOR';

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "instructorSubtype" "InstructorSubtype" NOT NULL DEFAULT 'STANDARD';

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "workshopOutline" JSONB;

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "promotionEligibility" JSONB;

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "subtypeChangedAt" TIMESTAMP(3);

ALTER TABLE "InstructorApplication"
  ADD COLUMN IF NOT EXISTS "subtypeChangedById" TEXT;

-- 3) Backfill: existing rows already get the column defaults (STANDARD /
--    STANDARD_INSTRUCTOR) via the DEFAULT clauses above. This UPDATE is a
--    safety net for any rows that may have been inserted between the column
--    add and default propagation in edge environments.
UPDATE "InstructorApplication"
   SET "applicationTrack" = 'STANDARD_INSTRUCTOR'
 WHERE "applicationTrack" IS NULL;

UPDATE "InstructorApplication"
   SET "instructorSubtype" = 'STANDARD'
 WHERE "instructorSubtype" IS NULL;

-- 4) Foreign key for subtypeChangedById -> User
DO $$ BEGIN
  ALTER TABLE "InstructorApplication"
    ADD CONSTRAINT "InstructorApplication_subtypeChangedById_fkey"
    FOREIGN KEY ("subtypeChangedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
  WHEN others THEN null;
END $$;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS "InstructorApplication_applicationTrack_idx"
  ON "InstructorApplication"("applicationTrack");

CREATE INDEX IF NOT EXISTS "InstructorApplication_instructorSubtype_idx"
  ON "InstructorApplication"("instructorSubtype");

CREATE INDEX IF NOT EXISTS "InstructorApplication_subtypeChangedById_idx"
  ON "InstructorApplication"("subtypeChangedById");
