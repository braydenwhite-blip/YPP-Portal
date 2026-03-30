/**
 * Migrate existing users from the Prisma User table into Supabase Auth.
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts              # dry-run (default)
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts --execute     # actually migrate
 */

import { prisma } from "@/lib/prisma";
import { migrateUsersToSupabaseAuth } from "@/lib/supabase-user-migration";

const isDryRun = !process.argv.includes("--execute");

async function main() {
  if (isDryRun) {
    console.log("=== DRY RUN MODE (pass --execute to actually migrate) ===\n");
  }

  const result = await migrateUsersToSupabaseAuth({ dryRun: isDryRun });

  console.log(`Found ${result.found} users without supabaseAuthId.\n`);
  for (const log of result.logs) {
    const prefix =
      log.status === "migrated"
        ? "[OK]"
        : log.status === "linked"
        ? "[LINKED]"
        : log.status === "skipped"
        ? "[SKIP]"
        : log.status === "dry_run"
        ? "[DRY]"
        : "[FAIL]";
    console.log(`${prefix} ${log.email}: ${log.detail}`);
  }

  console.log(
    `\nDone. Migrated: ${result.migrated}, Linked: ${result.linked}, Skipped: ${result.skipped}, Failed: ${result.failed}`
  );

  if (isDryRun) {
    console.log("\nThis was a dry run. Pass --execute to perform the migration.");
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
