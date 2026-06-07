import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import { relatedEntityRefKey } from "@/lib/people-strategy/action-queries";
import type { TrackerClass } from "@/lib/people-strategy/class-tracker";
import type {
  ActiveMentorshipSummary,
  MenteeSupport,
} from "@/lib/people-strategy/connections";
import {
  deriveClassSignals,
  deriveDepartmentSignals,
  deriveInstructorsWithoutMentor,
  deriveMentorshipsWithoutActions,
  deriveOfficerMeetingFollowUps,
  deriveOpenActions,
} from "@/lib/people-strategy/operations-hub";

const NOW = new Date("2026-06-07T12:00:00Z");
const PAST = new Date("2026-06-01T00:00:00Z");
const FUTURE = new Date("2026-07-01T00:00:00Z");

// Minimal action: derivations only read status + deadlines + id/title.
function action(
  overrides: Partial<ActionItemWithRelations> & { id: string }
): ActionItemWithRelations {
  return {
    title: `Action ${overrides.id}`,
    status: "NOT_STARTED",
    deadlineStart: FUTURE,
    deadlineEnd: null,
    ...overrides,
  } as unknown as ActionItemWithRelations;
}

function cls(id: string, title: string, instructorId: string): TrackerClass {
  return {
    id,
    title,
    instructor: { id: instructorId, name: `Lead ${instructorId}`, email: `${instructorId}@x.org` },
  } as unknown as TrackerClass;
}

describe("deriveClassSignals", () => {
  it("splits classes into overdue / open / no-plan and ignores settled-only", () => {
    const classes = [
      cls("c1", "Overdue class", "i1"),
      cls("c2", "Open class", "i2"),
      cls("c3", "No-plan class", "i3"),
      cls("c4", "Done class", "i4"),
    ];
    const byRef = new Map<string, ActionItemWithRelations[]>([
      [relatedEntityRefKey("CLASS_OFFERING", "c1"), [action({ id: "a1", status: "NOT_STARTED", deadlineStart: PAST })]],
      [relatedEntityRefKey("CLASS_OFFERING", "c2"), [action({ id: "a2", status: "IN_PROGRESS", deadlineStart: FUTURE })]],
      // c3 absent → no plan
      [relatedEntityRefKey("CLASS_OFFERING", "c4"), [action({ id: "a4", status: "COMPLETE", deadlineStart: PAST })]],
    ]);

    const signals = deriveClassSignals(classes, byRef, NOW);

    expect(signals.withOverdue.map((c) => c.id)).toEqual(["c1"]);
    expect(signals.withOverdue[0]).toMatchObject({ overdueCount: 1, openCount: 1 });
    expect(signals.withOpen.map((c) => c.id)).toEqual(["c2"]);
    expect(signals.withNoActions.map((c) => c.id)).toEqual(["c3"]);
    // c4 (settled only) is flagged in none of the buckets.
  });
});

describe("deriveMentorshipsWithoutActions", () => {
  const mentorships: ActiveMentorshipSummary[] = [
    { id: "m1", mentorId: "x", mentorName: "Mentor X", menteeId: "u1", menteeName: "Mentee 1" },
    { id: "m2", mentorId: "y", mentorName: "Mentor Y", menteeId: "u2", menteeName: "Mentee 2" },
  ];

  it("flags only mentorships with no linked actions, carrying the mentee id", () => {
    const byRef = new Map<string, ActionItemWithRelations[]>([
      [relatedEntityRefKey("MENTORSHIP", "m1"), [action({ id: "a1" })]],
      // m2 has none
    ]);
    const gaps = deriveMentorshipsWithoutActions(mentorships, byRef);
    expect(gaps).toEqual([
      { id: "m2", menteeId: "u2", mentorName: "Mentor Y", menteeName: "Mentee 2" },
    ]);
  });
});

describe("deriveInstructorsWithoutMentor", () => {
  it("returns deduped lead instructors lacking active mentor support", () => {
    const classes = [
      cls("c1", "Robotics", "i1"),
      cls("c2", "Painting", "i2"),
      cls("c3", "Robotics 2", "i1"), // same instructor → deduped
    ];
    const support = new Map<string, MenteeSupport>([
      [
        "i2",
        { mentorshipId: "m", mentor: { id: "mn", name: "M", email: "m@x" }, type: "INSTRUCTOR", status: "ACTIVE" },
      ],
    ]);
    const gaps = deriveInstructorsWithoutMentor(classes, support);
    expect(gaps).toEqual([{ id: "i1", name: "Lead i1", classTitle: "Robotics" }]);
  });
});

describe("deriveOpenActions", () => {
  it("drops settled actions, sorts by deadline, marks overdue, and limits", () => {
    const actions = [
      action({ id: "done", status: "COMPLETE", deadlineStart: PAST }),
      action({ id: "dropped", status: "DROPPED", deadlineStart: PAST }),
      action({ id: "future", status: "IN_PROGRESS", deadlineStart: FUTURE }),
      action({ id: "overdue", status: "NOT_STARTED", deadlineStart: PAST }),
    ];
    const rows = deriveOpenActions(actions, NOW, 8);
    expect(rows.map((r) => r.id)).toEqual(["overdue", "future"]);
    expect(rows[0]).toMatchObject({ id: "overdue", overdue: true, status: "OVERDUE" });
    expect(rows[1]).toMatchObject({ id: "future", overdue: false });
  });

  it("respects the limit", () => {
    const actions = Array.from({ length: 12 }, (_, i) =>
      action({ id: `a${i}`, status: "IN_PROGRESS", deadlineStart: FUTURE })
    );
    expect(deriveOpenActions(actions, NOW, 5)).toHaveLength(5);
  });
});

describe("deriveDepartmentSignals", () => {
  const dept = (id: string) => ({ id, name: `Dept ${id}`, slug: id });

  it("rolls up open/overdue per department and surfaces only those with overdue work", () => {
    const actions = [
      action({ id: "a1", status: "NOT_STARTED", deadlineStart: PAST, department: dept("d1") }),
      action({ id: "a2", status: "IN_PROGRESS", deadlineStart: FUTURE, department: dept("d1") }),
      action({ id: "a3", status: "IN_PROGRESS", deadlineStart: FUTURE, department: dept("d2") }),
      action({ id: "a4", status: "COMPLETE", deadlineStart: PAST, department: dept("d1") }),
      action({ id: "a5", status: "NOT_STARTED", deadlineStart: PAST, department: null }),
    ];

    // d1: 1 overdue + 1 open (settled a4 ignored); d2: open-only → not surfaced;
    // a5 (no department) is ignored.
    expect(deriveDepartmentSignals(actions, NOW)).toEqual([
      { id: "d1", name: "Dept d1", openCount: 2, overdueCount: 1 },
    ]);
  });
});

describe("deriveOfficerMeetingFollowUps", () => {
  it("flags past meetings with open items, counts overdue, drops settled, sorts worst first", () => {
    const meetings = [
      {
        id: "m1",
        date: new Date("2026-06-01T00:00:00Z"),
        actionItems: [
          { status: "NOT_STARTED" as const, deadlineStart: PAST, deadlineEnd: null },
          { status: "IN_PROGRESS" as const, deadlineStart: FUTURE, deadlineEnd: null },
        ],
      },
      {
        id: "m2",
        date: new Date("2026-06-02T00:00:00Z"),
        actionItems: [
          { status: "IN_PROGRESS" as const, deadlineStart: FUTURE, deadlineEnd: null },
        ],
      },
      {
        id: "m3",
        date: new Date("2026-06-03T00:00:00Z"),
        actionItems: [
          { status: "COMPLETE" as const, deadlineStart: PAST, deadlineEnd: null },
        ],
      },
    ];

    const rows = deriveOfficerMeetingFollowUps(meetings, NOW);
    // m3 (all settled) drops out; m1 (1 overdue) sorts before m2 (0 overdue).
    expect(rows.map((r) => r.id)).toEqual(["m1", "m2"]);
    expect(rows[0]).toMatchObject({ id: "m1", openCount: 2, overdueCount: 1 });
    expect(rows[1]).toMatchObject({ id: "m2", openCount: 1, overdueCount: 0 });
  });
});
