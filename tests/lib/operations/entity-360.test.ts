import { describe, expect, it } from "vitest";

import {
  buildPersonTimeline,
  entityInitials,
  isEntity360Type,
  meetingOutcomeLine,
  nextStepFromWork,
  personFootnote,
  tenureLabel,
} from "@/lib/operations/entity-360";
import { workItemFromAction } from "@/lib/operations/work-items";
import type { ActionLite } from "@/lib/people-strategy/operational-digest";

describe("entityInitials", () => {
  it("takes the first and last word initials", () => {
    expect(entityInitials("Brayden Kim")).toBe("BK");
    expect(entityInitials("Maya Anne Johnson")).toBe("MJ");
  });

  it("handles single words, punctuation, and empty input", () => {
    expect(entityInitials("Mohawk")).toBe("MO");
    expect(entityInitials("Beth El Day Camp")).toBe("BC");
    expect(entityInitials("")).toBe("•");
  });
});

describe("tenureLabel", () => {
  it("reads months, then years", () => {
    expect(tenureLabel(0)).toBe("Active · new");
    expect(tenureLabel(1)).toBe("Active · 1 month");
    expect(tenureLabel(8)).toBe("Active · 8 months");
    expect(tenureLabel(12)).toBe("Active · 1 year+");
    expect(tenureLabel(30)).toBe("Active · 2 years+");
  });
});

describe("personFootnote", () => {
  it("tells each audience what they are seeing", () => {
    expect(personFootnote(false)).toBe(
      "Public view · performance data visible to leadership only"
    );
    expect(personFootnote(true)).toContain("Leadership view");
  });
});

describe("meetingOutcomeLine", () => {
  it("summarises only what happened", () => {
    expect(
      meetingOutcomeLine({ decisionCount: 2, linkedActionCount: 1, openFollowUps: 3 })
    ).toBe("2 decisions · 1 action · 3 open follow-ups");
    expect(
      meetingOutcomeLine({ decisionCount: 0, linkedActionCount: 0, openFollowUps: 0 })
    ).toBeNull();
  });
});

describe("isEntity360Type", () => {
  it("accepts the six drawer types and rejects everything else", () => {
    for (const t of ["person", "class", "partner", "initiative", "meeting", "action"]) {
      expect(isEntity360Type(t)).toBe(true);
    }
    expect(isEntity360Type("chapter")).toBe(false);
    expect(isEntity360Type(42)).toBe(false);
    expect(isEntity360Type(null)).toBe(false);
  });
});

function lite(overrides: Partial<ActionLite> = {}): ActionLite {
  return {
    id: "a1",
    title: "Ship the curriculum",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    dueISO: "2026-06-20T00:00:00.000Z",
    ownerName: null,
    overdue: false,
    daysOverdue: 0,
    blocked: false,
    unassigned: false,
    relatedType: null,
    relatedId: null,
    relatedLabel: null,
    relatedTypeLabel: null,
    sourceMeetingId: null,
    sourceMeetingTitle: null,
    sourceMeetingStartISO: null,
    latestUpdate: null,
    nextStep: null,
    contextSummary: null,
    href: "/actions/a1",
    ...overrides,
  };
}

describe("nextStepFromWork", () => {
  it("picks the earliest-due open item and skips completed work", () => {
    const items = [
      workItemFromAction(lite({ id: "late", title: "Later", dueISO: "2026-07-01T00:00:00.000Z" })),
      workItemFromAction(
        lite({ id: "done", title: "Done", status: "COMPLETE", completedISO: "2026-06-01T00:00:00.000Z" })
      ),
      workItemFromAction(lite({ id: "soon", title: "Soonest", dueISO: "2026-06-12T00:00:00.000Z" })),
    ];
    expect(nextStepFromWork(items)).toBe("Soonest");
    expect(nextStepFromWork([])).toBeNull();
  });
});

describe("buildPersonTimeline", () => {
  it("tells the involvement story newest-first", () => {
    const events = buildPersonTimeline({
      joinedAt: "2025-09-01T00:00:00.000Z",
      mentors: [{ id: "m1", name: "Ian Chen", startedAt: "2025-10-01T00:00:00.000Z" }],
      mentees: [{ id: "m2", name: "Tyler Park", startedAt: "2026-02-01T00:00:00.000Z" }],
      classesTaught: [
        { id: "c1", title: "Intro to Entrepreneurship", startedAt: "2026-01-15T00:00:00.000Z" },
      ],
      completedActions: [
        {
          id: "a1",
          title: "Finalize interview materials",
          completedAt: "2026-05-01T00:00:00.000Z",
          href: "/actions/a1",
        },
      ],
      roles: [{ id: "r1", title: "Student Advisor", startedAt: "2026-03-01T00:00:00.000Z" }],
    });
    expect(events.map((e) => e.kind)).toEqual([
      "action_completed",
      "role",
      "mentorship",
      "class_assigned",
      "mentorship",
      "joined",
    ]);
    expect(events.at(-1)?.title).toBe("Joined YPP");
    expect(events.find((e) => e.kind === "role")?.title).toBe("Student Advisor");
    expect(events.find((e) => e.id === "person:mentee:m2")?.title).toBe(
      "Became mentor to Tyler Park"
    );
    expect(events.find((e) => e.id === "person:mentor:m1")?.title).toBe(
      "Paired with mentor Ian Chen"
    );
  });

  it("honours the limit, keeping the newest events", () => {
    const events = buildPersonTimeline(
      {
        joinedAt: "2025-09-01T00:00:00.000Z",
        mentors: [],
        mentees: [],
        classesTaught: [],
        completedActions: [
          { id: "a1", title: "New", completedAt: "2026-06-01T00:00:00.000Z", href: "/a" },
        ],
        roles: [],
      },
      { limit: 1 }
    );
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe("New");
  });
});
