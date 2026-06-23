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
});
