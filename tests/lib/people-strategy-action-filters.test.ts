import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  applyActionFilters,
  buildActionFilterQuery,
  effectiveStatus,
  hasActiveFilters,
  parseActionFilters,
} from "@/lib/people-strategy/action-filters";
import {
  summarizeDepartments,
  summarizeStatuses,
} from "@/lib/people-strategy/action-analytics";

const NOW = new Date("2026-06-01T12:00:00Z");

function person(id: string) {
  return { id, name: id, email: `${id}@x.org`, primaryRole: "ADMIN", profile: null };
}

function item(overrides: Partial<ActionItemWithRelations>): ActionItemWithRelations {
  return {
    id: "i",
    title: "Item",
    description: null,
    goalCategory: "x",
    departmentId: "d1",
    status: "IN_PROGRESS",
    deadlineStart: new Date("2026-06-10T00:00:00Z"),
    deadlineEnd: null,
    visibility: "ALL_LEADERSHIP",
    leadId: "lead",
    officerMeetingId: null,
    flaggedAt: null,
    createdById: "lead",
    createdAt: NOW,
    updatedAt: NOW,
    department: { id: "d1", name: "Instruction", slug: "instruction" },
    lead: person("lead"),
    createdBy: person("lead"),
    assignments: [],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as ActionItemWithRelations;
}

describe("parseActionFilters", () => {
  it("defaults to ALL / asc on empty params", () => {
    expect(parseActionFilters({})).toEqual({
      department: "ALL",
      status: "ALL",
      visibility: "ALL",
      search: "",
      sort: "deadline_asc",
    });
  });

  it("validates enums and ignores junk", () => {
    const parsed = parseActionFilters({
      dept: "d2",
      status: "NONSENSE",
      vis: "OFFICERS_ONLY",
      q: "  marketing ",
      sort: "deadline_desc",
    });
    expect(parsed.department).toBe("d2");
    expect(parsed.status).toBe("ALL"); // junk falls back
    expect(parsed.visibility).toBe("OFFICERS_ONLY");
    expect(parsed.search).toBe("marketing");
    expect(parsed.sort).toBe("deadline_desc");
  });

  it("takes the first value of array params", () => {
    expect(parseActionFilters({ status: ["COMPLETE", "OVERDUE"] }).status).toBe("COMPLETE");
  });
});

describe("effectiveStatus", () => {
  it("treats a past-due open item as OVERDUE", () => {
    const overdue = item({ status: "IN_PROGRESS", deadlineStart: new Date("2026-05-01T00:00:00Z") });
    expect(effectiveStatus(overdue, NOW)).toBe("OVERDUE");
  });

  it("never marks a COMPLETE item overdue", () => {
    const done = item({ status: "COMPLETE", deadlineStart: new Date("2026-05-01T00:00:00Z") });
    expect(effectiveStatus(done, NOW)).toBe("COMPLETE");
  });
});

describe("applyActionFilters", () => {
  const items = [
    item({ id: "a", departmentId: "d1", title: "Alpha", status: "COMPLETE", deadlineStart: new Date("2026-06-20T00:00:00Z") }),
    item({ id: "b", departmentId: "d2", title: "Beta marketing push", status: "IN_PROGRESS", visibility: "OFFICERS_ONLY", deadlineStart: new Date("2026-06-05T00:00:00Z") }),
    item({ id: "c", departmentId: "d1", title: "Gamma", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-01T00:00:00Z") }), // overdue
  ];

  it("filters by department", () => {
    const out = applyActionFilters(items, parseActionFilters({ dept: "d1" }), NOW);
    expect(out.map((i) => i.id).sort()).toEqual(["a", "c"]);
  });

  it("filters by effective status (catches computed overdue)", () => {
    const out = applyActionFilters(items, parseActionFilters({ status: "OVERDUE" }), NOW);
    expect(out.map((i) => i.id)).toEqual(["c"]);
  });

  it("filters by visibility", () => {
    const out = applyActionFilters(items, parseActionFilters({ vis: "OFFICERS_ONLY" }), NOW);
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });

  it("searches title text case-insensitively", () => {
    const out = applyActionFilters(items, parseActionFilters({ q: "MARKETING" }), NOW);
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });

  it("sorts by deadline ascending by default and descending on request", () => {
    const asc = applyActionFilters(items, parseActionFilters({}), NOW);
    expect(asc.map((i) => i.id)).toEqual(["c", "b", "a"]);
    const desc = applyActionFilters(items, parseActionFilters({ sort: "deadline_desc" }), NOW);
    expect(desc.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("hasActiveFilters / buildActionFilterQuery", () => {
  it("detects active filters", () => {
    expect(hasActiveFilters(parseActionFilters({}))).toBe(false);
    expect(hasActiveFilters(parseActionFilters({ dept: "d1" }))).toBe(true);
  });

  it("round-trips a query string omitting defaults", () => {
    const filters = parseActionFilters({ dept: "d1", status: "OVERDUE", q: "x" });
    const qs = buildActionFilterQuery(filters);
    expect(parseActionFilters(Object.fromEntries(new URLSearchParams(qs)))).toMatchObject({
      department: "d1",
      status: "OVERDUE",
      search: "x",
      visibility: "ALL",
      sort: "deadline_asc",
    });
  });
});

describe("analytics reflect the filtered set", () => {
  const items = [
    item({ id: "a", departmentId: "d1", department: { id: "d1", name: "Instruction", slug: "i" }, status: "COMPLETE", deadlineStart: new Date("2026-06-20T00:00:00Z") }),
    item({ id: "c", departmentId: "d1", department: { id: "d1", name: "Instruction", slug: "i" }, status: "IN_PROGRESS", deadlineStart: new Date("2026-05-01T00:00:00Z") }), // overdue
    item({ id: "b", departmentId: "d2", department: { id: "d2", name: "Marketing", slug: "m" }, status: "IN_PROGRESS", deadlineStart: new Date("2026-06-05T00:00:00Z") }),
  ];

  it("summarizeStatuses uses effective status", () => {
    const s = summarizeStatuses(items, NOW);
    expect(s.total).toBe(3);
    expect(s.counts).toEqual({ NOT_STARTED: 0, IN_PROGRESS: 1, COMPLETE: 1, OVERDUE: 1 });
  });

  it("summarizeDepartments counts totals + overdue per department", () => {
    const bars = summarizeDepartments(items, NOW);
    const instruction = bars.find((b) => b.name === "Instruction");
    expect(instruction).toMatchObject({ total: 2, overdue: 1 });
    const marketing = bars.find((b) => b.name === "Marketing");
    expect(marketing).toMatchObject({ total: 1, overdue: 0 });
  });

  it("analytics narrow when the same filter is applied first", () => {
    const filtered = applyActionFilters(items, parseActionFilters({ dept: "d2" }), NOW);
    expect(summarizeStatuses(filtered, NOW).total).toBe(1);
    expect(summarizeDepartments(filtered, NOW)).toHaveLength(1);
  });
});
