import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_CATALOG } from "@/lib/navigation/catalog";
import {
  applyOfficerNavLayout,
  OFFICER_SIDEBAR_LINK_ORDER,
  OFFICER_UNHIDE_HREFS,
} from "@/lib/navigation/officer-nav-layout";

/** The officer-sidebar label for a real catalog href (after the leadership remap). */
function officerSidebarLabel(href: string): string | undefined {
  const link = NAV_CATALOG.find((entry) => entry.href === href);
  return link ? applyOfficerNavLayout(link).label : undefined;
}

/**
 * Canonical Meetings home route + navigation contract.
 *
 * `/meetings` is the single front door for the whole meetings experience. The
 * two meeting types each keep ONE consistent detail experience:
 *   • Officer Meetings → /actions/meetings (hub) + /actions/meetings/[id] (detail)
 *   • Impact Meetings  → /impact-meetings   (hub) + /impact-meetings/[id]  (detail)
 * This suite pins those entry points and guards against the duplicate-hub /
 * duplicate-label drift this consolidation removed. Filesystem + config only
 * (no DB, no Playwright).
 */

const HOME = "/meetings";
const APP_ROOT = path.join(process.cwd(), "app", "(app)");

function pagePath(route: string): string {
  return path.join(APP_ROOT, ...route.split("/").filter(Boolean), "page.tsx");
}

describe("meetings home routes", () => {
  it("ships the canonical Meetings home page", () => {
    const file = pagePath(HOME);
    expect(existsSync(file)).toBe(true);
    const source = readFileSync(file, "utf8");
    // It renders the home buckets and routes per type — not a second data hub.
    expect(source).toContain("bucketMeetings");
    expect(source).toContain("meetingDetailHref");
  });

  it("points the nav catalog 'Meetings' entry at the canonical home", () => {
    const meetings = NAV_CATALOG.filter((link) => link.label === "Meetings");
    expect(meetings).toHaveLength(1);
    expect(meetings[0]?.href).toBe(HOME);
  });

  it("keeps Officer Meetings and Impact Meetings as distinct, clearly-labeled entries", () => {
    const officer = NAV_CATALOG.find((link) => link.href === "/actions/meetings");
    const impact = NAV_CATALOG.find((link) => link.href === "/impact-meetings");
    expect(officer?.label).toBe("Officer Meetings");
    expect(impact?.label).toBe("Impact Meetings");
    // The two types are never collapsed into one ambiguous "Meetings" label.
    expect(officer?.label).not.toBe(impact?.label);
  });

  it("never ships two catalog entries with the same label among the meeting hubs", () => {
    const meetingHubLabels = NAV_CATALOG.filter((link) =>
      ["/meetings", "/actions/meetings", "/impact-meetings"].includes(link.href)
    ).map((link) => link.label);
    expect(new Set(meetingHubLabels).size).toBe(meetingHubLabels.length);
  });

  it("wires the officer sidebar to the umbrella plus both type hubs", () => {
    expect(OFFICER_SIDEBAR_LINK_ORDER).toContain(HOME);
    expect(OFFICER_UNHIDE_HREFS.has(HOME)).toBe(true);
    // The umbrella sorts before the two type-specific hubs.
    expect(OFFICER_SIDEBAR_LINK_ORDER.indexOf(HOME)).toBeLessThan(
      OFFICER_SIDEBAR_LINK_ORDER.indexOf("/actions/meetings")
    );
    expect(OFFICER_SIDEBAR_LINK_ORDER.indexOf(HOME)).toBeLessThan(
      OFFICER_SIDEBAR_LINK_ORDER.indexOf("/impact-meetings")
    );
    expect(officerSidebarLabel("/meetings")).toBe("Meetings");
    expect(officerSidebarLabel("/actions/meetings")).toBe("Officer Meetings");
    expect(officerSidebarLabel("/impact-meetings")).toBe("Impact Meetings");
  });

  it("keeps the legacy /meetings/impact deep link redirecting to the impact hub", () => {
    const file = pagePath("/meetings/impact");
    expect(existsSync(file)).toBe(true);
    expect(readFileSync(file, "utf8")).toContain('redirect("/impact-meetings")');
  });
});
