import { describe, expect, it, vi } from "vitest";

// Only the pure filter helpers are under test; stub the prisma module the
// query half of lib/partners-directory imports.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import {
  asPartnerFlagFilter,
  asPartnerViewFilter,
  filterPartnerRows,
  type PartnerDirectoryRow,
} from "@/lib/partners-directory";

function row(overrides: Partial<PartnerDirectoryRow>): PartnerDirectoryRow {
  return {
    id: "p1",
    name: "Camp Hudson",
    typeLabel: "Camp",
    location: null,
    stage: "REACHED_OUT",
    stageLabel: "Reached out",
    stageGroup: "active",
    lead: { id: "u1", name: "Sam Singer" },
    primaryContact: { name: "Dana Field", title: "Director", email: "dana@camp.org" },
    classCount: 0,
    lastContactedISO: null,
    nextFollowUpISO: null,
    stuck: [],
    openRequestCount: 0,
    nextOpenRequest: null,
    agreements: { total: 0, signed: 0, pendingConditions: 0 },
    upcomingMeetingCount: 0,
    openActionCount: 0,
    ...overrides,
  };
}

describe("filterPartnerRows", () => {
  const rows: PartnerDirectoryRow[] = [
    row({ id: "active", stageGroup: "active" }),
    row({
      id: "stuck",
      name: "Lakeside School",
      typeLabel: "School",
      stageGroup: "active",
      stuck: ["Follow-up is overdue"],
      lead: null,
      primaryContact: null,
    }),
    row({
      id: "won",
      name: "Northside Library",
      typeLabel: "Library",
      stageGroup: "won",
      openRequestCount: 2,
      primaryContact: { name: "Lee Park", title: null, email: "lee@library.org" },
    }),
    row({
      id: "meeting",
      name: "Harbor Nonprofit",
      typeLabel: "Nonprofit",
      stageGroup: "parked",
      upcomingMeetingCount: 1,
      primaryContact: null,
      lead: { id: "u2", name: "Riley Moss" },
    }),
  ];

  it("returns everything for the all view", () => {
    expect(filterPartnerRows(rows, { view: "all", flag: null })).toHaveLength(4);
  });

  it("filters by stage group views", () => {
    expect(filterPartnerRows(rows, { view: "active", flag: null }).map((r) => r.id)).toEqual([
      "active",
      "stuck",
    ]);
    expect(filterPartnerRows(rows, { view: "won", flag: null }).map((r) => r.id)).toEqual([
      "won",
    ]);
    expect(filterPartnerRows(rows, { view: "parked", flag: null }).map((r) => r.id)).toEqual([
      "meeting",
    ]);
  });

  it("follow-up view = rows with concrete stuck reasons", () => {
    expect(
      filterPartnerRows(rows, { view: "follow-up", flag: null }).map((r) => r.id)
    ).toEqual(["stuck"]);
  });

  it("meetings view = rows with an upcoming partner-linked meeting", () => {
    expect(
      filterPartnerRows(rows, { view: "meetings", flag: null }).map((r) => r.id)
    ).toEqual(["meeting"]);
  });

  it("flags filter unowned relationships and open requests", () => {
    expect(filterPartnerRows(rows, { view: "all", flag: "no-lead" }).map((r) => r.id)).toEqual([
      "stuck",
    ]);
    expect(
      filterPartnerRows(rows, { view: "all", flag: "open-requests" }).map((r) => r.id)
    ).toEqual(["won"]);
  });

  it("type filter matches the resolved type label", () => {
    expect(
      filterPartnerRows(rows, { view: "all", flag: null, type: "School" }).map((r) => r.id)
    ).toEqual(["stuck"]);
  });

  it("search matches name, contact, and lead", () => {
    expect(
      filterPartnerRows(rows, { view: "all", flag: null, q: "lakeside" }).map((r) => r.id)
    ).toEqual(["stuck"]);
    expect(
      filterPartnerRows(rows, { view: "all", flag: null, q: "dana@camp" }).map((r) => r.id)
    ).toEqual(["active"]);
    expect(
      filterPartnerRows(rows, { view: "all", flag: null, q: "riley moss" }).map((r) => r.id)
    ).toEqual(["meeting"]);
  });
});

describe("filter param coercion", () => {
  it("falls back safely on junk input", () => {
    expect(asPartnerViewFilter("nonsense")).toBe("all");
    expect(asPartnerViewFilter(undefined)).toBe("all");
    expect(asPartnerViewFilter("follow-up")).toBe("follow-up");
    expect(asPartnerFlagFilter("nonsense")).toBeNull();
    expect(asPartnerFlagFilter("no-lead")).toBe("no-lead");
  });
});
