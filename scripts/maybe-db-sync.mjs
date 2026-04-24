import { spawnSync } from "node:child_process";

function isVercelBuild() {
  return process.env.VERCEL === "1" || process.env.VERCEL === "true";
}

function envIsTrue(v) {
  if (!v) return false;
  return v === "1" || v === "true" || v === "yes";
}

function parseUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

function isSupabaseSessionPoolerUrl(rawUrl) {
  const url = parseUrl(rawUrl);
  return Boolean(
    url &&
      url.hostname.toLowerCase().includes("pooler.supabase.com") &&
      url.port === "5432"
  );
}

function describeConnectionTarget(rawUrl) {
  const url = parseUrl(rawUrl);
  if (!url) return "invalid URL";
  return `${url.hostname}:${url.port || "(default)"}`;
}

function extractSupabaseProjectRef(rawUrl) {
  const url = parseUrl(rawUrl);
  if (!url) return null;

  const hostMatch = url.hostname.match(/^db\.([a-z0-9-]+)\.supabase\.co$/i);
  if (hostMatch?.[1]) {
    return hostMatch[1];
  }

  const usernameMatch = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9-]+)$/i);
  if (usernameMatch?.[1]) {
    return usernameMatch[1];
  }

  return null;
}

function logSupabaseDirectUrlFix(rawUrl) {
  const url = parseUrl(rawUrl);
  const target = describeConnectionTarget(rawUrl);
  const ref = extractSupabaseProjectRef(rawUrl);
  const currentUser = url ? decodeURIComponent(url.username || "(missing)") : "(missing)";

  console.warn(
    `[db-sync] DIRECT_URL points to the Supabase session pooler (${target}).`
  );
  console.warn(
    "[db-sync] Supabase supports session mode on port 5432 for Prisma migrations in IPv4-only environments."
  );
  console.warn(
    `[db-sync] Current Supabase user looks like: ${currentUser}`
  );

  if (ref) {
    console.warn(
      `[db-sync] Direct host db.${ref}.supabase.co:5432 is still preferred when your build environment can reach it.`
    );
  } else {
    console.warn(
      "[db-sync] A direct host db.<project-ref>.supabase.co:5432 is still preferred when your build environment can reach it."
    );
  }

  console.warn(
    "[db-sync] Continuing with prisma migrate deploy using the session pooler. Keep DATABASE_URL on the transaction pooler (usually port 6543)."
  );
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
console.log(
  "[db-sync] DIRECT_URL should prefer a direct database host, but Supabase session mode on port 5432 is allowed when direct IPv6 access is unavailable."
);

const directUrl = process.env.DIRECT_URL?.trim();

if (directUrl && isSupabaseSessionPoolerUrl(directUrl)) {
  logSupabaseDirectUrlFix(directUrl);
}

let status = 0;
let output = "";
try {
  ({ status, output } = runCapture("prisma", ["migrate", "deploy"]));
} catch (err) {
  console.error("[db-sync] Failed to run Prisma CLI:", err);
  status = 1;
}

// ── P3009 / P3018: failed migration blocking future deploys ───────────────
// P3009: migration started but never finished (dirty state).
// P3018: migration failed to apply and was rolled back.
// Both block subsequent deploys. Resolve each failed migration as
// "rolled-back" and retry so the rest can proceed.
const hasBlockedMigration =
  status !== 0 &&
  (output.includes("P3009") ||
    output.includes("P3018") ||
    output.includes("failed migrations in the target database") ||
    output.includes("New migrations cannot be applied before the error is recovered from"));

if (hasBlockedMigration) {
  const errorCode = output.includes("P3018") ? "P3018" : "P3009";
  console.log(`[db-sync] Detected ${errorCode} — resolving failed migration(s) then retrying...`);

  // Extract every migration name Prisma reports as failed.
  // P3009 line: The `<name>` migration started at <timestamp> failed
  // P3018 line: Migration name: <name>
  const failedNames = [
    ...[...output.matchAll(/The `([^`]+)` migration\b[^`\n]*\bfailed/g)].map((m) => m[1]),
    ...[...output.matchAll(/Migration name:\s*(\S+)/g)].map((m) => m[1]),
  ].filter((v, i, a) => a.indexOf(v) === i); // dedupe

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

// ── Content import: run after migrations succeed ───────────────────────────
console.log("[db-sync] Running training content import...");

let importStatus = 0;
try {
  importStatus = run("npx", ["tsx", "scripts/import-training-academy-content.mjs"]);
} catch (err) {
  console.error("[db-sync] Failed to spawn training content import:", err);
  importStatus = 1;
}

if (importStatus !== 0) {
  console.error(
    "[db-sync] ❌ Training content import failed (exit code " + importStatus + ")."
  );

  if (requireDbSync) {
    console.error("[db-sync] REQUIRE_DB_SYNC=1 is set — failing the build.");
    process.exit(importStatus);
  }

  console.warn(
    "[db-sync] ⚠️  Continuing the build WITHOUT importing training content."
  );
  console.warn(
    "[db-sync] Set REQUIRE_DB_SYNC=1 to fail the build on import errors."
  );
  process.exit(0);
}

console.log("[db-sync] ✅ Training content import completed successfully.");
process.exit(0);
