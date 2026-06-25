import { describe, expect, it } from "vitest";

import {
  ACTION_FILTER_DEFAULTS,
  applyActionFilters,
  buildActionFilterQuery,
  hasActiveFilters,
  hasActiveHubFilters,
  parseActionFilters,
} from "@/lib/people-strategy/action-filters";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

function item(
  overrides: Partial<ActionItemWithRelations> &
    Pick<ActionItemWithRelations, "id" | "title">
): ActionItemWithRelations {
  return {
    status: "NOT_STARTED",
    priority: "MEDIUM",
    visibility: "ALL_LEADERSHIP",
    chapterId: null,
    departmentId: null,
    relatedEntityType: null,
    actionType: null,
    deadlineStart: new Date("2026-07-01T00:00:00.000Z"),
    deadlineEnd: null,
    flaggedAt: null,
    resolvedAt: null,
    leadId: "u1",
    comments: [],
    ...overrides,
  } as unknown as ActionItemWithRelations;
}

describe("action filters — chapter lens", () => {
  const now = new Date("2026-06-25T12:00:00.000Z");

  it("parses the chapter query param", () => {
    expect(parseActionFilters({ ch: "chap-1" }).chapter).toBe("chap-1");
    expect(parseActionFilters({}).chapter).toBe("ALL");
    expect(parseActionFilters({ ch: "  " }).chapter).toBe("ALL");
  });

  it("narrows actions to a single chapter", () => {
    const items = [
      item({ id: "a1", title: "Recruit members", chapterId: "chap-1" }),
      item({ id: "a2", title: "Confirm advisor", chapterId: "chap-2" }),
      item({ id: "a3", title: "Unrelated action", chapterId: null }),
    ];
    const filtered = applyActionFilters(
      items,
      { ...ACTION_FILTER_DEFAULTS, chapter: "chap-1" },
      now
    );
    expect(filtered.map((i) => i.id)).toEqual(["a1"]);
  });

  it("returns every action when chapter is ALL", () => {
    const items = [
      item({ id: "a1", title: "A", chapterId: "chap-1" }),
      item({ id: "a2", title: "B", chapterId: null }),
    ];
    expect(applyActionFilters(items, ACTION_FILTER_DEFAULTS, now)).toHaveLength(2);
  });

  it("counts the chapter lens as an active (hub) filter", () => {
    const filters = { ...ACTION_FILTER_DEFAULTS, chapter: "chap-1" };
    expect(hasActiveFilters(filters)).toBe(true);
    expect(hasActiveHubFilters(filters)).toBe(true);
  });

  it("round-trips the chapter filter through the query string", () => {
    const qs = buildActionFilterQuery({ ...ACTION_FILTER_DEFAULTS, chapter: "chap-9" });
    expect(qs).toContain("ch=chap-9");
    expect(parseActionFilters({ ch: "chap-9" }).chapter).toBe("chap-9");
  });
});
