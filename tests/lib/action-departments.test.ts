import { describe, expect, it } from "vitest";

import {
  groupActionDepartments,
  sortActionDepartmentOptions,
  STANDING_ACTION_DEPARTMENTS,
} from "@/lib/people-strategy/action-departments";

describe("action-departments", () => {
  it("defines exactly five standing teams", () => {
    expect(STANDING_ACTION_DEPARTMENTS).toHaveLength(5);
    expect(STANDING_ACTION_DEPARTMENTS.map((d) => d.slug)).toEqual([
      "instruction",
      "chapters",
      "tech",
      "communications",
      "social-media",
    ]);
  });

  it("sorts standing departments in catalog order", () => {
    const rows = [
      { id: "c", name: "Chapters", slug: "chapters" },
      { id: "t", name: "Tech", slug: "tech" },
      { id: "i", name: "Instruction", slug: "instruction" },
    ];

    expect(sortActionDepartmentOptions(rows).map((d) => d.slug)).toEqual([
      "instruction",
      "chapters",
      "tech",
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
    expect(groups.map((g) => g.key)).toEqual(["core", "org"]);
    expect(groups.find((g) => g.key === "core")?.items.map((d) => d.name)).toEqual([
      "Instruction",
      "Chapters",
    ]);
    expect(groups.find((g) => g.key === "org")?.items.map((d) => d.name)).toEqual([
      "Tech",
      "Communications",
      "Social Media",
    ]);
  });
});
