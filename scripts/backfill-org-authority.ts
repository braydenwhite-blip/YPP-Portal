/**
 * Backfill for the org authority spine (Phase 3 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md).
 *
 *   1. Ensures the canonical committees exist (idempotent upsert by name).
 *   2. Populates User.internalLevel / ladder / canonicalTitle for rows that do
 *      not have an internal level yet, derived from the existing identity model
 *      (title → admin subtype → primaryRole) via resolvePersonAuthority.
 *
 * Safe + idempotent: only fills NULL internalLevel rows and never deletes
 * anything. Dry-run by default; pass --apply to write.
 *
 *   npx tsx scripts/backfill-org-authority.ts           # dry run
 *   npx tsx scripts/backfill-org-authority.ts --apply   # write
 */

import { prisma } from "@/lib/prisma";
import { resolvePersonAuthority } from "@/lib/org/levels";

const apply = process.argv.includes("--apply");

const CANONICAL_COMMITTEES: Array<{ name: string; slug: string; kind: string }> = [
  { name: "Instruction Committee", slug: "instruction-committee", kind: "Instruction Committee" },
  { name: "Interview Committee", slug: "interview-committee", kind: "Interview Committee" },
  { name: "Review Committee", slug: "review-committee", kind: "Review Committee" },
  { name: "Outreach Team", slug: "outreach-team", kind: "Outreach Team" },
  { name: "Board", slug: "board", kind: "Board" },
  { name: "Temporary Working Group", slug: "temporary-working-group", kind: "Temporary Working Group" },
];

async function ensureCommittees(): Promise<void> {
  for (const committee of CANONICAL_COMMITTEES) {
    const existing = await prisma.committee.findUnique({ where: { name: committee.name } });
    if (existing) {
      console.log(`  committee exists: ${committee.name}`);
      continue;
    }
    console.log(`  + committee: ${committee.name}${apply ? "" : " (dry run)"}`);
    if (apply) {
      await prisma.committee.create({ data: committee });
    }
  }
}

async function backfillUsers(): Promise<void> {
  const users = await prisma.user.findMany({
    where: { internalLevel: null },
    select: {
      id: true,
      name: true,
      title: true,
      primaryRole: true,
      adminSubtypes: { select: { subtype: true } },
    },
  });

  let updated = 0;
  let skipped = 0;
  for (const user of users) {
    const authority = resolvePersonAuthority({
      title: user.title,
      primaryRole: user.primaryRole,
      adminSubtypes: user.adminSubtypes.map((s) => s.subtype),
    });

    if (authority.internalLevel == null) {
      skipped += 1;
      continue;
    }

    updated += 1;
    console.log(
      `  ${user.name}: level ${authority.internalLevel}` +
        ` · ${authority.ladder ?? "?"} · ${authority.title ?? "(no canonical title)"}` +
        ` [${authority.source}]${apply ? "" : " (dry run)"}`
    );
    if (apply) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          internalLevel: authority.internalLevel,
          ladder: authority.ladder ?? undefined,
          canonicalTitle: authority.title ?? undefined,
        },
      });
    }
  }

  console.log(
    `\nUsers: ${updated} ${apply ? "updated" : "to update"}, ${skipped} skipped (not derivable).`
  );
}

async function main(): Promise<void> {
  console.log(apply ? "Applying org authority backfill…\n" : "DRY RUN — pass --apply to write.\n");
  console.log("Committees:");
  await ensureCommittees();
  console.log("\nUsers:");
  await backfillUsers();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
