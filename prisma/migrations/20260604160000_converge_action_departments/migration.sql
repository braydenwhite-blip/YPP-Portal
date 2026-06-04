-- Migration: converge_action_departments
-- People Strategy — Action Tracker (plan comment #13).
--
-- Earlier seeds created legacy "Instruction" / "Marketing" departments that the
-- three standing departments duplicate, producing a cluttered, "incorrect"
-- department picker. This migration converges on the standing set:
--   1. ensures the three standing departments exist,
--   2. reassigns any ActionItem still pointing at a legacy department to the
--      mapped standing department (so nothing is orphaned),
--   3. archives the legacy departments so they drop out of the picker
--      (loaders filter on archivedAt IS NULL).
--
-- Guarded by the exact legacy slugs so unrelated departments are never touched.
-- Idempotent and safe to re-run.

-- 1. Ensure the standing departments exist (mirrors 20260602120000).
INSERT INTO "Department" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Instructional Affairs', 'instructional-affairs', 'Academics — curriculum, teaching, and classroom operations.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Community & Partnerships', 'community-partnerships', 'Growth — community building, outreach, and partnerships.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Platform & Operations', 'platform-operations', 'Operations — platform, logistics, and internal operations.', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- 2. Reassign action items off the legacy departments onto the mapped standing
--    departments (Instruction → Instructional Affairs, Marketing → Community &
--    Partnerships).
UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'instructional-affairs')
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'instruction');

UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'community-partnerships')
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'marketing');

-- 3. Archive the now-empty legacy departments so they leave the picker.
UPDATE "Department"
SET "archivedAt" = NOW()
WHERE "slug" IN ('instruction', 'marketing') AND "archivedAt" IS NULL;
