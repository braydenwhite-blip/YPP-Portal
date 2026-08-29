import { describe, expect, it } from "vitest";

/**
 * Mirrors the leaderboard loader rule: discussion markers must not appear as
 * assignable actions in the Discussion & Ownership panel.
 */
function isAssignableAnalyticsAction(sourceId: string | null | undefined): boolean {
  if (!sourceId) return true;
  return !sourceId.startsWith("chapter-analytics:discussed:");
}

describe("chapter analytics action panel filtering", () => {
  it("keeps real metric actions", () => {
    expect(isAssignableAnalyticsAction("chapter-analytics:action:partners:171000")).toBe(true);
    expect(isAssignableAnalyticsAction(null)).toBe(true);
  });

  it("drops discussion markers that share the metric token", () => {
    expect(
      isAssignableAnalyticsAction(
        "chapter-analytics:discussed:ch1:partners:2026-08"
      )
    ).toBe(false);
  });
});
