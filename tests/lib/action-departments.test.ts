import { describe, expect, it } from "vitest";

import {
  groupActionDepartments,
  sortActionDepartmentOptions,
  STANDING_ACTION_DEPARTMENTS,
} from "@/lib/people-strategy/action-departments";

describe("action-departments", () => {
  it("sorts standing departments in catalog order", () => {
    const rows = [
      { id: "b", name: "Board", slug: "board" },
      { id: "t", name: "Tech", slug: "tech" },
      { id: "i", name: "Instruction", slug: "instruction" },
    ];

    expect(sortActionDepartmentOptions(rows).map((d) => d.slug)).toEqual([
      "instruction",
      "tech",
      "board",
    ]);
  });

  it("groups departments for the picker UI", () => {
    const departments = sortActionDepartmentOptions(
      STANDING_ACTION_DEPARTMENTS.map((def, index) => ({
        id: `id-${index}`,
        name: def.name,
        slug: def.slug,
      }))
    );

    const groups = groupActionDepartments(departments);
    expect(groups.map((g) => g.key)).toEqual(["core", "org", "leadership"]);
    expect(groups.find((g) => g.key === "org")?.items.map((d) => d.name)).toContain("Chapters");
    expect(groups.find((g) => g.key === "leadership")?.items.map((d) => d.name)).toEqual([
      "Officers",
      "Board",
    ]);
  });
});
