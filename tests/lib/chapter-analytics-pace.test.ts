import { describe, expect, it } from "vitest";

import {
  expectedAtMonth,
  monthsActiveAsOf,
  paceStatus,
  analyticsPanelKey,
  analyticsDiscussedSourceId,
} from "@/lib/chapters/analytics-pace";

describe("analytics-pace", () => {
  it("ramps student expectations toward mature target", () => {
    expect(expectedAtMonth("students", 7)).toBe(58);
    expect(expectedAtMonth("students", 12)).toBe(100);
    expect(expectedAtMonth("partners", 7)).toBe(6);
  });

  it("grades pace bands", () => {
    expect(paceStatus(58, 58)).toBe("on_track");
    expect(paceStatus(70, 58)).toBe("above");
    expect(paceStatus(45, 58)).toBe("needs_attention");
    expect(paceStatus(30, 58)).toBe("at_risk");
  });

  it("computes months active", () => {
    const launched = new Date(Date.UTC(2026, 3, 1)); // Apr 2026
    const asOf = new Date(Date.UTC(2026, 9, 15)); // Oct 2026
    expect(monthsActiveAsOf(launched, asOf)).toBe(7);
  });

  it("builds panel and discuss ids", () => {
    expect(analyticsPanelKey("ch1", "instructors")).toBe("ch1:instructors");
    expect(analyticsDiscussedSourceId("ch1", "instructors", "2026-10")).toBe(
      "chapter-analytics:discussed:ch1:instructors:2026-10"
    );
  });
});
