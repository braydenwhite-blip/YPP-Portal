import { describe, expect, it } from "vitest";

import {
  groupActionDepartments,
  sortActionDepartmentOptions,
  STANDING_ACTION_DEPARTMENTS,
} from "@/lib/people-strategy/action-departments";
import { ORG_DEPARTMENTS } from "@/lib/org/functions-departments";

describe("action-departments", () => {
  it("defines standing departments under Functions", () => {
    expect(STANDING_ACTION_DEPARTMENTS.map((d) => d.slug)).toEqual(
      ORG_DEPARTMENTS.map((d) => d.slug)
    );
    expect(STANDING_ACTION_DEPARTMENTS.map((d) => d.slug)).toContain("technology");
    expect(STANDING_ACTION_DEPARTMENTS.map((d) => d.slug)).toContain("fundraising");
    expect(STANDING_ACTION_DEPARTMENTS.map((d) => d.slug)).toContain("leadership");
  });

  it("sorts standing departments in catalog order", () => {
    const rows = [
      { id: "c", name: "Chapters", slug: "chapters" },
      { id: "t", name: "Technology", slug: "technology" },
      { id: "i", name: "Instruction", slug: "instruction" },
    ];

    expect(sortActionDepartmentOptions(rows).map((d) => d.slug)).toEqual([
      "instruction",
      "chapters",
      "technology",
    ]);
  });

  it("groups departments by Function for the picker UI", () => {
    const departments = sortActionDepartmentOptions(
      STANDING_ACTION_DEPARTMENTS.map((def, index) => ({
        id: `id-${index}`,
        name: def.name,
        slug: def.slug,
      }))
    );

    const groups = groupActionDepartments(departments);
    expect(groups.map((g) => g.key)).toEqual(["core-instruction", "operations"]);
    expect(groups.find((g) => g.key === "core-instruction")?.label).toBe(
      "Core Instruction"
    );
    expect(groups.find((g) => g.key === "operations")?.label).toBe("Operations");
    expect(
      groups.find((g) => g.key === "operations")?.items.map((d) => d.name)
    ).toEqual(["Technology", "Fundraising", "Communications", "Social Media"]);
  });
});
