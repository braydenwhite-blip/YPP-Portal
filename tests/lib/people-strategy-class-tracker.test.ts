import { describe, expect, it } from "vitest";

import type { TrackerClass } from "@/lib/people-strategy/class-tracker";
import {
  executingInstructors,
  formatClassDateRange,
  formatClassSchedule,
} from "@/lib/people-strategy/class-tracker";

function instructor(id: string, name: string | null = id) {
  return { id, name, email: `${id}@x.org` };
}

function assignment(
  instr: ReturnType<typeof instructor>,
  role: TrackerClass["regularInstructorAssignments"][number]["role"]
): TrackerClass["regularInstructorAssignments"][number] {
  return {
    id: `${instr.id}-${role}`,
    role,
    status: "FULLY_CONFIRMED",
    instructor: instr,
  };
}

function offering(overrides: Partial<TrackerClass> = {}): TrackerClass {
  return {
    id: "c1",
    title: "Intro to Robotics",
    startDate: new Date("2026-06-10T16:00:00Z"),
    endDate: new Date("2026-08-01T18:00:00Z"),
    meetingDays: ["Monday", "Wednesday"],
    meetingTime: "16:00-18:00",
    timezone: "America/New_York",
    deliveryMode: "VIRTUAL",
    status: "PUBLISHED",
    chapter: { id: "ch1", name: "Boston" },
    instructor: instructor("lead", "Lead Person"),
    regularInstructorAssignments: [],
    ...overrides,
  } as TrackerClass;
}

describe("formatClassSchedule", () => {
  it("abbreviates days and appends the meeting time", () => {
    expect(formatClassSchedule(offering())).toBe("Mon/Wed 16:00-18:00");
  });

  it("handles a class with no meeting days", () => {
    expect(formatClassSchedule(offering({ meetingDays: [], meetingTime: "10:00-11:00" }))).toBe(
      "10:00-11:00"
    );
  });
});

describe("formatClassDateRange", () => {
  it("renders a start – end range", () => {
    expect(formatClassDateRange(offering())).toContain("–");
  });
});

describe("executingInstructors", () => {
  it("lists active assignment instructors with their role", () => {
    const co = instructor("co", "Co Person");
    const asst = instructor("asst", "Assistant Person");
    const out = executingInstructors(
      offering({
        regularInstructorAssignments: [
          assignment(co, "CO_INSTRUCTOR"),
          assignment(asst, "ASSISTANT"),
        ],
      })
    );
    expect(out).toEqual([
      { id: "co", name: "Co Person", role: "CO_INSTRUCTOR" },
      { id: "asst", name: "Assistant Person", role: "ASSISTANT" },
    ]);
  });

  it("does not duplicate the primary lead when they also hold a LEAD assignment", () => {
    const lead = instructor("lead", "Lead Person");
    const out = executingInstructors(
      offering({
        instructor: lead,
        regularInstructorAssignments: [assignment(lead, "LEAD")],
      })
    );
    expect(out).toEqual([]);
  });

  it("keeps a different person's LEAD assignment (co-lead)", () => {
    const coLead = instructor("colead", "Co Lead");
    const out = executingInstructors(
      offering({ regularInstructorAssignments: [assignment(coLead, "LEAD")] })
    );
    expect(out).toEqual([{ id: "colead", name: "Co Lead", role: "LEAD" }]);
  });
});
