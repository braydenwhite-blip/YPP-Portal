import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import {
  ACTION_PRESETS,
  actionPresetHref,
  applyActionFilters,
  buildActionFilterQuery,
  countActionPresets,
  effectiveStatus,
  groupActionsByLinkedEntity,
  hasActiveFilters,
  linkedGroupHeading,
  matchesActionPreset,
  parseActionFilters,
} from "@/lib/people-strategy/action-filters";
import {
  summarizeCompletion,
  summarizeDepartments,
  summarizeStatuses,
} from "@/lib/people-strategy/action-analytics";

const NOW = new Date("2026-06-01T12:00:00Z");

function person(id: string) {
  return { id, name: id, email: `${id}@x.org`, primaryRole: "ADMIN", profile: null };
}

type Comment = ActionItemWithRelations["comments"][number];
function comment(type: Comment["type"], authorId = "asker"): Comment {
  return { id: `c-${authorId}`, body: "ask", type, createdAt: NOW, author: person(authorId) } as Comment;
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
      priority: "ALL",
      visibility: "ALL",
      relatedType: "ALL",
      actionType: "ALL",
      source: "ALL",
      search: "",
      sort: "deadline_asc",
      preset: "ALL",
    });
  });

  it("parses and round-trips the source filter", () => {
    expect(parseActionFilters({ source: "meeting" }).source).toBe("meeting");
    expect(parseActionFilters({ source: "manual" }).source).toBe("manual");
    expect(parseActionFilters({ source: "junk" }).source).toBe("ALL");
    expect(buildActionFilterQuery(parseActionFilters({ source: "meeting" }))).toContain(
      "source=meeting"
    );
  });

  it("filters by source (meeting lens matches nothing; manual matches everything)", () => {
    const items = [item({ id: "a" }), item({ id: "b" })];
    // The legacy meeting-source link column is gone: the "meeting" lens can no
    // longer match anything.
    const meetingOnly = applyActionFilters(
      items,
      parseActionFilters({ source: "meeting" }),
      NOW
    );
    expect(meetingOnly.map((i) => i.id)).toEqual([]);
    const manualOnly = applyActionFilters(
      items,
      parseActionFilters({ source: "manual" }),
      NOW
    );
    expect(manualOnly.map((i) => i.id)).toEqual(["a", "b"]);
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

describe("action type filter", () => {
  it("parses a known type and ignores junk", () => {
    expect(parseActionFilters({ type: "PARTNERSHIP" }).actionType).toBe(
      "PARTNERSHIP"
    );
    expect(parseActionFilters({ type: "NONSENSE" }).actionType).toBe("ALL");
  });

  it("narrows to matching items and round-trips through the query string", () => {
    const items = [
      item({ id: "a", actionType: "PARTNERSHIP" }),
      item({ id: "b", actionType: "OUTREACH" }),
      item({ id: "c", actionType: null }),
    ];
    const filters = parseActionFilters({ type: "PARTNERSHIP" });
    const result = applyActionFilters(items, filters, NOW);
    expect(result.map((i) => i.id)).toEqual(["a"]);

    expect(hasActiveFilters(filters)).toBe(true);
    expect(buildActionFilterQuery(filters)).toContain("type=PARTNERSHIP");
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
    expect(s.counts).toEqual({
      NOT_STARTED: 0,
      IN_PROGRESS: 1,
      BLOCKED: 0,
      COMPLETE: 1,
      OVERDUE: 1,
      DROPPED: 0,
    });
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

describe("relatedType filter", () => {
  const classA = item({ id: "ca", relatedEntityType: "CLASS_OFFERING", relatedEntityId: "c1" });
  const mentorshipA = item({ id: "ma", relatedEntityType: "MENTORSHIP", relatedEntityId: "m1" });
  const unlinked = item({ id: "ua", relatedEntityType: null, relatedEntityId: null });
  const all = [classA, mentorshipA, unlinked];

  it("narrows to one linked-entity type", () => {
    const out = applyActionFilters(all, parseActionFilters({ rel: "CLASS_OFFERING" }), NOW);
    expect(out.map((i) => i.id)).toEqual(["ca"]);
  });

  it("ignores an unknown rel value (falls back to ALL)", () => {
    expect(parseActionFilters({ rel: "NONSENSE" }).relatedType).toBe("ALL");
    expect(applyActionFilters(all, parseActionFilters({ rel: "NONSENSE" }), NOW)).toHaveLength(3);
  });

  it("round-trips through the query builder", () => {
    expect(buildActionFilterQuery(parseActionFilters({ rel: "MENTORSHIP" }))).toContain(
      "rel=MENTORSHIP"
    );
  });

  it("counts toward hasActiveFilters", () => {
    expect(hasActiveFilters(parseActionFilters({ rel: "USER" }))).toBe(true);
  });
});

describe("groupActionsByLinkedEntity", () => {
  it("groups by ref and keeps unlinked actions last", () => {
    const c1a = item({ id: "c1a", relatedEntityType: "CLASS_OFFERING", relatedEntityId: "c1" });
    const c1b = item({ id: "c1b", relatedEntityType: "CLASS_OFFERING", relatedEntityId: "c1" });
    const m1 = item({ id: "m1a", relatedEntityType: "MENTORSHIP", relatedEntityId: "m1" });
    const none = item({ id: "none", relatedEntityType: null, relatedEntityId: null });

    const groups = groupActionsByLinkedEntity([c1a, none, m1, c1b]);
    const byKey = Object.fromEntries(groups.map((g) => [g.key, g.items.map((i) => i.id)]));

    expect(byKey["CLASS_OFFERING:c1"]).toEqual(["c1a", "c1b"]);
    expect(byKey["MENTORSHIP:m1"]).toEqual(["m1a"]);
    expect(byKey["none"]).toEqual(["none"]);
    // Unlinked group sorts last.
    expect(groups[groups.length - 1].key).toBe("none");
  });
});

describe("linkedGroupHeading", () => {
  it("uses the entity's own name + type, falls back for dangling links, labels unlinked", () => {
    const cls = item({ id: "c1a", relatedEntityType: "CLASS_OFFERING", relatedEntityId: "c1" });
    const mentorship = item({ id: "m1a", relatedEntityType: "MENTORSHIP", relatedEntityId: "m1" });
    const none = item({ id: "none", relatedEntityType: null, relatedEntityId: null });
    const byKey = Object.fromEntries(
      groupActionsByLinkedEntity([cls, mentorship, none]).map((g) => [g.key, g])
    );

    // Only the class is resolved; the mentorship is a dangling link.
    const labels = new Map([["CLASS_OFFERING:c1", { label: "Algebra 101", typeLabel: "Class" }]]);

    expect(linkedGroupHeading(byKey["CLASS_OFFERING:c1"], labels)).toBe("Algebra 101 · Class");
    expect(linkedGroupHeading(byKey["MENTORSHIP:m1"], labels)).toBe(
      "Mentorship · link no longer available"
    );
    expect(linkedGroupHeading(byKey["none"], labels)).toBe("Not linked");
  });
});

describe("summarizeCompletion", () => {
  const items = [
    item({ id: "a", status: "COMPLETE", deadlineStart: new Date("2026-06-20T00:00:00Z") }),
    item({ id: "b", status: "IN_PROGRESS", deadlineStart: new Date("2026-06-20T00:00:00Z") }),
    item({ id: "c", status: "IN_PROGRESS", deadlineStart: new Date("2026-05-01T00:00:00Z") }), // overdue
    item({ id: "d", status: "BLOCKED", deadlineStart: new Date("2026-06-20T00:00:00Z") }),
    item({ id: "e", status: "DROPPED", deadlineStart: new Date("2026-06-20T00:00:00Z") }),
  ];

  it("counts completed/open/overdue/blocked and excludes dropped from the rate", () => {
    const c = summarizeCompletion(items, NOW);
    expect(c.total).toBe(5);
    expect(c.completed).toBe(1);
    expect(c.dropped).toBe(1);
    expect(c.open).toBe(3); // b, c, d
    expect(c.overdue).toBe(1); // c
    expect(c.blocked).toBe(1); // d
    expect(c.completionRate).toBeCloseTo(0.25); // 1 completed / (5 - 1 dropped)
    expect(c.overdueRate).toBeCloseTo(1 / 3); // 1 overdue / 3 open
  });

  it("is safe on an empty set", () => {
    expect(summarizeCompletion([], NOW)).toMatchObject({
      total: 0,
      completed: 0,
      completionRate: 0,
      overdueRate: 0,
    });
  });
});

describe("strategic presets", () => {
  it("parses a known preset and ignores junk", () => {
    expect(parseActionFilters({ preset: "blocked" }).preset).toBe("blocked");
    expect(parseActionFilters({ preset: "NONSENSE" }).preset).toBe("ALL");
  });

  it("counts toward hasActiveFilters and round-trips through the query string", () => {
    const filters = parseActionFilters({ preset: "waiting" });
    expect(hasActiveFilters(filters)).toBe(true);
    const qs = buildActionFilterQuery(filters);
    expect(qs).toContain("preset=waiting");
    expect(
      parseActionFilters(Object.fromEntries(new URLSearchParams(qs))).preset
    ).toBe("waiting");
  });

  it("ACTION_PRESETS / actionPresetHref expose all five lenses", () => {
    expect(ACTION_PRESETS.map((p) => p.value)).toEqual([
      "unassigned",
      "due_soon",
      "high_priority",
      "blocked",
      "waiting",
    ]);
    expect(actionPresetHref("blocked")).toBe("/actions/all?preset=blocked");
  });

  it("ALL matches everything; every preset excludes settled work", () => {
    const open = item({ id: "open", leadId: null });
    const done = item({ id: "done", leadId: null, status: "COMPLETE" });
    const dropped = item({ id: "dropped", leadId: null, status: "DROPPED" });
    expect(matchesActionPreset(open, "ALL", NOW)).toBe(true);
    for (const { value } of ACTION_PRESETS) {
      expect(matchesActionPreset(done, value, NOW)).toBe(false);
      expect(matchesActionPreset(dropped, value, NOW)).toBe(false);
    }
  });

  it("unassigned = open with no lead owner", () => {
    expect(matchesActionPreset(item({ leadId: null }), "unassigned", NOW)).toBe(true);
    expect(matchesActionPreset(item({ leadId: "lead" }), "unassigned", NOW)).toBe(false);
  });

  it("due_soon = open, within 7 days, not overdue", () => {
    const soon = item({ deadlineStart: new Date("2026-06-04T12:00:00Z") });
    const far = item({ deadlineStart: new Date("2026-06-20T12:00:00Z") });
    const overdue = item({ deadlineStart: new Date("2026-05-01T12:00:00Z") });
    expect(matchesActionPreset(soon, "due_soon", NOW)).toBe(true);
    expect(matchesActionPreset(far, "due_soon", NOW)).toBe(false);
    expect(matchesActionPreset(overdue, "due_soon", NOW)).toBe(false);
  });

  it("high_priority = HIGH or URGENT", () => {
    expect(matchesActionPreset(item({ priority: "URGENT" }), "high_priority", NOW)).toBe(true);
    expect(matchesActionPreset(item({ priority: "HIGH" }), "high_priority", NOW)).toBe(true);
    expect(matchesActionPreset(item({ priority: "MEDIUM" }), "high_priority", NOW)).toBe(false);
    expect(matchesActionPreset(item({ priority: "LOW" }), "high_priority", NOW)).toBe(false);
  });

  it("blocked = blocked even when past due", () => {
    const blocked = item({ status: "BLOCKED", deadlineStart: new Date("2026-05-01T12:00:00Z") });
    expect(matchesActionPreset(blocked, "blocked", NOW)).toBe(true);
    expect(matchesActionPreset(item({ status: "IN_PROGRESS" }), "blocked", NOW)).toBe(false);
  });

  it("waiting = open with an unresolved INPUT_REQUESTED comment", () => {
    const waiting = item({ status: "IN_PROGRESS", comments: [comment("INPUT_REQUESTED")] });
    expect(matchesActionPreset(waiting, "waiting", NOW)).toBe(true);
    // A blocker outranks waiting in the smart-bucket precedence.
    const blockedWaiting = item({ status: "BLOCKED", comments: [comment("INPUT_REQUESTED")] });
    expect(matchesActionPreset(blockedWaiting, "waiting", NOW)).toBe(false);
    expect(matchesActionPreset(item({ comments: [comment("NOTE")] }), "waiting", NOW)).toBe(false);
  });

  it("applyActionFilters AND-composes a preset with the granular filters", () => {
    const items = [
      item({ id: "a", departmentId: "d1", status: "BLOCKED" }),
      item({ id: "b", departmentId: "d2", status: "BLOCKED" }),
      item({ id: "c", departmentId: "d1", status: "IN_PROGRESS" }),
    ];
    expect(
      applyActionFilters(items, parseActionFilters({ preset: "blocked" }), NOW)
        .map((i) => i.id)
        .sort()
    ).toEqual(["a", "b"]);
    expect(
      applyActionFilters(items, parseActionFilters({ preset: "blocked", dept: "d1" }), NOW).map(
        (i) => i.id
      )
    ).toEqual(["a"]);
  });

  it("countActionPresets tallies each lens and skips settled work", () => {
    const items = [
      item({ id: "u", leadId: null }),
      item({ id: "s", deadlineStart: new Date("2026-06-04T12:00:00Z") }),
      item({ id: "h", priority: "HIGH" }),
      item({ id: "b", status: "BLOCKED" }),
      item({ id: "w", comments: [comment("INPUT_REQUESTED")] }),
      item({ id: "done", leadId: null, status: "COMPLETE" }),
    ];
    expect(countActionPresets(items, NOW)).toEqual({
      unassigned: 1,
      due_soon: 1,
      high_priority: 1,
      blocked: 1,
      waiting: 1,
    });
  });
});
