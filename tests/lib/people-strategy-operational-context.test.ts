import { describe, expect, it } from "vitest";

import {
  areaForRelatedEntityType,
  compareOperationalHealth,
  computeOperationalHealth,
  normalizeRelatedEntityType,
  OPERATIONAL_AREA_VALUES,
  operationalAreaLabel,
  primaryEntityTypeForArea,
} from "@/lib/people-strategy/operational-context";

describe("operational area vocabulary", () => {
  it("exposes the canonical YPP areas and labels them", () => {
    expect(OPERATIONAL_AREA_VALUES).toContain("CLASSES");
    expect(OPERATIONAL_AREA_VALUES).toContain("MENTORSHIP");
    expect(operationalAreaLabel("CLASSES")).toBe("Classes");
    expect(operationalAreaLabel("PARTNERSHIPS")).toBe("Partnerships");
    // Unknown / empty falls back to "Other".
    expect(operationalAreaLabel(null)).toBe("Other");
    expect(operationalAreaLabel("WAT")).toBe("WAT");
  });
});

describe("area <-> related-entity bridge", () => {
  it("rolls each related-entity type up to an area", () => {
    expect(areaForRelatedEntityType("CLASS_OFFERING")).toBe("CLASSES");
    expect(areaForRelatedEntityType("MENTORSHIP")).toBe("MENTORSHIP");
    expect(areaForRelatedEntityType("INSTRUCTOR_APPLICATION")).toBe("APPLICATIONS");
    expect(areaForRelatedEntityType("PARTNER")).toBe("PARTNERSHIPS");
    // A person is cross-cutting → defaults to leadership/people ops.
    expect(areaForRelatedEntityType("USER")).toBe("LEADERSHIP");
  });

  it("maps an area back to its primary entity type, or null when none ships", () => {
    expect(primaryEntityTypeForArea("CLASSES")).toBe("CLASS_OFFERING");
    expect(primaryEntityTypeForArea("MENTORSHIP")).toBe("MENTORSHIP");
    expect(primaryEntityTypeForArea("APPLICATIONS")).toBe("INSTRUCTOR_APPLICATION");
    expect(primaryEntityTypeForArea("PARTNERSHIPS")).toBe("PARTNER");
    expect(primaryEntityTypeForArea("INSTRUCTORS")).toBe("USER");
    // Areas with no shipped polymorphic entity row.
    expect(primaryEntityTypeForArea("CHAPTERS")).toBeNull();
    expect(primaryEntityTypeForArea("FINANCE")).toBeNull();
    expect(primaryEntityTypeForArea("OTHER")).toBeNull();
  });
});

describe("normalizeRelatedEntityType", () => {
  it("accepts canonical values regardless of case", () => {
    expect(normalizeRelatedEntityType("CLASS_OFFERING")).toBe("CLASS_OFFERING");
    expect(normalizeRelatedEntityType("class_offering")).toBe("CLASS_OFFERING");
    expect(normalizeRelatedEntityType("  PARTNER ")).toBe("PARTNER");
  });

  it("resolves labels and synonyms", () => {
    expect(normalizeRelatedEntityType("Class")).toBe("CLASS_OFFERING");
    expect(normalizeRelatedEntityType("course")).toBe("CLASS_OFFERING");
    expect(normalizeRelatedEntityType("person")).toBe("USER");
    expect(normalizeRelatedEntityType("instructor")).toBe("USER");
    expect(normalizeRelatedEntityType("applicant")).toBe("INSTRUCTOR_APPLICATION");
    expect(normalizeRelatedEntityType("school")).toBe("PARTNER");
  });

  it("returns null for empty or unknown hints", () => {
    expect(normalizeRelatedEntityType(null)).toBeNull();
    expect(normalizeRelatedEntityType("")).toBeNull();
    expect(normalizeRelatedEntityType("nonsense")).toBeNull();
  });
});

describe("computeOperationalHealth", () => {
  it("is healthy with no signals", () => {
    const h = computeOperationalHealth({});
    expect(h.level).toBe("healthy");
    expect(h.label).toBe("Healthy");
    expect(h.tone).toBe("success");
    expect(h.score).toBe(100);
    expect(h.reasons).toEqual([]);
  });

  it("flags attention for plain open work", () => {
    const h = computeOperationalHealth({ openActions: 2, openFollowUps: 1 });
    expect(h.level).toBe("attention");
    expect(h.tone).toBe("info");
    expect(h.reasons).toContain("1 open follow-up");
    expect(h.reasons).toContain("2 open actions");
    expect(h.score).toBeLessThan(100);
  });

  it("flags attention for an unowned action even with nothing overdue", () => {
    const h = computeOperationalHealth({ openActions: 1, unassignedActions: 1 });
    expect(h.level).toBe("attention");
    expect(h.reasons).toContain("1 unassigned action");
  });

  it("flags at-risk for a single overdue item", () => {
    const h = computeOperationalHealth({ openActions: 4, overdueActions: 1 });
    expect(h.level).toBe("at_risk");
    expect(h.tone).toBe("warning");
    expect(h.reasons[0]).toBe("1 overdue action");
  });

  it("flags at-risk for stale work piling up", () => {
    expect(computeOperationalHealth({ staleActions: 3 }).level).toBe("at_risk");
    expect(computeOperationalHealth({ staleActions: 2 }).level).toBe("attention");
  });

  it("escalates to critical past the overdue threshold", () => {
    const h = computeOperationalHealth({ openActions: 5, overdueActions: 3 });
    expect(h.level).toBe("critical");
    expect(h.tone).toBe("overdue");
  });

  it("escalates to critical when overdue work is also stuck", () => {
    const h = computeOperationalHealth({ overdueActions: 1, blockedActions: 2 });
    expect(h.level).toBe("critical");
  });

  it("clamps the score to the 0–100 range", () => {
    const h = computeOperationalHealth({ overdueActions: 50, overdueFollowUps: 50 });
    expect(h.score).toBe(0);
    expect(h.level).toBe("critical");
  });

  it("treats negative inputs as zero (defensive)", () => {
    const h = computeOperationalHealth({ openActions: -5, overdueActions: -1 });
    expect(h.level).toBe("healthy");
    expect(h.score).toBe(100);
  });
});

describe("compareOperationalHealth", () => {
  it("orders worst-first by level then score", () => {
    const healthy = computeOperationalHealth({});
    const attention = computeOperationalHealth({ openActions: 1 });
    const critical = computeOperationalHealth({ overdueActions: 4 });
    const sorted = [healthy, critical, attention].sort(compareOperationalHealth);
    expect(sorted.map((h) => h.level)).toEqual(["critical", "attention", "healthy"]);
  });

  it("breaks ties within a level by score (lower score first)", () => {
    const lighter = computeOperationalHealth({ overdueActions: 1 });
    const heavier = computeOperationalHealth({ overdueActions: 2, blockedActions: 1 });
    const sorted = [lighter, heavier].sort(compareOperationalHealth);
    expect(sorted[0]).toBe(heavier);
  });
});
