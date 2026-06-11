import { describe, expect, it } from "vitest";
import { LeadershipRoleCategory } from "@prisma/client";

import {
  ADVISING_STATUS_META,
  CONTRIBUTION_STATUS_META,
  LEAD_EXAMPLE_CATEGORIES,
  LEADERSHIP_ROLE_CATALOG,
  LEADERSHIP_ROLE_CATEGORIES,
  SENIOR_EXAMPLE_CATEGORIES,
} from "@/lib/leadership/constants";

describe("leadership role catalog", () => {
  it("defines every LeadershipRoleCategory enum value exactly once", () => {
    const enumValues = Object.values(LeadershipRoleCategory);
    expect(LEADERSHIP_ROLE_CATEGORIES.sort()).toEqual([...enumValues].sort());
    for (const category of enumValues) {
      expect(LEADERSHIP_ROLE_CATALOG[category].category).toBe(category);
    }
  });

  it("keeps every definition labeled, described, and weighted 1-3", () => {
    for (const definition of Object.values(LEADERSHIP_ROLE_CATALOG)) {
      expect(definition.label.length).toBeGreaterThan(0);
      expect(definition.description.length).toBeGreaterThan(0);
      expect(definition.defaultWeight).toBeGreaterThanOrEqual(1);
      expect(definition.defaultWeight).toBeLessThanOrEqual(3);
    }
  });

  it("marks every Lead-example category as an ownership role with weight 3", () => {
    for (const category of LEAD_EXAMPLE_CATEGORIES) {
      const definition = LEADERSHIP_ROLE_CATALOG[category];
      expect(definition.isOwnership).toBe(true);
      expect(definition.defaultWeight).toBe(3);
      expect(definition.defaultLevel).toBe("LEAD_INSTRUCTOR");
    }
  });

  it("keeps Senior-example categories as meaningful (weight >= 2) support roles", () => {
    for (const category of SENIOR_EXAMPLE_CATEGORIES) {
      const definition = LEADERSHIP_ROLE_CATALOG[category];
      expect(definition.isOwnership).toBe(false);
      expect(definition.defaultWeight).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes Student Advisor as a Senior-level example with meaningful weight", () => {
    expect(SENIOR_EXAMPLE_CATEGORIES).toContain("STUDENT_ADVISOR");
    expect(LEADERSHIP_ROLE_CATALOG.STUDENT_ADVISOR.defaultWeight).toBe(2);
  });

  it("provides display metadata for every contribution and advising status", () => {
    expect(Object.keys(CONTRIBUTION_STATUS_META).sort()).toEqual(
      ["ACTIVE", "ASSIGNED", "COMPLETED", "NEEDS_ATTENTION", "PAUSED", "SUGGESTED"].sort(),
    );
    expect(Object.keys(ADVISING_STATUS_META).sort()).toEqual(
      ["ENGAGED", "INACTIVE", "NEEDS_ATTENTION", "READY_FOR_NEXT"].sort(),
    );
  });
});
