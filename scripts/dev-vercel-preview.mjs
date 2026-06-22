/**
 * Run local dev to mirror the Brayden Vercel Preview deployment.
 *
 * Canonical preview (this branch, auto-updates on push):
 *   https://youthpassionproject-portal-git-preview-brayden-portal-brayden-whites-projects.vercel.app/
 *
 * Legacy pinned deployment (older build, frozen hash):
 *   https://youthpassionproject-portal-io1acmvjv-brayden-whites-projects.vercel.app/
 *
 * Localhost is always http://localhost:3000 — it cannot become the .vercel.app URL.
 * This script matches preview env behavior (gate, flags). Push branch
 * `preview/brayden-portal` on GitHub to refresh the canonical preview on Brayden's Vercel team.
 *
 * Optional: `.env.vercel-preview.local` with Preview DATABASE_URL + DIRECT_URL from
 * Vercel → Project → Settings → Environment Variables → Preview.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

const VERCEL_PREVIEW_URL =
  "https://youthpassionproject-portal-git-preview-brayden-portal-brayden-whites-projects.vercel.app";

const root = resolve(import.meta.dirname, "..");

for (const file of [".env", ".env.local", ".env.vercel-preview.local"]) {
  const path = resolve(root, file);
  if (existsSync(path)) dotenv.config({ path, override: file === ".env.vercel-preview.local" });
}

const previewPasscode =
  process.env.PORTAL_PREVIEW_PASSCODE?.trim() || "ypp-local-preview";

const childEnv = {
  ...process.env,
  // Match shipped preview/production gate (see lib/public-gate.ts).
  PORTAL_PUBLIC_GATE: "on",
  PORTAL_PREVIEW_PASSCODE: previewPasscode,
  NEXTAUTH_URL: "http://localhost:3000",
  // Dev-only unlock flags that are NOT on Vercel preview — force off.
  BYPASS_INSTRUCTOR_TRAINING_READINESS: "false",
  STUDENT_FULL_PORTAL_EXPLORER: "false",
  INSTRUCTOR_FULL_PORTAL_EXPLORER: "false",
  ENABLE_LEGACY_ACTION_CENTER_NAV: "false",
  ENABLE_GROWTH_OS: "false",
  // People & Reviews compile + table (match Vercel preview when set there).
  ENABLE_PEOPLE_DASHBOARD: process.env.ENABLE_PEOPLE_DASHBOARD ?? "true",
  ENABLE_QUARTERLY_REVIEWS: process.env.ENABLE_QUARTERLY_REVIEWS ?? "true",
  ENABLE_ACTION_TRACKER: process.env.ENABLE_ACTION_TRACKER ?? "true",
  ENABLE_OPERATIONS_HUB: process.env.ENABLE_OPERATIONS_HUB ?? "true",
};

const db = childEnv.DATABASE_URL ?? "";
const usingLocalDb = /@localhost:|127\.0\.0\.1/.test(db);

console.log("");
console.log("=== YPP local dev → mirrors Vercel preview ===");
console.log("");
console.log(`Preview:  ${VERCEL_PREVIEW_URL}/`);
console.log("Local:    http://localhost:3000");
console.log("Public gate: ON (same as that preview).");
console.log("");
if (usingLocalDb) {
  console.log("⚠ DATABASE_URL still points at localhost.");
  console.log("  Data will NOT match the Vercel preview until you add");
  console.log("  `.env.vercel-preview.local` with Preview DATABASE_URL + DIRECT_URL");
  console.log("  from the Vercel project (ask project owner if needed).");
  console.log("");
}
console.log("Unlock full portal in this browser (if routes hit /locked):");
console.log(`  http://localhost:3000/preview  passcode: ${previewPasscode}`);
console.log("");
console.log("Wide-open local dev (Docker DB, all flags): npm run dev:local");
console.log("");

const nextBin = resolve(root, "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: root,
  env: childEnv,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 0));
