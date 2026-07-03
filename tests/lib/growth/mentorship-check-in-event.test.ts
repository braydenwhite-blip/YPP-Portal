import { describe, it, expect } from "vitest";

import {
  GROWTH_EVENT_TYPES,
  getGrowthEventDefinition,
  isGrowthEventType,
} from "@/lib/growth/events";

/**
 * MENTORSHIP_CHECK_IN must be a registered event type — otherwise
 * `emitGrowthEvent` treats it as unknown and silently no-ops, so a logged
 * check-in would never reach the durable timeline once Growth OS is enabled.
 */
describe("MENTORSHIP_CHECK_IN growth event", () => {
  it("is registered", () => {
    expect(GROWTH_EVENT_TYPES).toContain("MENTORSHIP_CHECK_IN");
    expect(isGrowthEventType("MENTORSHIP_CHECK_IN")).toBe(true);
  });

  it("maps to the MENTORSHIP track and dimension", () => {
    const def = getGrowthEventDefinition("MENTORSHIP_CHECK_IN");
    expect(def.track).toBe("MENTORSHIP");
    expect(def.category).toBe("MENTORSHIP");
    expect(def.countsAsExperience).toBe(false);
  });
});
