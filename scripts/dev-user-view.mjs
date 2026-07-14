/**
 * Start Next dev with production-like visibility (public gate on, dev-only
 * unlock flags off). Use npm run dev:user-view — then log in as a seeded test
 * user in an incognito window to see the real sidebar / locked routes.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

const root = resolve(import.meta.dirname, "..");
for (const file of [".env", ".env.local"]) {
  const path = resolve(root, file);
  if (existsSync(path)) dotenv.config({ path });
}

const previewPasscode =
  process.env.PORTAL_PREVIEW_PASSCODE?.trim() || "ypp-local-preview";

const childEnv = {
  ...process.env,
  PORTAL_PUBLIC_GATE: "on",
  PORTAL_PREVIEW_PASSCODE: previewPasscode,
  // Match shipped defaults from lib/feature-flags.ts (OFF unless explicitly enabled).
  ENABLE_ACTION_TRACKER: "false",
  ENABLE_PEOPLE_DASHBOARD: "false",
  ENABLE_OPERATIONS_HUB: "false",
  ENABLE_GROWTH_OS: "false",
  ENABLE_REGULAR_INSTRUCTOR: "false",
  BYPASS_INSTRUCTOR_TRAINING_READINESS: "false",
  STUDENT_FULL_PORTAL_EXPLORER: "false",
  INSTRUCTOR_FULL_PORTAL_EXPLORER: "false",
  LEADERSHIP_FULL_PORTAL_EXPLORER: "false",
};

console.log("");
console.log("=== YPP dev:user-view (production-like visibility) ===");
console.log("");
console.log("Public gate: ON — most routes redirect to /locked.");
console.log("Feature flags: OFF (Action Tracker, Growth OS, etc.) like prod defaults.");
console.log("");
console.log("See what real users see:");
console.log("  1. Open an INCOGNITO window (no preview cookie).");
console.log("  2. Log in with a seeded test account + SEED_PASSWORD from .env:");
console.log("       Student     jordan.patel@youthpassionproject.org");
console.log("       Instructor  avery.lin@youthpassionproject.org");
console.log("       Admin       brayden.white@youthpassionproject.org");
console.log("  3. Try /admin or /actions — you should hit /locked (unless allowed).");
console.log("");
console.log("Unlock full portal on THIS browser only (internal testers):");
console.log(`  http://localhost:3000/preview  passcode: ${previewPasscode}`);
console.log("");
console.log("Exit preview: banner link or http://localhost:3000/api/preview/exit?next=/");
console.log("");
console.log("Normal dev (everything visible): npm run dev");
console.log("");

const nextBin = resolve(root, "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: root,
  env: childEnv,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 0));
