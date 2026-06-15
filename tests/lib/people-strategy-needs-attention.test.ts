import { describe, expect, it } from "vitest";

import { computeProvisionalStatus } from "@/lib/people-strategy/provisional";
import {
  actionAttention,
  classAttention,
  computeNeedsAttention,
  escalationAttention,
  filterAttentionForViewer,
  meetingAttention,
  mentorAttention,
  peopleAttention,
  summarizeAttention,
  type AttentionAction,
  type AttentionPerson,
} from "@/lib/people-strategy/needs-attention";

const NOW = new Date("2026-06-15T12:00:00Z");
const DAY = 86_400_000;
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

function action(overrides: Partial<AttentionAction> = {}): AttentionAction {
  return {
    id: "a",
    title: "Action",
    status: "IN_PROGRESS",
    deadlineStart: days(30),
    deadlineEnd: null,
    flaggedAt: null,
    resolvedAt: null,
    updatedAt: NOW,
    hasOwner: true,
    officersOnly: false,
    ...overrides,
  };
}

function person(overrides: Partial<AttentionPerson> = {}): AttentionPerson {
  return {
    id: "p",
    name: "Person",
    expectsMentor: false,
    hasMentor: true,
    mentorshipStartDate: null,
    kickoffCompleted: true,
    lastCheckInAt: NOW,
    quarterlyReviewDueAt: null,
    hasCurrentQuarterReview: true,
    provisional: null,
    activeActionCount: 0,
    pendingMentorRecommendations: 0,
    ...overrides,
  };
}

const categories = (items: { category: string }[]) => items.map((i) => i.category);

describe("actionAttention", () => {
  it("flags an overdue action as critical", () => {
    const items = actionAttention([action({ deadlineStart: days(-5) })], NOW);
    expect(categories(items)).toEqual(["ACTION_OVERDUE"]);
    expect(items[0].severity).toBe("critical");
    expect(items[0].daysDelta).toBe(-5);
  });

  it("treats OVERDUE status as overdue even with a future deadline", () => {
    const items = actionAttention([action({ status: "OVERDUE" })], NOW);
    expect(categories(items)).toEqual(["ACTION_OVERDUE"]);
  });

  it("flags due-soon, blocked, stale and missing-owner", () => {
    expect(categories(actionAttention([action({ deadlineStart: days(2) })], NOW))).toEqual([
      "ACTION_DUE_SOON",
    ]);
    expect(categories(actionAttention([action({ status: "BLOCKED" })], NOW))).toEqual([
      "ACTION_BLOCKED",
    ]);
    expect(categories(actionAttention([action({ flaggedAt: days(-2) })], NOW))).toEqual([
      "ACTION_BLOCKED",
    ]);
    expect(categories(actionAttention([action({ updatedAt: days(-20) })], NOW))).toEqual([
      "ACTION_STALE",
    ]);
    expect(categories(actionAttention([action({ hasOwner: false })], NOW))).toEqual([
      "ACTION_MISSING_OWNER",
    ]);
  });

  it("never raises attention for settled or resolved actions", () => {
    expect(actionAttention([action({ status: "COMPLETE", deadlineStart: days(-5) })], NOW)).toEqual(
      []
    );
    expect(actionAttention([action({ status: "DROPPED", deadlineStart: days(-5) })], NOW)).toEqual(
      []
    );
    expect(actionAttention([action({ resolvedAt: NOW, deadlineStart: days(-5) })], NOW)).toEqual([]);
  });

  it("marks OFFICERS_ONLY action signals confidential", () => {
    const items = actionAttention([action({ deadlineStart: days(-1), officersOnly: true })], NOW);
    expect(items[0].confidential).toBe(true);
  });
});

describe("peopleAttention", () => {
  it("flags a member with no mentor", () => {
    const items = peopleAttention([person({ expectsMentor: true, hasMentor: false })], NOW);
    expect(categories(items)).toContain("MISSING_MENTOR");
  });

  it("flags an overdue mentor kickoff (start older than 2 weeks)", () => {
    const items = peopleAttention(
      [person({ hasMentor: true, kickoffCompleted: false, mentorshipStartDate: days(-20) })],
      NOW
    );
    expect(categories(items)).toContain("MENTOR_KICKOFF_OVERDUE");
  });

  it("does NOT flag kickoff still inside the 2-week window", () => {
    const items = peopleAttention(
      [person({ hasMentor: true, kickoffCompleted: false, mentorshipStartDate: days(-5) })],
      NOW
    );
    expect(categories(items)).not.toContain("MENTOR_KICKOFF_OVERDUE");
  });

  it("flags an overdue monthly check-in and a missing one", () => {
    expect(
      categories(peopleAttention([person({ lastCheckInAt: days(-40) })], NOW))
    ).toContain("CHECK_IN_OVERDUE");
    expect(
      categories(peopleAttention([person({ hasMentor: true, lastCheckInAt: null })], NOW))
    ).toContain("CHECK_IN_OVERDUE");
  });

  it("flags provisional decision due and overdue from the clock", () => {
    const dueSoon = computeProvisionalStatus(days(-80), null, NOW); // 10 days remaining
    expect(categories(peopleAttention([person({ provisional: dueSoon })], NOW))).toContain(
      "PROVISIONAL_DECISION_DUE"
    );

    const overdue = computeProvisionalStatus(days(-100), null, NOW); // past month 3
    expect(categories(peopleAttention([person({ provisional: overdue })], NOW))).toContain(
      "PROVISIONAL_DECISION_OVERDUE"
    );
  });

  it("does NOT flag a provisional decision well before month 3", () => {
    const early = computeProvisionalStatus(days(-10), null, NOW); // ~80 days remaining
    const cats = categories(peopleAttention([person({ provisional: early })], NOW));
    expect(cats).not.toContain("PROVISIONAL_DECISION_DUE");
    expect(cats).not.toContain("PROVISIONAL_DECISION_OVERDUE");
  });

  it("flags pending mentor recommendations, high workload, and quarterly review due", () => {
    expect(
      categories(peopleAttention([person({ pendingMentorRecommendations: 2 })], NOW))
    ).toContain("PENDING_MENTOR_RECOMMENDATION");
    expect(categories(peopleAttention([person({ activeActionCount: 6 })], NOW))).toContain(
      "HIGH_WORKLOAD"
    );
    expect(
      categories(
        peopleAttention(
          [person({ quarterlyReviewDueAt: days(-2), hasCurrentQuarterReview: false })],
          NOW
        )
      )
    ).toContain("QUARTERLY_REVIEW_DUE");
  });

  it("a fully healthy person yields no signals", () => {
    expect(peopleAttention([person()], NOW)).toEqual([]);
  });

  it("marks all person signals confidential", () => {
    const items = peopleAttention([person({ expectsMentor: true, hasMentor: false })], NOW);
    expect(items.every((i) => i.confidential)).toBe(true);
  });
});

describe("mentor / meeting / class / escalation builders", () => {
  it("flags mentor overload above capacity", () => {
    expect(
      categories(mentorAttention([{ id: "m", name: "Mentor", activeMenteeCount: 7 }]))
    ).toEqual(["MENTOR_OVERLOAD"]);
    expect(mentorAttention([{ id: "m", name: "Mentor", activeMenteeCount: 3 }])).toEqual([]);
  });

  it("flags meeting agenda/notes gaps and deferred items", () => {
    expect(
      categories(
        meetingAttention(
          [
            {
              id: "up",
              title: "Upcoming",
              date: days(3),
              status: "SCHEDULED",
              hasAgenda: false,
              hasNotes: false,
              deferredItemCount: 0,
            },
          ],
          NOW
        )
      )
    ).toEqual(["MEETING_MISSING_AGENDA"]);

    expect(
      categories(
        meetingAttention(
          [
            {
              id: "held",
              title: "Held",
              date: days(-3),
              status: "COMPLETED",
              hasAgenda: true,
              hasNotes: false,
              deferredItemCount: 2,
            },
          ],
          NOW
        )
      )
    ).toEqual(["MEETING_MISSING_NOTES", "MEETING_DEFERRED_ITEM"]);
  });

  it("flags classes missing instructors or carrying a blocker", () => {
    expect(
      categories(
        classAttention([
          { id: "c1", name: "Algebra", hasLeadInstructor: false, hasExecutingInstructor: false, hasBlocker: false },
        ])
      )
    ).toEqual(["CLASS_MISSING_INSTRUCTOR"]);

    expect(
      categories(
        classAttention([
          { id: "c2", name: "Bio", hasLeadInstructor: true, hasExecutingInstructor: false, hasBlocker: true, blockerReason: "No room booked" },
        ])
      )
    ).toEqual(["CLASS_MISSING_INSTRUCTOR", "CLASS_BLOCKER"]);
  });

  it("flags escalations awaiting review as confidential criticals", () => {
    const items = escalationAttention([
      { id: "e1", title: "Stuck item", ageLabel: "3 days", awaitingBoard: true },
    ]);
    expect(items[0].category).toBe("ESCALATION_AWAITING_REVIEW");
    expect(items[0].severity).toBe("critical");
    expect(items[0].confidential).toBe(true);
    expect(items[0].reason).toContain("Board");
  });
});

describe("computeNeedsAttention composition", () => {
  it("merges domains and sorts by severity (critical first)", () => {
    const items = computeNeedsAttention(
      {
        actions: [action({ id: "od", deadlineStart: days(-5) })],
        people: [person({ id: "nomentor", expectsMentor: true, hasMentor: false })],
        classes: [
          { id: "c", name: "Class", hasLeadInstructor: true, hasExecutingInstructor: false, hasBlocker: false },
        ],
      },
      NOW
    );
    expect(items[0].severity).toBe("critical");
    expect(items[0].category).toBe("ACTION_OVERDUE");
    // severity is non-decreasing across the sorted list
    const ranks = items.map((i) => ["critical", "high", "medium", "low"].indexOf(i.severity));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("filters confidential signals out for a normal member view", () => {
    const items = computeNeedsAttention(
      {
        actions: [action({ id: "od", deadlineStart: days(-5) })],
        people: [person({ id: "nomentor", expectsMentor: true, hasMentor: false })],
      },
      NOW
    );
    const memberView = filterAttentionForViewer(items, { canSeeConfidential: false });
    expect(memberView.every((i) => !i.confidential)).toBe(true);
    expect(categories(memberView)).toContain("ACTION_OVERDUE");
    expect(categories(memberView)).not.toContain("MISSING_MENTOR");

    const leaderView = filterAttentionForViewer(items, { canSeeConfidential: true });
    expect(categories(leaderView)).toContain("MISSING_MENTOR");
  });

  it("summarizes counts by severity and category", () => {
    const items = computeNeedsAttention(
      {
        actions: [
          action({ id: "od", deadlineStart: days(-5) }),
          action({ id: "soon", deadlineStart: days(1) }),
        ],
      },
      NOW
    );
    const summary = summarizeAttention(items);
    expect(summary.total).toBe(2);
    expect(summary.bySeverity.critical).toBe(1);
    expect(summary.bySeverity.medium).toBe(1);
    expect(summary.byCategory.ACTION_OVERDUE).toBe(1);
    expect(summary.byCategory.ACTION_DUE_SOON).toBe(1);
  });
});
