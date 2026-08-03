-- Class announcements can post ASAP or at a scheduled Eastern Time wall clock
-- (stored as UTC on scheduledPublishAt).

ALTER TABLE "ClassAnnouncement"
  ADD COLUMN IF NOT EXISTS "scheduledPublishAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "ClassAnnouncement_scheduledPublishAt_idx"
  ON "ClassAnnouncement"("scheduledPublishAt");
