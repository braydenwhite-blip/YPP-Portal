/**
 * YPP Help Agent — SearchDocument backfill / reconcile.
 *
 * Thin wrapper over `reconcileSearchDocuments()` in
 * lib/help-agent/search-indexing.ts — the same idempotent rebuild the
 * nightly cron (/api/cron/search-reconcile) runs. Upserts every qualifying
 * person / partner / applicant / class / meeting / action and deletes index
 * rows whose source entity no longer qualifies (archived, removed).
 *
 * Safe to run repeatedly; requires only DB access (DATABASE_URL).
 * Initiatives are a config registry (lib/people-strategy/
 * strategic-initiatives.ts) served from memory, so they are not indexed.
 *
 * Usage: npx tsx scripts/backfill-search-documents.ts
 *    or: npm run search:reconcile
 */

import { prisma } from "../lib/prisma";
import { reconcileSearchDocuments } from "../lib/help-agent/search-indexing";

async function main() {
  const report = await reconcileSearchDocuments({ log: console.log });
  console.log("Upserted by entity type:");
  for (const [type, count] of Object.entries(report.upsertedByType)) {
    console.log(`  ${type}: ${count}`);
  }
  console.log(`Stale rows removed: ${report.staleRemoved}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
