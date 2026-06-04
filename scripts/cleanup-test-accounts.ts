import "dotenv/config";
import { PrismaClient } from "@prisma/client";

/**
 * Remove placeholder "test" accounts (e.g. "Test 1", "test2@…") that accumulate
 * from manual QA in a live portal. People Strategy / Action Tracker plan
 * comment #6 ("clean up test accounts").
 *
 * SAFETY:
 *  - Dry-run by default. Re-run with `--apply` to make changes.
 *  - Archives by default (sets `archivedAt`, which every member/people/action
 *    picker already filters on) so the change is reversible. Pass
 *    `--hard-delete` to permanently delete instead.
 *  - Never touches the known seed personas, the legacy-auth bypass list, or any
 *    ADMIN account — those are protected regardless of name.
 *  - Only matches tightly-scoped placeholder patterns so real members named,
 *    e.g., "Tester Smith" are not caught.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-accounts.ts                 # dry run (archive preview)
 *   npx tsx scripts/cleanup-test-accounts.ts --apply         # archive matches
 *   npx tsx scripts/cleanup-test-accounts.ts --apply --hard-delete
 */

const prisma = new PrismaClient();

// Accounts that must never be removed, whatever their name looks like.
const PROTECTED_EMAILS = new Set(
  [
    "brayden.white@youthpassionproject.org",
    "anthea.zamir@youthpassionproject.org",
    "carly.gelles@youthpassionproject.org",
    "avery.lin@youthpassionproject.org",
    "jordan.patel@youthpassionproject.org",
    "milo.wald@youthpassionproject.org",
  ].map((e) => e.toLowerCase())
);

// Placeholder patterns. Both are intentionally strict:
//  - a display name that is literally "test", "test 1", "test-2", "testaccount"…
//  - an email whose local part is "test", "test1", "test+2", "test.3", "qa-test"…
const NAME_PATTERN = /^\s*test[\s_-]*\d*\s*$/i;
const NAME_PATTERN_WORDED = /^\s*test\s*(account|user|admin|student|instructor|mentor)\s*\d*\s*$/i;
const EMAIL_LOCAL_PATTERN = /^(qa[-_.]?)?test[+._-]?\d*$/i;

function isPlaceholder(name: string | null, email: string): boolean {
  const local = email.split("@")[0] ?? "";
  return (
    (name != null && (NAME_PATTERN.test(name) || NAME_PATTERN_WORDED.test(name))) ||
    EMAIL_LOCAL_PATTERN.test(local)
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const hardDelete = process.argv.includes("--hard-delete");

  if (!apply) {
    console.log("DRY RUN — re-run with --apply to commit changes.\n");
  }

  // Pull a lightweight candidate set, then filter precisely in JS so the regexes
  // are the single source of truth. `contains: "test"` keeps the scan bounded.
  const candidates = await prisma.user.findMany({
    where: {
      archivedAt: null,
      OR: [
        { name: { contains: "test", mode: "insensitive" } },
        { email: { contains: "test", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
      primaryRole: true,
      roles: { select: { role: true } },
    },
  });

  const targets = candidates.filter((u) => {
    const email = u.email.toLowerCase();
    if (PROTECTED_EMAILS.has(email)) return false;
    // Never remove an ADMIN, even if mislabeled.
    if (u.primaryRole === "ADMIN" || u.roles.some((r) => r.role === "ADMIN")) {
      return false;
    }
    return isPlaceholder(u.name, u.email);
  });

  if (targets.length === 0) {
    console.log("No placeholder test accounts found. Nothing to do.");
    return;
  }

  console.log(`Found ${targets.length} placeholder test account(s):`);
  for (const u of targets) {
    console.log(`  - ${u.name ?? "(no name)"} <${u.email}> [${u.primaryRole}] ${u.id}`);
  }
  console.log();

  if (!apply) {
    console.log(
      `Would ${hardDelete ? "DELETE" : "archive"} the above. Re-run with --apply to proceed${
        hardDelete ? " (hard delete)" : ""
      }.`
    );
    return;
  }

  const ids = targets.map((u) => u.id);
  if (hardDelete) {
    const res = await prisma.user.deleteMany({ where: { id: { in: ids } } });
    console.log(`Hard-deleted ${res.count} account(s).`);
  } else {
    const res = await prisma.user.updateMany({
      where: { id: { in: ids } },
      data: { archivedAt: new Date() },
    });
    console.log(`Archived ${res.count} account(s) (reversible — clear archivedAt to restore).`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
