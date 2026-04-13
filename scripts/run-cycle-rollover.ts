/**
 * CLI wrapper for the mentorship cycle rollover job (Phase 0.99999).
 *
 * Usage:
 *   npx tsx scripts/run-cycle-rollover.ts --dry-run
 *   npx tsx scripts/run-cycle-rollover.ts --commit
 *
 * Refuses to commit in production unless --i-know-what-i-am-doing is passed.
 */
import { runMentorshipCycleRollover } from "../lib/cron/mentorship-cycle-rollover";

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = !argv.includes("--commit");
  const force = argv.includes("--i-know-what-i-am-doing");

  if (!dryRun && process.env.NODE_ENV === "production" && !force) {
    console.error(
      "Refusing to run --commit in production without --i-know-what-i-am-doing"
    );
    process.exit(2);
  }

  console.log(
    `\n=== Mentorship cycle rollover ${dryRun ? "(DRY RUN)" : "(COMMIT)"} ===\n`
  );
  const result = await runMentorshipCycleRollover({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  console.log(
    dryRun
      ? "\nDRY RUN complete. No notifications sent, no cycleStage writes."
      : "\nCOMMIT complete."
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .then(() => process.exit(0));
