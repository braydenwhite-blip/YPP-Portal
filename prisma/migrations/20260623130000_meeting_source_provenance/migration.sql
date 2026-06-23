-- Meeting provenance: lets a meeting record where it was BORN from (mirrors
-- ActionItem.sourceType/sourceId). String-typed, no FK, so cross-domain links
-- stay flexible. Used to upsert exactly one meeting per scheduled interview.
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "Meeting" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;

CREATE INDEX IF NOT EXISTS "Meeting_sourceType_sourceId_idx"
  ON "Meeting" ("sourceType", "sourceId");
