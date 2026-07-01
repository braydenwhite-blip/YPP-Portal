/**
 * Wide-open local dev — full portal sidebar, no public gate, no slim nav.
 * Use when you need every tab and route without /preview passcodes.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import dotenv from "dotenv";

const root = resolve(import.meta.dirname, "..");

for (const file of [".env", ".env.local"]) {
  const path = resolve(root, file);
  if (existsSync(path)) dotenv.config({ path, override: file === ".env.local" });
}

const childEnv = {
  ...process.env,
  PORTAL_PUBLIC_GATE: "off",
  PORTAL_SLIM_NAV: "false",
};

console.log("");
console.log("=== YPP local dev — full portal (gate OFF, full sidebar) ===");
console.log("");
console.log("Local: http://localhost:3000");
console.log("Every nav tab + /site-map should be visible after restart.");
console.log("");

const nextBin = resolve(root, "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, "dev"], {
  cwd: root,
  env: childEnv,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code) => process.exit(code ?? 0));
