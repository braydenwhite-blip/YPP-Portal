import { spawnSync } from "node:child_process";

function isVercelBuild() {
  // Vercel sets VERCEL=1 during both Build and Runtime.
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) throw res.error;
  // If the process was terminated by a signal, treat as failure.
  if (typeof res.status !== "number") return 1;
  return res.status;
}

if (!isVercelBuild()) {
  console.log("[db-sync] Skipping Prisma db push (not running on Vercel).");
  process.exit(0);
}

console.log(
  "[db-sync] Vercel build detected. Syncing Prisma schema to the database (prisma db push)..."
);

// This is intentionally done at build time to prevent runtime 500s like:
// "The column Course.maxEnrollment does not exist in the current database."
const status = run("prisma", ["db", "push", "--skip-generate"]);
process.exit(status);

