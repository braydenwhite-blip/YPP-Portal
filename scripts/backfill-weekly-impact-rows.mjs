/**
 * backfill-weekly-impact-rows.mjs
 *
 * One-time migration helper for the table-based Weekly Impact form. The legacy
 * WeeklyMemberUpdate stored Section 1 (objective/deliverable/target date) and
 * Section 4 (input needed) as single fields. The form is now row-based, so this
 * copies each member's legacy single values into row #1 of the new child tables
 * (WeeklyImpactObjective / WeeklyImpactInputRequest) when they have content and no
 * rows yet. Idempotent — safe to re-run.
 *
 *   node scripts/backfill-weekly-impact-rows.mjs
 *   node scripts/backfill-weekly-impact-rows.mjs --dry-run
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const isDryRun = process.argv.includes("--dry-run");

async function main() {
  const members = await prisma.weeklyMemberUpdate.findMany({
    include: {
      objectives: { select: { id: true } },
      inputRequests: { select: { id: true } },
    },
  });

  let objectivesCreated = 0;
  let inputsCreated = 0;

  for (const m of members) {
    const hasObjectiveContent =
      m.personalObjective?.trim() || m.personalDeliverable?.trim() || m.targetDate;
    if (hasObjectiveContent && m.objectives.length === 0) {
      objectivesCreated += 1;
      if (!isDryRun) {
        await prisma.weeklyImpactObjective.create({
          data: {
            memberUpdateId: m.id,
            objective: m.personalObjective ?? null,
            deliverable: m.personalDeliverable ?? null,
            targetDate: m.targetDate ?? null,
            sortOrder: 0,
          },
        });
      }
    }

    const hasInputContent =
      m.inputNeeded?.trim() || m.inputNeededFrom?.trim() || m.inputNeededBy;
    if (hasInputContent && m.inputRequests.length === 0) {
      inputsCreated += 1;
      if (!isDryRun) {
        await prisma.weeklyImpactInputRequest.create({
          data: {
            memberUpdateId: m.id,
            request: m.inputNeeded ?? null,
            neededFrom: m.inputNeededFrom ?? null,
            neededBy: m.inputNeededBy ?? null,
            sortOrder: 0,
          },
        });
      }
    }
  }

  console.log(
    `${isDryRun ? "[dry-run] " : ""}Backfilled ${objectivesCreated} objective row(s) and ${inputsCreated} input-request row(s) across ${members.length} member form(s).`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
