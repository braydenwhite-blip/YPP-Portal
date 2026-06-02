-- Migration: optional_action_department_and_seed
-- People Strategy — Action Tracker.
-- 1. Makes ActionItem.departmentId optional so an action can be created before
--    it has been triaged into a functional department.
-- 2. Seeds the three standing functional departments so the picker is never
--    empty in a fresh environment.
-- Written idempotently to match the repo's migration convention.

-- AlterTable: drop the NOT NULL constraint on the department FK.
ALTER TABLE "ActionItem" ALTER COLUMN "departmentId" DROP NOT NULL;

-- Seed the standing functional departments. ON CONFLICT keeps this idempotent
-- and safe to re-run; `name` is unique.
INSERT INTO "Department" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Instructional Affairs', 'instructional-affairs', 'Academics — curriculum, teaching, and classroom operations.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Community & Partnerships', 'community-partnerships', 'Growth — community building, outreach, and partnerships.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Platform & Operations', 'platform-operations', 'Operations — platform, logistics, and internal operations.', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;
