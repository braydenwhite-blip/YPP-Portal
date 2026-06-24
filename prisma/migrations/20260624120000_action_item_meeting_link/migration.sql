-- ActionItem → Meeting explicit assignment link.
-- The Actions hub "+ Add to meeting" picker assigns an action to a Meeting (the
-- new weekly-meetings model) via a dedicated FK, independent of the action's
-- sourceType/sourceId provenance. Written idempotently (IF NOT EXISTS / DO $$
-- guards) to match repo convention.

ALTER TABLE "ActionItem" ADD COLUMN IF NOT EXISTS "meetingId" TEXT;

CREATE INDEX IF NOT EXISTS "ActionItem_meetingId_idx" ON "ActionItem"("meetingId");

DO $$ BEGIN
  ALTER TABLE "ActionItem" ADD CONSTRAINT "ActionItem_meetingId_fkey"
    FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
