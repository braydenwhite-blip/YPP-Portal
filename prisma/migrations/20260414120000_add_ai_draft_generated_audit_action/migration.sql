-- Add AI_DRAFT_GENERATED value to AuditAction enum
-- PostgreSQL enum additions are non-transactional; IF NOT EXISTS prevents re-run errors.
DO $$ BEGIN
  ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'AI_DRAFT_GENERATED';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
