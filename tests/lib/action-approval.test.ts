import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { filterActiveHubItems, showOnActiveHub } from "@/lib/people-strategy/action-approval";

function item(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: "a1",
    status: "NOT_STARTED",
    approvedAt: null,
    approvedById: null,
    ...overrides,
  } as ActionItemWithRelations;
}

describe("action hub visibility", () => {
  it("shows open work on the active hub", () => {
    expect(showOnActiveHub({ status: "NOT_STARTED" })).toBe(true);
    expect(showOnActiveHub({ status: "IN_PROGRESS" })).toBe(true);
    expect(showOnActiveHub({ status: "BLOCKED" })).toBe(true);
  });

  it("hides completed and dropped items from the active hub", () => {
    expect(showOnActiveHub({ status: "COMPLETE" })).toBe(false);
    expect(showOnActiveHub({ status: "DROPPED" })).toBe(false);
    expect(filterActiveHubItems([item({ status: "COMPLETE" })])).toHaveLength(0);
    expect(filterActiveHubItems([item({ status: "DROPPED" })])).toHaveLength(0);
  });
});
