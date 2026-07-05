-- Migration: departments_five_teams
-- Consolidate Action Tracker departments to five standing teams:
--   Instruction, Chapters, Tech, Communications, Social Media
--
-- Retired teams are remapped then archived (never deleted):
--   Mentorship, Recruitment & Hiring, Partnerships → Instruction or Chapters
--   Fundraising → Communications
--   Operations, Platform & Operations → Tech
--   Officers, Board → unlinked (use visibility / meetings instead)
--   Legacy Instructional Affairs / Community & Partnerships → Instruction / Chapters

-- 1. Ensure the five standing teams exist.
INSERT INTO "Department" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'Instruction', 'instruction', 'Classes, curriculum, teaching quality, and mentorship.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Chapters', 'chapters', 'Local chapters, hiring, and community partnerships.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Tech', 'tech', 'Portal, tooling, automation, and technical delivery.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Communications', 'communications', 'Org messaging, announcements, fundraising outreach, and comms.', NOW(), NOW()),
  (gen_random_uuid()::text, 'Social Media', 'social-media', 'Social content, campaigns, and channel management.', NOW(), NOW())
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "archivedAt" = NULL,
  "updatedAt" = NOW();

-- 2. Remap primary departmentId on action items.
UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'instruction' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" IN ('mentorship', 'instructional-affairs')
);

UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'chapters' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department"
  WHERE "slug" IN ('recruitment-hiring', 'partnerships', 'community-partnerships')
);

UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'communications' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" = 'fundraising'
);

UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'tech' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" IN ('operations', 'platform-operations')
);

UPDATE "ActionItem"
SET "departmentId" = NULL
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" IN ('officers', 'board')
);

-- 3. Remap many-to-many team links.
UPDATE "ActionItemDepartment"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'instruction' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" IN ('mentorship', 'instructional-affairs')
);

UPDATE "ActionItemDepartment"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'chapters' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department"
  WHERE "slug" IN ('recruitment-hiring', 'partnerships', 'community-partnerships')
);

UPDATE "ActionItemDepartment"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'communications' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" = 'fundraising'
);

UPDATE "ActionItemDepartment"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'tech' LIMIT 1)
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" IN ('operations', 'platform-operations')
);

DELETE FROM "ActionItemDepartment"
WHERE "departmentId" IN (
  SELECT "id" FROM "Department" WHERE "slug" IN ('officers', 'board')
);

-- Drop duplicate (actionItemId, departmentId) pairs after remap.
DELETE FROM "ActionItemDepartment" a
USING "ActionItemDepartment" b
WHERE a."actionItemId" = b."actionItemId"
  AND a."departmentId" = b."departmentId"
  AND a.ctid > b.ctid;

-- 4. Archive retired departments.
UPDATE "Department"
SET "archivedAt" = NOW(), "updatedAt" = NOW()
WHERE "slug" IN (
  'mentorship',
  'recruitment-hiring',
  'partnerships',
  'operations',
  'fundraising',
  'officers',
  'board',
  'instructional-affairs',
  'community-partnerships',
  'platform-operations'
)
AND "archivedAt" IS NULL;
