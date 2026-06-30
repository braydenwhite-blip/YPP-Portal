-- Partner Automation — Chapter Partner CRM
--
-- Additive-only support for the Chapter-President-facing partner CRM. Two
-- nullable JSON columns; no enums, no renames, no constraints. The existing
-- `stage`/contact/follow-up columns and every relationship-ops consumer are
-- untouched, so the admin pipeline board (/admin/partners) is unaffected.
--
-- Written idempotently (ADD COLUMN IF NOT EXISTS) to match repo convention so
-- `prisma migrate deploy` is safe to re-run.

-- Logistics readiness checklist state for confirmed partners. JSON map of
-- checklist-item key → boolean (lib/partners/logistics.ts).
ALTER TABLE "Partner" ADD COLUMN IF NOT EXISTS "logistics" JSONB;

-- Structured metadata for partner timeline notes (meeting outcome type, issue
-- severity/escalation/resolution, scheduled follow-up date, close reason, …).
ALTER TABLE "PartnerNote" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
