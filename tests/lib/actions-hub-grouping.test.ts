import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { groupActionsByDepartment } from "@/lib/people-strategy/actions-hub-grouping";

function item(partial: Partial<ActionItemWithRelations> & { id: string }): ActionItemWithRelations {
  return {
    title: "Task",
    status: "NOT_STARTED",
    priority: "MEDIUM",
    visibility: "ALL_LEADERSHIP",
    deadlineStart: new Date("2026-07-01"),
    deadlineEnd: null,
    leadId: "u1",
    departmentId: null,
    department: null,
    departmentLinks: [],
    lead: null,
    createdBy: null,
    assignments: [],
    comments: [],
    fileLinks: [],
    officerMeeting: null,
    officerMeetingId: null,
    mentorshipSession: null,
    mentorshipSessionId: null,
    ...partial,
  } as ActionItemWithRelations;
}

describe("groupActionsByDepartment", () => {
  it("groups and sorts departments in standing order", () => {
    const groups = groupActionsByDepartment(
      [
        item({
          id: "a",
          department: { id: "d-tech", name: "Tech", slug: "tech" },
          departmentId: "d-tech",
        }),
        item({
          id: "b",
          department: { id: "d-inst", name: "Instruction", slug: "instruction" },
          departmentId: "d-inst",
        }),
      ],
      new Date("2026-06-22")
    );

    expect(groups.map((g) => g.slug)).toEqual(["instruction", "tech"]);
    expect(groups[0]?.items).toHaveLength(1);
  });

  it("places multi-team actions in each linked group", () => {
    const shared = item({
      id: "shared",
      departmentId: "d-tech",
      department: { id: "d-tech", name: "Tech", slug: "tech" },
      departmentLinks: [
        { department: { id: "d-tech", name: "Tech", slug: "tech" } },
        { department: { id: "d-inst", name: "Instruction", slug: "instruction" } },
      ],
    });
    const groups = groupActionsByDepartment([shared], new Date("2026-06-22"));
    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.items.some((row) => row.id === "shared"))).toBe(true);
  });
});
