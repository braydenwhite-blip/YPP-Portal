-- Knowledge OS V2 Phase 3E — SearchDocument.eventAt
--
-- Structured event-time metadata on index rows (the meeting's start date
-- today; reusable by any entity whose search ranking needs a real date).
-- This is what unblocks a future meeting search-group cutover: the live
-- meeting query orders by date DESC and renders the date in the subtitle,
-- which the index could not express before this column.
--
-- Written idempotently (ADD COLUMN IF NOT EXISTS) per the repo convention,
-- so the migration is safely re-runnable. Nullable and additive: existing
-- rows are untouched and the nightly reconcile backfills meeting dates.

ALTER TABLE "SearchDocument" ADD COLUMN IF NOT EXISTS "eventAt" TIMESTAMP(3);
