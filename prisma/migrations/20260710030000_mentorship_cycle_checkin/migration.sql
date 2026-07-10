-- Make the monthly Mentor Check-in an explicit lifecycle artifact.
--
-- Generic MentorshipCheckIn rows remain valid with a NULL selfReflectionId.
-- A cycle-bound row points at the MonthlySelfReflection discussed during the
-- check-in. The unique index guarantees one canonical Mentor Check-in per
-- monthly cycle while keeping the broader conversation history flexible.

ALTER TABLE "MentorshipCheckIn"
  ADD COLUMN IF NOT EXISTS "selfReflectionId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MentorshipCheckIn_selfReflectionId_key"
  ON "MentorshipCheckIn"("selfReflectionId");

DO $$ BEGIN
  ALTER TABLE "MentorshipCheckIn"
    ADD CONSTRAINT "MentorshipCheckIn_selfReflectionId_fkey"
    FOREIGN KEY ("selfReflectionId") REFERENCES "MonthlySelfReflection"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
