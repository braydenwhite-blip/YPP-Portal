-- Deduplicate any existing unconfirmed pairs before adding the unique index.
-- Confirmed slots are left untouched even if they would conflict.
DELETE FROM "OfferedInterviewSlot" a
USING "OfferedInterviewSlot" b
WHERE a.id > b.id
  AND a."instructorApplicationId" = b."instructorApplicationId"
  AND a."scheduledAt" = b."scheduledAt"
  AND a."confirmedAt" IS NULL;

-- Prevent duplicate offered slots for the same application at the same time.
CREATE UNIQUE INDEX "OfferedInterviewSlot_instructorApplicationId_scheduledAt_key"
  ON "OfferedInterviewSlot"("instructorApplicationId", "scheduledAt");
