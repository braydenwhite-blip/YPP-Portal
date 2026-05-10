/**
 * Idempotent: marks legacy non-INTERACTIVE_JOURNEY training modules with
 * `archivedAt = now()` so they stop appearing in admin/learner lists
 * without losing the rows or any existing learner progress.
 *
 * Run:   node scripts/archive-legacy-training-modules.mjs
 * Dry:   node scripts/archive-legacy-training-modules.mjs --dry-run
 *
 * Safe to run multiple times. A module already archived is skipped.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const candidates = await prisma.trainingModule.findMany({
    where: {
      type: { not: "INTERACTIVE_JOURNEY" },
      archivedAt: null,
    },
    select: {
      id: true,
      title: true,
      type: true,
      contentKey: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  if (candidates.length === 0) {
    console.log("No legacy training modules to archive.");
    return;
  }

  console.log(
    `${DRY_RUN ? "[DRY RUN] Would archive" : "Archiving"} ${candidates.length} legacy module(s):`,
  );
  for (const m of candidates) {
    console.log(`  - ${m.type.padEnd(20)} ${m.contentKey ?? "(no contentKey)"} :: ${m.title}`);
  }

  if (DRY_RUN) return;

  const result = await prisma.trainingModule.updateMany({
    where: {
      id: { in: candidates.map((m) => m.id) },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });

  console.log(`Archived ${result.count} module(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
