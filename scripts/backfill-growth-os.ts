/**
 * Backfill the Student Operating System / Growth Engine (Phase N1) from existing
 * historical signals (mentorships, certificates). Idempotent — safe to re-run.
 *
 * Requires ENABLE_GROWTH_OS=true (every emit is a no-op otherwise).
 *
 *   ENABLE_GROWTH_OS=true npx tsx scripts/backfill-growth-os.ts            # all users
 *   ENABLE_GROWTH_OS=true npx tsx scripts/backfill-growth-os.ts <userId>   # one user
 */

import { isGrowthOsEnabled } from "@/lib/feature-flags";
import { prisma } from "@/lib/prisma";
import {
  backfillGrowthForAllUsers,
  backfillGrowthForUser,
} from "@/lib/growth/backfill";

async function main() {
  if (!isGrowthOsEnabled()) {
    console.error(
      "ENABLE_GROWTH_OS is not 'true' — every Growth emit is a no-op. Aborting."
    );
    process.exitCode = 1;
    return;
  }

  const userId = process.argv[2];
  if (userId) {
    const result = await backfillGrowthForUser(userId);
    console.log("Backfilled one user:", JSON.stringify(result, null, 2));
    return;
  }

  console.log("Backfilling all users with replayable signals…");
  const { users, results } = await backfillGrowthForAllUsers();
  const totals = results.reduce(
    (acc, r) => ({
      mentorships: acc.mentorships + r.mentorships,
      completedMentorships: acc.completedMentorships + r.completedMentorships,
      certificates: acc.certificates + r.certificates,
    }),
    { mentorships: 0, completedMentorships: 0, certificates: 0 }
  );
  console.log(`Done. Users: ${users}. Totals:`, totals);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("Backfill failed:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
