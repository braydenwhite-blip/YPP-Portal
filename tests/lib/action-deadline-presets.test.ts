import { describe, expect, it } from "vitest";

import {
  actionDeadlinePresetHint,
  actionDeadlinePresetValue,
  matchActionDeadlinePreset,
  resolveActionDeadlinePreset,
} from "@/lib/people-strategy/action-deadline-presets";

/** Wednesday, Jun 10 2026 — operating week is Mon Jun 8 through Sun Jun 14. */
const WEDNESDAY = new Date(2026, 5, 10, 12, 0, 0);

describe("action-deadline-presets", () => {
  it("maps this week to Sunday of the current operating week", () => {
    const end = resolveActionDeadlinePreset("this-week", WEDNESDAY);
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(5);
    expect(end.getDate()).toBe(14);
    expect(end.getDay()).toBe(0);
  });

  it("does not use a fixed +7 day offset for this week", () => {
    const thisWeek = actionDeadlinePresetValue("this-week", WEDNESDAY);
    expect(thisWeek).toBe("2026-06-14");
    expect(thisWeek).not.toBe("2026-06-17");
    expect(matchActionDeadlinePreset(thisWeek, WEDNESDAY)).toBe("this-week");
  });

  it("shows a timeframe hint for this week", () => {
    expect(actionDeadlinePresetHint("this-week", WEDNESDAY)).toMatch(
      /Due anytime this week — by Sun, Jun 14/
    );
  });
});
