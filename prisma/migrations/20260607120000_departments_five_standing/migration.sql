-- Migration: departments_five_standing
-- People Strategy — Action Tracker (plan comment #6).
--
-- Leadership consolidated the Action Tracker around FIVE standing teams. The
-- seed previously created three broader departments — "Instructional Affairs" /
-- "Community & Partnerships" / "Platform & Operations" (themselves a convergence
-- of even-older legacy rows). This migration converges on the standing five:
--   1. ensures the five standing teams exist,
--   2. remaps any ActionItem still pointing at a superseded department to the
--      mapped standing team (so nothing is orphaned):
--        Instructional Affairs  → Instruction
--        Community & Partnerships → Partnerships
--        Platform & Operations  → Operations
--   3. archives the three superseded departments so they drop out of the picker
--      (loaders filter on archivedAt IS NULL).
--
-- Guarded by the exact superseded slugs so unrelated departments are never
-- touched. Idempotent and safe to re-run; never deletes rows.

-- 1. Ensure the five standing teams exist (mirrors the seed). Ids are generated
--    with gen_random_uuid()::text because cuid() is application-side only.
INSERT INTO "Department" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Instruction', 'instruction', 'Academics — curriculum, teaching, and classroom operations.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Partnerships', 'partnerships', 'Growth — community building, outreach, and partnerships.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Recruitment & Hiring', 'recruitment-hiring', 'Recruitment — sourcing, interviewing, and hiring instructors.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Mentorship', 'mentorship', 'Mentorship — pairing, coaching, and instructor growth support.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Operations', 'operations', 'Operations — platform, logistics, and internal operations.', NOW(), NOW())
ON CONFLICT ("name") DO NOTHING;

-- 2. Remap action items off the superseded departments onto the mapped standing
--    teams. Ids are looked up by slug so the statements are robust regardless of
--    how rows were created.
UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'instruction')
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'instructional-affairs');

UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'partnerships')
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'community-partnerships');

UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'operations')
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'platform-operations');

-- 3. Archive the now-empty superseded departments so they leave the picker.
UPDATE "Department"
SET "archivedAt" = NOW()
WHERE "slug" IN ('instructional-affairs', 'community-partnerships', 'platform-operations') AND "archivedAt" IS NULL;
