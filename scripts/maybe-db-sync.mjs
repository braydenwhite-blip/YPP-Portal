import { spawnSync } from "node:child_process";

function isVercelBuild() {
  // Vercel sets VERCEL=1 during both Build and Runtime.
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function envIsTrue(v) {
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes";
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) throw res.error;
  // If the process was terminated by a signal, treat as failure.
  if (typeof res.status !== "number") return 1;
  return res.status;
}

const disableDbSync =
  envIsTrue(process.env.DISABLE_DB_SYNC) || envIsTrue(process.env.SKIP_DB_SYNC);
const requireDbSync = envIsTrue(process.env.REQUIRE_DB_SYNC);

if (!isVercelBuild()) {
  console.log("[db-sync] Skipping Prisma db push (not running on Vercel).");
  process.exit(0);
}

if (disableDbSync) {
  console.log("[db-sync] Skipping Prisma db push (DISABLE_DB_SYNC/SKIP_DB_SYNC enabled).");
  process.exit(0);
}

console.log(
  "[db-sync] Vercel build detected. Syncing Prisma schema to the database (prisma db push)..."
);

// This is intentionally done at build time to prevent runtime 500s like:
// "The column Course.maxEnrollment does not exist in the current database."
let status = 0;
try {
  status = run("prisma", ["db", "push", "--skip-generate"]);
} catch (err) {
  console.error("[db-sync] Failed to run Prisma CLI:", err);
  status = 1;
}

if (status !== 0) {
  console.warn(
    "[db-sync] Prisma db push failed. This usually means the build environment can't reach the database."
  );
  console.warn(
    "[db-sync] Continuing the build so the deployment isn't blocked. Set REQUIRE_DB_SYNC=1 to fail the build instead."
  );
  process.exit(requireDbSync ? status : 0);
}

process.exit(0);
