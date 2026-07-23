import "dotenv/config";

import {
  applyUserChapterRepairs,
  planUserChapterRepairs,
} from "@/lib/chapters/operating";

async function main() {
  const apply = process.argv.includes("--apply");
  if (!apply) {
    console.log("DRY RUN — re-run with --apply to commit changes.\n");
  }

  const { operating, repairs } = await planUserChapterRepairs();

  console.log(
    `Operating chapters: ${operating.map((c) => c.name).join(", ")}`
  );
  console.log(`Repairs needed: ${repairs.length}`);

  if (repairs.length === 0) {
    console.log("All users already on a correct operating chapter (or allowed null).");
    return;
  }

  for (const row of repairs) {
    console.log(
      `  - ${row.email} (${row.primaryRole}): ${row.fromChapter ?? "(none)"} → ${row.toChapter} [${row.reason}]`
    );
  }

  if (!apply) {
    console.log("\nNo changes applied.");
    return;
  }

  const updated = await applyUserChapterRepairs(repairs);
  console.log(`\nUpdated ${updated} user(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
