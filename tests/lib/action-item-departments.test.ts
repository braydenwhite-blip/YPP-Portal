import { describe, expect, it } from "vitest";

import {
  actionItemDepartmentIds,
  actionItemDepartments,
  normalizeActionDepartmentIds,
  primaryActionDepartmentId,
} from "@/lib/people-strategy/action-item-departments";

describe("action-item-departments", () => {
  it("prefers junction rows over the legacy department FK", () => {
    const item = {
      departmentId: "legacy",
      department: { id: "legacy", name: "Legacy", slug: "legacy" },
      departmentLinks: [
        { department: { id: "d1", name: "Tech", slug: "tech" } },
        { department: { id: "d2", name: "Comms", slug: "communications" } },
      ],
    };

    expect(actionItemDepartmentIds(item)).toEqual(["d1", "d2"]);
    expect(actionItemDepartments(item).map((dept) => dept.name)).toEqual(["Tech", "Comms"]);
  });

  it("normalizes create/update department input", () => {
    expect(
      normalizeActionDepartmentIds({
        departmentIds: ["d2", "d1", "d2"],
        departmentId: "ignored-when-array-present",
      })
    ).toEqual(["d2", "d1"]);
    expect(primaryActionDepartmentId(["d2", "d1"])).toBe("d2");
  });
});
