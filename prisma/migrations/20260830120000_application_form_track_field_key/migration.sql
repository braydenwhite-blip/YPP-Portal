-- Link form templates to application tracks and stable field keys for live signup wiring.

ALTER TABLE "ApplicationFormTemplate"
  ADD COLUMN IF NOT EXISTS "applicationTrack" "ApplicationTrack";

CREATE INDEX IF NOT EXISTS "ApplicationFormTemplate_applicationTrack_isActive_idx"
  ON "ApplicationFormTemplate"("applicationTrack", "isActive");

ALTER TABLE "ApplicationFormField"
  ADD COLUMN IF NOT EXISTS "fieldKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationFormField_templateId_fieldKey_key"
  ON "ApplicationFormField"("templateId", "fieldKey")
  WHERE "fieldKey" IS NOT NULL;
