import { describe, expect, it } from "vitest";

import {
  GROWTH_EVENT_TYPES,
  GROWTH_EVENT_DEFINITIONS,
  isGrowthEventType,
  getGrowthEventDefinition,
  growthEventTrack,
  defaultGrowthEventTitle,
  tallyEventCounts,
} from "@/lib/growth/events";
import { isGrowthTrack, isAchievementCategory } from "@/lib/growth/constants";

describe("growth events — registry integrity", () => {
  it("every event type has a complete, valid definition", () => {
    for (const type of GROWTH_EVENT_TYPES) {
      const def = GROWTH_EVENT_DEFINITIONS[type];
      expect(def).toBeDefined();
      expect(def.type).toBe(type);
      expect(isGrowthTrack(def.track)).toBe(true);
      expect(def.category === null || isAchievementCategory(def.category)).toBe(true);
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.defaultTitle.length).toBeGreaterThan(0);
      expect(typeof def.countsAsExperience).toBe("boolean");
    }
  });

  it("has no duplicate event types", () => {
    expect(new Set(GROWTH_EVENT_TYPES).size).toBe(GROWTH_EVENT_TYPES.length);
  });
});

describe("growth events — helpers", () => {
  it("validates event types", () => {
    expect(isGrowthEventType("MENTOR_MATCHED")).toBe(true);
    expect(isGrowthEventType("UNKNOWN")).toBe(false);
    expect(isGrowthEventType(undefined)).toBe(false);
  });

  it("resolves track + default title from the registry", () => {
    expect(growthEventTrack("CLASS_PUBLISHED")).toBe("INSTRUCTOR");
    expect(growthEventTrack("CHAPTER_JOINED")).toBe("CHAPTER");
    expect(defaultGrowthEventTitle("MENTOR_MATCHED")).toBe("Matched with a mentor");
    expect(getGrowthEventDefinition("CERTIFICATE_EARNED").category).toBe("IMPACT");
  });
});

describe("growth events — tallyEventCounts", () => {
  it("tallies known types and ignores unknown ones", () => {
    const counts = tallyEventCounts([
      "CLASS_PUBLISHED",
      "CLASS_PUBLISHED",
      "MENTOR_MATCHED",
      "TOTALLY_BOGUS",
    ]);
    expect(counts.CLASS_PUBLISHED).toBe(2);
    expect(counts.MENTOR_MATCHED).toBe(1);
    expect(Object.keys(counts)).toHaveLength(2);
  });

  it("returns an empty map for no events", () => {
    expect(tallyEventCounts([])).toEqual({});
  });
});
