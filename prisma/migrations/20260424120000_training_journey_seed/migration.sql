-- Training journey curriculum is seeded by
-- scripts/import-training-academy-content.mjs after `prisma migrate deploy`,
-- invoked by scripts/maybe-db-sync.mjs. This migration is a marker.
--
-- Rationale: inlining beat data as SQL is fragile and duplicates the
-- TypeScript authoring sources. The importer is idempotent and validates
-- configs against Zod schemas before writing, giving stronger guarantees
-- than a static SQL INSERT. Running the importer post-migrate (via
-- maybe-db-sync.mjs) keeps the migration history clean and replay-safe.
SELECT 1;
