import { spawnSync } from "node:child_process";

function isVercelBuild() {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function envIsTrue(v) {
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes";
}

function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) throw res.error;
  if (typeof res.status !== "number") return 1;
  return res.status;
}

const disableDbSync =
  envIsTrue(process.env.DISABLE_DB_SYNC) || envIsTrue(process.env.SKIP_DB_SYNC);
const requireDbSync = envIsTrue(process.env.REQUIRE_DB_SYNC);
const isProductionDeployment = process.env.VERCEL_ENV === "production";
const shouldFailOnMigrationError = requireDbSync || isProductionDeployment;

if (!isVercelBuild()) {
  console.log("[db-sync] Skipping database migration (not running on Vercel).");
  process.exit(0);
}

if (disableDbSync) {
  console.log("[db-sync] Skipping database migration (DISABLE_DB_SYNC/SKIP_DB_SYNC enabled).");
  process.exit(0);
}

console.log(
  "[db-sync] Vercel build detected. Running prisma migrate deploy..."
);
console.log(
  "[db-sync] NOTE: Using 'migrate deploy' (safe, applies pending migrations only)."
);
console.log(
  "[db-sync] This requires DIRECT_URL to point to a non-pooled database connection."
);
console.log(
  `[db-sync] VERCEL_ENV=${process.env.VERCEL_ENV ?? "unknown"}`
);

let status = 0;
try {
  status = run("prisma", ["migrate", "deploy"]);
} catch (err) {
  console.error("[db-sync] Failed to run Prisma CLI:", err);
  status = 1;
}

if (status !== 0) {
  console.error(
    "[db-sync] ❌ prisma migrate deploy failed (exit code " + status + ")."
  );
  console.error(
    "[db-sync] This usually means the build environment can't reach the database,"
  );
  console.error(
    "[db-sync] or DIRECT_URL is missing/incorrect."
  );

  if (shouldFailOnMigrationError) {
    if (requireDbSync) {
      console.error(
        "[db-sync] REQUIRE_DB_SYNC=1 is set — failing the build."
      );
    } else {
      console.error(
        "[db-sync] Production deployment detected — failing the build to prevent schema drift."
      );
    }
    process.exit(status);
  }

  console.warn(
    "[db-sync] ⚠️  Continuing the build WITHOUT applying migrations."
  );
  console.warn(
    "[db-sync] Set REQUIRE_DB_SYNC=1 to fail the build on migration errors in preview environments."
  );
  process.exit(0);
}

console.log("[db-sync] ✅ Migrations applied successfully.");
process.exit(0);
