import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Impact Meetings route regression check.
 *
 * Impact Meetings are now a meeting type inside the unified `/meetings` system.
 * These old URLs stay alive as redirects, so bookmarks and team-update links do
 * not 404, but they no longer render a separate Impact Meetings product.
 */

const CANONICAL = "/meetings";
const APP_ROOT = path.join(process.cwd(), "app", "(app)");

function pagePath(route: string): string {
  return path.join(APP_ROOT, ...route.split("/").filter(Boolean), "page.tsx");
}

describe("impact meetings routes", () => {
  it("ships the unified Meetings home and detail pages", () => {
    expect(existsSync(pagePath(CANONICAL))).toBe(true);
    expect(existsSync(pagePath("/meetings/[id]"))).toBe(true);
  });

  it("redirects every older Impact Meetings hub link to /meetings", () => {
    const aliases = [
      "/impact-meetings",
      "/impact-presentations",
      "/operations/impact-meetings",
      "/meetings/impact",
      "/work/impact-meetings",
    ];

    for (const alias of aliases) {
      const file = pagePath(alias);
      expect(existsSync(file), `${alias} alias page should exist`).toBe(true);
      const source = readFileSync(file, "utf8");
      expect(source, `${alias} should redirect`).toContain("redirect(");
      expect(source, `${alias} should redirect to ${CANONICAL}`).toContain('"/meetings');
    }
  });

  it("redirects current and old Impact detail subroutes into the unified room", () => {
    const current = pagePath("/impact-meetings/current");
    expect(existsSync(current), "current meeting route should exist").toBe(true);
    const currentSource = readFileSync(current, "utf8");
    expect(currentSource).toContain("findCurrentGlobalImpactMeeting");
    expect(currentSource).toContain("redirect(`/meetings/${meeting.id}`)");

    const routes = [
      "/impact-meetings/[id]",
      "/impact-meetings/[id]/agenda",
      "/impact-meetings/[id]/presentation",
      "/impact-meetings/[id]/live",
      "/impact-meetings/[id]/summary",
    ];

    for (const route of routes) {
      const file = pagePath(route);
      expect(existsSync(file), `${route} page should exist`).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("redirect(`/meetings/${id}");
    }
  });

  it("keeps Impact functionality loaded inside the canonical detail page", () => {
    const detail = pagePath("/meetings/[id]");
    const source = readFileSync(detail, "utf8");
    expect(source).toContain("GLOBAL_OPERATIONS_IMPACT_MEETING_TYPE");
    expect(source).toContain("loadGlobalOperationsImpactAgendaForMeeting");
    expect(source).toContain("ImpactMeetingAgendaPanel");
  });
});
