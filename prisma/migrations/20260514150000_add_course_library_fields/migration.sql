-- Migration: add_course_library_fields
-- Adds two additive columns to ClassTemplate to support the admin-curated
-- Course Library feature:
--   * isCatalogItem  – marks a template as part of the admin library that
--                      instructors pick from on /admin/course-library.
--   * clonedFromId   – set on instructor templates that were created by
--                      picking from the library; points at the admin source
--                      so we can display usage counts and provenance.
-- Also adds the matching indexes and a self-referential FK with ON DELETE SET NULL
-- so deleting a library template never orphans an instructor's clone.

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "isCatalogItem" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "ClassTemplate"
  ADD COLUMN IF NOT EXISTS "clonedFromId" TEXT;

DO $$ BEGIN
  ALTER TABLE "ClassTemplate"
    ADD CONSTRAINT "ClassTemplate_clonedFromId_fkey"
    FOREIGN KEY ("clonedFromId") REFERENCES "ClassTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ClassTemplate_isCatalogItem_idx"
  ON "ClassTemplate" ("isCatalogItem");

CREATE INDEX IF NOT EXISTS "ClassTemplate_clonedFromId_idx"
  ON "ClassTemplate" ("clonedFromId");
