import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_HELP_ENTRIES } from "@/lib/page-helper/registry";
import { appPageFileToRoutePattern } from "@/lib/page-helper/route-utils";

const APP_DIR = path.join(process.cwd(), "app");

function collectPageFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      collectPageFiles(fullPath, files);
      continue;
    }

    if (entry.isFile() && entry.name === "page.tsx") {
      files.push(fullPath);
    }
  }

  return files;
}

describe("page helper coverage", () => {
  it("covers every app page pattern with a helper entry and keeps the registry tidy", () => {
    const routePatterns = collectPageFiles(APP_DIR)
      .map((filePath) => path.relative(process.cwd(), filePath))
      .map((filePath) => appPageFileToRoutePattern(filePath));
    const registryPatterns = PAGE_HELP_ENTRIES.map((entry) => entry.pattern);

    const missingPatterns = routePatterns.filter((pattern) => !registryPatterns.includes(pattern));
    const extraPatterns = registryPatterns.filter((pattern) => !routePatterns.includes(pattern));

    expect(new Set(routePatterns).size).toBe(routePatterns.length);
    expect(new Set(registryPatterns).size).toBe(registryPatterns.length);
    expect(missingPatterns).toEqual([]);
    expect(extraPatterns).toEqual([]);
  });
});
