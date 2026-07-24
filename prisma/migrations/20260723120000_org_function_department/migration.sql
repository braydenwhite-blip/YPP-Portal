-- Function → Department org taxonomy
-- Replaces flat "Operations - Technology" style labels with two fields:
--   Function: Operations | Core Instruction | …
--   Department: Technology | Fundraising | Leadership | …

-- 1. OrgFunction table
CREATE TABLE IF NOT EXISTS "OrgFunction" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrgFunction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrgFunction_name_key" ON "OrgFunction"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "OrgFunction_slug_key" ON "OrgFunction"("slug");
CREATE INDEX IF NOT EXISTS "OrgFunction_archivedAt_idx" ON "OrgFunction"("archivedAt");

-- 2. Department.functionId
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "functionId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Department"
    ADD CONSTRAINT "Department_functionId_fkey"
    FOREIGN KEY ("functionId") REFERENCES "OrgFunction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Department_functionId_idx" ON "Department"("functionId");

-- 3. User org placement
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "orgFunctionId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "orgDepartmentId" TEXT;

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_orgFunctionId_fkey"
    FOREIGN KEY ("orgFunctionId") REFERENCES "OrgFunction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "User"
    ADD CONSTRAINT "User_orgDepartmentId_fkey"
    FOREIGN KEY ("orgDepartmentId") REFERENCES "Department"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "User_orgFunctionId_idx" ON "User"("orgFunctionId");
CREATE INDEX IF NOT EXISTS "User_orgDepartmentId_idx" ON "User"("orgDepartmentId");

-- 4. Seed Functions
INSERT INTO "OrgFunction" ("id", "name", "slug", "description", "createdAt", "updatedAt")
VALUES
  (
    'orgfn_core_instruction',
    'Core Instruction',
    'core-instruction',
    'Programs, teaching, chapter leadership, and instructional quality.',
    NOW(),
    NOW()
  ),
  (
    'orgfn_operations',
    'Operations',
    'operations',
    'Org operations — technology, fundraising, communications, and channels.',
    NOW(),
    NOW()
  )
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "archivedAt" = NULL,
  "updatedAt" = NOW();

-- Resolve function ids by slug (stable even if seed ids differ across envs)
-- 5. Ensure departments exist with Function → Department mapping
INSERT INTO "Department" ("id", "name", "slug", "description", "functionId", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  v.name,
  v.slug,
  v.description,
  f.id,
  NOW(),
  NOW()
FROM (
  VALUES
    ('Leadership', 'leadership', 'Chapter and program leadership under Core Instruction.', 'core-instruction'),
    ('Instruction', 'instruction', 'Classes, curriculum, teaching quality, and mentorship.', 'core-instruction'),
    ('Chapters', 'chapters', 'Local chapters, hiring, and community partnerships.', 'core-instruction'),
    ('Technology', 'technology', 'Portal, tooling, automation, and technical delivery.', 'operations'),
    ('Fundraising', 'fundraising', 'Donor, grant, and fundraising operations.', 'operations'),
    ('Communications', 'communications', 'Org messaging, announcements, and outreach.', 'operations'),
    ('Social Media', 'social-media', 'Social content, campaigns, and channel management.', 'operations')
) AS v(name, slug, description, function_slug)
JOIN "OrgFunction" f ON f.slug = v.function_slug
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "functionId" = EXCLUDED."functionId",
  "archivedAt" = NULL,
  "updatedAt" = NOW();

-- 6. Rename legacy Tech → Technology (keep slug tech for old rows, also map to technology)
UPDATE "Department" d
SET
  "name" = 'Technology',
  "slug" = 'technology',
  "functionId" = (SELECT "id" FROM "OrgFunction" WHERE "slug" = 'operations' LIMIT 1),
  "archivedAt" = NULL,
  "updatedAt" = NOW()
WHERE d.slug = 'tech'
  AND NOT EXISTS (SELECT 1 FROM "Department" WHERE slug = 'technology');

-- If both tech and technology exist, remap FKs from tech → technology then archive tech
UPDATE "ActionItem"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'technology' LIMIT 1)
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'tech');

UPDATE "ActionItemDepartment"
SET "departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'technology' LIMIT 1)
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'tech')
  AND NOT EXISTS (
    SELECT 1 FROM "ActionItemDepartment" existing
    WHERE existing."actionItemId" = "ActionItemDepartment"."actionItemId"
      AND existing."departmentId" = (SELECT "id" FROM "Department" WHERE "slug" = 'technology' LIMIT 1)
  );

DELETE FROM "ActionItemDepartment"
WHERE "departmentId" IN (SELECT "id" FROM "Department" WHERE "slug" = 'tech');

UPDATE "Department"
SET "archivedAt" = NOW(), "updatedAt" = NOW()
WHERE "slug" = 'tech';

-- 7. Attach functionId on remaining standing departments
UPDATE "Department"
SET
  "functionId" = (SELECT "id" FROM "OrgFunction" WHERE "slug" = 'core-instruction' LIMIT 1),
  "updatedAt" = NOW()
WHERE "slug" IN ('instruction', 'chapters', 'leadership')
  AND ("functionId" IS NULL OR TRUE);

UPDATE "Department"
SET
  "functionId" = (SELECT "id" FROM "OrgFunction" WHERE "slug" = 'operations' LIMIT 1),
  "archivedAt" = NULL,
  "updatedAt" = NOW()
WHERE "slug" IN ('technology', 'fundraising', 'communications', 'social-media');
