import { spawnSync } from "node:child_process";

function isVercelBuild() {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function envIsTrue(v) {
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes";
}

/** Run a command, streaming output live. Returns the exit code. */
function run(cmd, args) {
  const res = spawnSync(cmd, args, { stdio: "inherit" });
  if (res.error) throw res.error;
  if (typeof res.status !== "number") return 1;
  return res.status;
}

/**
 * Run a command capturing stdout+stderr (also echoing them) so we can
 * inspect the output for specific error codes.
 */
function runCapture(cmd, args) {
  const res = spawnSync(cmd, args, {
    stdio: ["inherit", "pipe", "pipe"],
    encoding: "utf-8",
  });
  if (res.error) throw res.error;
  const stdout = res.stdout || "";
  const stderr = res.stderr || "";
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);
  return { status: res.status ?? 1, output: stdout + stderr };
}

const disableDbSync =
  envIsTrue(process.env.DISABLE_DB_SYNC) || envIsTrue(process.env.SKIP_DB_SYNC);
const requireDbSync = envIsTrue(process.env.REQUIRE_DB_SYNC);

if (!isVercelBuild()) {
  console.log("[db-sync] Skipping database migration (not running on Vercel).");
  process.exit(0);
}

if (disableDbSync) {
  console.log("[db-sync] Skipping database migration (DISABLE_DB_SYNC/SKIP_DB_SYNC enabled).");
  process.exit(0);
}

console.log("[db-sync] Vercel build detected. Running prisma migrate deploy...");
console.log("[db-sync] NOTE: Using 'migrate deploy' (safe, applies pending migrations only).");
console.log("[db-sync] This requires DIRECT_URL to point to a non-pooled database connection.");

let status = 0;
let output = "";
try {
  ({ status, output } = runCapture("prisma", ["migrate", "deploy"]));
} catch (err) {
  console.error("[db-sync] Failed to run Prisma CLI:", err);
  status = 1;
}

// ── P3009: failed migration left in the database ──────────────────────────
// Prisma blocks all future deploys when a migration is recorded as "started"
// but never finished. Detect this and resolve each failed migration as
// "rolled-back", then retry the deploy so the rest can proceed.
if (status !== 0 && (output.includes("P3009") || output.includes("failed migrations in the target database"))) {
  console.log("[db-sync] Detected P3009 — resolving failed migration(s) then retrying...");

  // Extract every migration name that Prisma reports as failed.
  // The error line looks like:
  //   The `<name>` migration started at <timestamp> failed
  const failedNames = [...output.matchAll(/The `([^`]+)` migration\b[^`\n]*\bfailed/g)].map(
    (m) => m[1]
  );

  if (failedNames.length === 0) {
    console.warn("[db-sync] Could not parse failed migration name(s) from Prisma output.");
    console.warn("[db-sync] Run `prisma migrate resolve --rolled-back <name>` manually.");
  } else {
    for (const name of failedNames) {
      console.log(`[db-sync] Resolving failed migration as rolled-back: ${name}`);
      try {
        const resolveStatus = run("prisma", ["migrate", "resolve", "--rolled-back", name]);
        if (resolveStatus !== 0) {
          console.error(`[db-sync] Failed to resolve migration: ${name}`);
        } else {
          console.log(`[db-sync] ✓ Resolved: ${name}`);
        }
      } catch (err) {
        console.error(`[db-sync] Error resolving migration ${name}:`, err);
      }
    }

    // Retry deploy now that the dirty state is cleared.
    console.log("[db-sync] Retrying prisma migrate deploy after resolving failed migrations...");
    try {
      status = run("prisma", ["migrate", "deploy"]);
    } catch (err) {
      console.error("[db-sync] Failed to run Prisma CLI on retry:", err);
      status = 1;
    }
  }
}
// ──────────────────────────────────────────────────────────────────────────

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

  if (requireDbSync) {
    console.error(
      "[db-sync] REQUIRE_DB_SYNC=1 is set — failing the build."
    );
    process.exit(status);
  }

  console.warn(
    "[db-sync] ⚠️  Continuing the build WITHOUT applying migrations."
  );
  console.warn(
    "[db-sync] Set REQUIRE_DB_SYNC=1 to fail the build on migration errors."
  );
  process.exit(0);
}

console.log("[db-sync] ✅ Migrations applied successfully.");
process.exit(0);
