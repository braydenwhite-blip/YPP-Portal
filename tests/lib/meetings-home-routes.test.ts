import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_CATALOG } from "@/lib/navigation/catalog";
import {
  OFFICER_SIDEBAR_LINK_ORDER,
  OFFICER_UNHIDE_HREFS,
} from "@/lib/navigation/officer-nav-layout";
import { appendSearchParams } from "@/lib/navigation/redirect-search-params";

/**
 * Canonical Meetings route + navigation contract.
 *
 * `/meetings` is the one visible door. `/meetings/[id]` is the one detail/run
 * room for officer meetings, Impact Meetings, and any other meeting type. Old
 * meeting hubs remain as redirects so deep links do not 404.
 */

const HOME = "/meetings";
const DETAIL = "/meetings/[id]";
const APP_ROOT = path.join(process.cwd(), "app", "(app)");

function pagePath(route: string): string {
  return path.join(APP_ROOT, ...route.split("/").filter(Boolean), "page.tsx");
}

describe("meetings routes", () => {
  it("ships the canonical Meetings home page", () => {
    const file = pagePath(HOME);
    expect(existsSync(file)).toBe(true);
    const source = readFileSync(file, "utf8");
    expect(source).toContain("Your meetings");
    expect(source).toContain("Recent meetings");
    expect(source).toContain("Teams ready");
  });

  it("ships the canonical meeting detail/run page", () => {
    const file = pagePath(DETAIL);
    expect(existsSync(file)).toBe(true);
    const source = readFileSync(file, "utf8");
    expect(source).toContain("MeetingDetailClient");
    expect(source).toContain("ImpactMeetingAgendaPanel");
    expect(source).toContain("MeetingAgendaSummaryPanel");
  });

  it("has one visible Meetings nav catalog entry", () => {
    const meetingEntries = NAV_CATALOG.filter((link) =>
      ["/meetings", "/actions/meetings", "/impact-meetings"].includes(link.href)
    );
    expect(meetingEntries).toHaveLength(1);
    expect(meetingEntries[0]).toMatchObject({ href: HOME, label: "Meetings" });
  });

  it("wires the officer sidebar to only the unified Meetings entry", () => {
    expect(OFFICER_SIDEBAR_LINK_ORDER).toContain(HOME);
    expect(OFFICER_SIDEBAR_LINK_ORDER).not.toContain("/actions/meetings");
    expect(OFFICER_SIDEBAR_LINK_ORDER).not.toContain("/impact-meetings");
    expect(OFFICER_UNHIDE_HREFS.has(HOME)).toBe(true);
    expect(OFFICER_UNHIDE_HREFS.has("/actions/meetings")).toBe(false);
    expect(OFFICER_UNHIDE_HREFS.has("/impact-meetings")).toBe(false);
  });

  it("keeps old meeting hubs as redirects to /meetings", () => {
    const aliases = [
      "/actions/meetings",
      "/impact-meetings",
      "/impact-presentations",
      "/meetings/impact",
      "/officer-meetings",
      "/operations/impact-meetings",
      "/work/impact-meetings",
    ];

    for (const alias of aliases) {
      const file = pagePath(alias);
      expect(existsSync(file), `${alias} alias page should exist`).toBe(true);
      const source = readFileSync(file, "utf8");
      expect(source, `${alias} should redirect`).toContain("redirect(");
      expect(source, `${alias} should redirect to ${HOME}`).toContain('"/meetings');
    }
  });

  it("keeps old detail routes as redirects to the canonical room", () => {
    const actionDetail = pagePath("/actions/meetings/[id]");
    expect(existsSync(actionDetail)).toBe(true);
    expect(readFileSync(actionDetail, "utf8")).toContain("redirect(`/meetings/${id}`)");

    const impactRoutes = [
      "/impact-meetings/[id]",
      "/impact-meetings/[id]/agenda",
      "/impact-meetings/[id]/presentation",
      "/impact-meetings/[id]/live",
      "/impact-meetings/[id]/summary",
    ];

    for (const route of impactRoutes) {
      const file = pagePath(route);
      expect(existsSync(file), `${route} page should exist`).toBe(true);
      expect(readFileSync(file, "utf8")).toContain("redirect(`/meetings/${id}");
    }
  });

  it("gives the Meetings home a clear create-meeting path (no dead self-links)", () => {
    const source = readFileSync(pagePath(HOME), "utf8");
    // The home must offer a visible way to schedule a meeting — previously the
    // only header links pointed back at /meetings (the page you were already on).
    expect(source).toContain("/actions/meetings/new");
    expect(source).toContain("Schedule meeting");
    // The old no-op self-links are gone.
    expect(source).not.toContain("Find a meeting");
    expect(source).not.toContain("All summaries");
  });

  it("wraps the canonical meeting routes in loading and error boundaries", () => {
    for (const route of [HOME, DETAIL]) {
      const dir = path.join(APP_ROOT, ...route.split("/").filter(Boolean));
      expect(existsSync(path.join(dir, "loading.tsx")), `${route}/loading.tsx should exist`).toBe(true);
      expect(existsSync(path.join(dir, "error.tsx")), `${route}/error.tsx should exist`).toBe(true);
    }
  });

  it("preserves create-from-context params through the /actions/meetings redirect", () => {
    const source = readFileSync(pagePath("/actions/meetings"), "utf8");
    // ?new=1 forwards to the canonical new-meeting form, carrying the entity link
    // (relatedType/relatedId) instead of dropping it on the floor.
    expect(source).toContain("/actions/meetings/new");
    expect(source).toContain("appendSearchParams");
    expect(
      appendSearchParams("/actions/meetings/new", { relatedType: "USER", relatedId: "u1" })
    ).toBe("/actions/meetings/new?relatedType=USER&relatedId=u1");
    // No params → plain path (the default redirect target stays clean).
    expect(appendSearchParams("/meetings", undefined)).toBe("/meetings");
  });
});
