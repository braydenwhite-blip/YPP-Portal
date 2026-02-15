import { spawnSync } from "node:child_process";
import path from "node:path";

const scriptPath = path.resolve(
  process.cwd(),
  "scripts/import-training-academy-content.mjs"
);

const child = spawnSync(
  process.execPath,
  [scriptPath, ...process.argv.slice(2)],
  { stdio: "inherit" }
);

if (typeof child.status === "number") {
  process.exit(child.status);
}

process.exit(1);
