-- Customizable portal email templates.
-- Stores per-template overrides keyed by the stable registry key
-- (lib/email-templates/registry.ts). When a row is present and active, its
-- subject/body supersede the code-defined default at send time.

CREATE TABLE IF NOT EXISTS "EmailTemplateOverride" (
  "id"          TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "subject"     TEXT NOT NULL,
  "body"        TEXT NOT NULL,
  "bodyJson"    JSONB,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT,
  "updatedById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmailTemplateOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailTemplateOverride_templateKey_key"
  ON "EmailTemplateOverride"("templateKey");

CREATE INDEX IF NOT EXISTS "EmailTemplateOverride_templateKey_idx"
  ON "EmailTemplateOverride"("templateKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplateOverride_createdById_fkey'
  ) THEN
    ALTER TABLE "EmailTemplateOverride"
      ADD CONSTRAINT "EmailTemplateOverride_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'EmailTemplateOverride_updatedById_fkey'
  ) THEN
    ALTER TABLE "EmailTemplateOverride"
      ADD CONSTRAINT "EmailTemplateOverride_updatedById_fkey"
      FOREIGN KEY ("updatedById") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
