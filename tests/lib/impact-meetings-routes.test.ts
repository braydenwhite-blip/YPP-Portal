import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_CATALOG } from "@/lib/navigation/catalog";
import {
  OFFICER_SIDEBAR_LINK_ORDER,
  OFFICER_UNHIDE_HREFS,
} from "@/lib/navigation/officer-nav-layout";

/**
 * Impact Meetings route regression check.
 *
 * The Impact Meetings / Impact Presentations workflow has a single canonical
 * route. This suite pins that route, proves the standalone hub page exists, and
 * guards every older deep link with a redirect alias so none of them 404. It is
 * a filesystem + config contract (no DB, no Playwright) so it runs in plain
 * vitest and fails the build the moment a route drifts.
 */

const CANONICAL = "/impact-meetings";
const APP_ROOT = path.join(process.cwd(), "app", "(app)");

function pagePath(route: string): string {
  return path.join(APP_ROOT, ...route.split("/").filter(Boolean), "page.tsx");
}

describe("impact meetings routes", () => {
  it("ships the canonical hub page", () => {
    expect(existsSync(pagePath(CANONICAL))).toBe(true);
  });

  it("points the nav catalog entry at the canonical route", () => {
    const entry = NAV_CATALOG.find((link) => link.label === "Impact Meetings");
    expect(entry).toBeDefined();
    expect(entry?.href).toBe(CANONICAL);
  });

  it("keeps the officer sidebar wired to the canonical route", () => {
    expect(OFFICER_SIDEBAR_LINK_ORDER).toContain(CANONICAL);
    expect(OFFICER_UNHIDE_HREFS.has(CANONICAL)).toBe(true);
  });

  it("redirects every older Impact Meetings deep link to the canonical route", () => {
    const aliases = [
      "/impact-presentations",
      "/operations/impact-meetings",
      "/meetings/impact",
      "/work/impact-meetings",
    ];

    for (const alias of aliases) {
      const file = pagePath(alias);
      expect(existsSync(file), `${alias} alias page should exist`).toBe(true);
      const source = readFileSync(file, "utf8");
      expect(source, `${alias} should redirect to ${CANONICAL}`).toContain(
        `redirect("${CANONICAL}")`
      );
    }
  });
});
