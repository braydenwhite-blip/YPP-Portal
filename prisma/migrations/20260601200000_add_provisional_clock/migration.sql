-- Migration: add_provisional_clock
-- People Strategy — provisional 3-month confirmation clock
-- (ENABLE_PROVISIONAL_CLOCK). Adds two nullable timestamps to User:
--   provisionalStart       — set when an applicant→instructor hire is confirmed
--                            (the Month-3 confirmation review is due 90 days later).
--   provisionalConfirmedAt — set when senior leadership / Board confirms the hire,
--                            which clears the provisional state.
-- Written idempotently (ADD COLUMN IF NOT EXISTS) to match the repo convention.

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisionalStart" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "provisionalConfirmedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_provisionalStart_idx" ON "User"("provisionalStart");
