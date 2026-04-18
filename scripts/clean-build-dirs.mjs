/**
 * Cross-platform replacement for `rm -rf .next node_modules/.prisma` (Windows has no `rm`).
 */
import fs from "node:fs";
import path from "node:path";

const dirs = [".next", path.join("node_modules", ".prisma")];

for (const dir of dirs) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore missing dirs
  }
}
