-- Add index on Award(recipientId, awardedAt DESC) to support the per-request
-- session lookup in lib/auth-supabase.ts. Without this index, every authenticated
-- page render does a sequential scan + sort over the Award table, which exceeds
-- Postgres statement_timeout and starves the connection pool.

CREATE INDEX IF NOT EXISTS "Award_recipientId_awardedAt_idx"
  ON "Award" ("recipientId", "awardedAt" DESC);
