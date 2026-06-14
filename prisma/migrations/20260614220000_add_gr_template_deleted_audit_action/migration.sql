-- Add GR_TEMPLATE_DELETED to the AuditAction enum.
--
-- The admin "delete G&R template" server action (lib/gr-actions.ts) logs an
-- audit event with action "GR_TEMPLATE_DELETED", but that value was never
-- added to the AuditAction enum, producing a build-blocking type error and a
-- runtime risk on insert. This adds the value idempotently per repo convention.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'AuditAction' AND e.enumlabel = 'GR_TEMPLATE_DELETED'
  ) THEN
    ALTER TYPE "AuditAction" ADD VALUE 'GR_TEMPLATE_DELETED';
  END IF;
END $$;
