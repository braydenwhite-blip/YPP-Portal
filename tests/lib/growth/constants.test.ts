import { describe, expect, it } from "vitest";

import {
  GROWTH_TRACKS,
  GROWTH_ACTION_STATUSES,
  ACHIEVEMENT_CATEGORIES,
  OPPORTUNITY_KINDS,
  isGrowthTrack,
  isGrowthObjectiveStatus,
  isGrowthActionStatus,
  isAchievementCategory,
  isOpportunityKind,
  isOpportunityStatus,
  normalizeActionStatus,
  actionStatusIsComplete,
  actionStatusIsCountable,
  actionStatusIsOpen,
  clamp01,
  toPercent,
} from "@/lib/growth/constants";

describe("growth constants — validators", () => {
  it("validates track / status / category / kind vocabularies", () => {
    expect(isGrowthTrack("INSTRUCTOR")).toBe(true);
    expect(isGrowthTrack("NOPE")).toBe(false);
    expect(isGrowthTrack(42)).toBe(false);

    expect(isGrowthObjectiveStatus("ACHIEVED")).toBe(true);
    expect(isGrowthObjectiveStatus("DONE")).toBe(false);

    expect(isGrowthActionStatus("IN_PROGRESS")).toBe(true);
    expect(isGrowthActionStatus("ACTIVE")).toBe(false);

    expect(isAchievementCategory("CHAPTER")).toBe(true);
    expect(isAchievementCategory("chapter")).toBe(false);

    expect(isOpportunityKind("CLASS")).toBe(true);
    expect(isOpportunityKind("OTHER")).toBe(false);

    expect(isOpportunityStatus("DISMISSED")).toBe(true);
    expect(isOpportunityStatus("OPEN")).toBe(false);
  });

  it("exposes stable, non-empty vocabularies", () => {
    expect(GROWTH_TRACKS).toContain("STUDENT");
    expect(GROWTH_ACTION_STATUSES).toContain("BLOCKED");
    expect(ACHIEVEMENT_CATEGORIES).toContain("LEADERSHIP");
    expect(OPPORTUNITY_KINDS).toHaveLength(6);
  });
});

describe("growth constants — action status helpers", () => {
  it("normalizes unknown status to TODO", () => {
    expect(normalizeActionStatus("DONE")).toBe("DONE");
    expect(normalizeActionStatus("garbage")).toBe("TODO");
    expect(normalizeActionStatus(undefined)).toBe("TODO");
    expect(normalizeActionStatus(null)).toBe("TODO");
  });

  it("classifies complete / countable / open correctly", () => {
    expect(actionStatusIsComplete("DONE")).toBe(true);
    expect(actionStatusIsComplete("IN_PROGRESS")).toBe(false);

    // everything but DROPPED counts toward the denominator
    expect(actionStatusIsCountable("DROPPED")).toBe(false);
    expect(actionStatusIsCountable("BLOCKED")).toBe(true);
    expect(actionStatusIsCountable("DONE")).toBe(true);

    expect(actionStatusIsOpen("TODO")).toBe(true);
    expect(actionStatusIsOpen("IN_PROGRESS")).toBe(true);
    expect(actionStatusIsOpen("DONE")).toBe(false);
    expect(actionStatusIsOpen("BLOCKED")).toBe(false);
  });
});

describe("growth constants — math helpers", () => {
  it("clamps to 0..1 and guards non-finite", () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(NaN)).toBe(0);
  });

  it("renders integer percents", () => {
    expect(toPercent(0)).toBe(0);
    expect(toPercent(0.5)).toBe(50);
    expect(toPercent(1)).toBe(100);
    expect(toPercent(0.333)).toBe(33);
  });
});
