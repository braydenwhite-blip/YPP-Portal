/**
 * Migrate existing users from the Prisma User table into Supabase Auth.
 *
 * Usage:
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts              # dry-run (default)
 *   npx tsx scripts/migrate-users-to-supabase-auth.ts --execute     # actually migrate
 *
 * What it does:
 *   1. Reads every User from the Prisma DB
 *   2. Creates a corresponding auth.users entry via the Supabase Admin API
 *   3. Stores the Supabase auth UUID back on the Prisma User.supabaseAuthId
 *
 * Password migration:
 *   - Users with a bcrypt passwordHash get imported via the `password_hash` parameter
 *     so they can keep signing in with the same password.
 *   - OAuth-only users (empty passwordHash) are created without a password.
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const isDryRun = !process.argv.includes("--execute");

async function main() {
  if (isDryRun) {
    console.log("=== DRY RUN MODE (pass --execute to actually migrate) ===\n");
  }

  const users = await prisma.user.findMany({
    where: { supabaseAuthId: null },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      emailVerified: true,
      oauthProvider: true,
      primaryRole: true,
      chapterId: true,
    },
  });

  console.log(`Found ${users.length} users without supabaseAuthId.\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    const email = user.email.trim().toLowerCase();
    const hasPassword = user.passwordHash && user.passwordHash.length > 0;

    if (!email) {
      console.log(`[SKIP] User ${user.id} has a blank email address and cannot be imported into Supabase Auth.`);
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(
        `[DRY] Would migrate: ${email} (password: ${hasPassword ? "yes" : "no"}, oauth: ${user.oauthProvider ?? "none"})`
      );
      migrated++;
      continue;
    }

    try {
      // Build the createUser payload
      const payload: Record<string, unknown> = {
        email,
        email_confirm: !!user.emailVerified,
        user_metadata: {
          name: user.name,
          primaryRole: user.primaryRole,
          chapterId: user.chapterId,
          prismaUserId: user.id,
        },
      };

      // Import bcrypt hash directly — Supabase supports this
      if (hasPassword) {
        payload.password_hash = user.passwordHash;
      }

      const { data, error } = await supabase.auth.admin.createUser(
        payload as any
      );

      if (error) {
        // If user already exists in Supabase (e.g. re-running script), try to find them
        if (error.message?.includes("already been registered")) {
          const { data: listData } =
            await supabase.auth.admin.listUsers();
          const existing = listData?.users?.find(
            (u) => u.email === email
          );
          if (existing) {
            await prisma.user.update({
              where: { id: user.id },
              data: { supabaseAuthId: existing.id },
            });
            console.log(
              `[LINKED] ${email} → existing Supabase user ${existing.id}`
            );
            migrated++;
            continue;
          }
        }

        console.error(`[FAIL] ${email}: ${error.message}`);
        failed++;
        continue;
      }

      if (!data.user) {
        console.error(`[FAIL] ${email}: No user returned`);
        failed++;
        continue;
      }

      // Store the Supabase auth UUID on the Prisma user
      await prisma.user.update({
        where: { id: user.id },
        data: { supabaseAuthId: data.user.id },
      });

      console.log(`[OK] ${email} → ${data.user.id}`);
      migrated++;
    } catch (err) {
      console.error(`[FAIL] ${email}: ${err}`);
      failed++;
    }
  }

  console.log(
    `\nDone. Migrated: ${migrated}, Skipped: ${skipped}, Failed: ${failed}`
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
