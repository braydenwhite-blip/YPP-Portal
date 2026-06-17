import { describe, expect, it } from "vitest";

import {
  deriveMentorshipAttention,
  deriveMentorshipNextStep,
  mergeMentorshipActionFacts,
  summarizeMentorshipActionFacts,
  MENTORSHIP_ATTENTION_THRESHOLDS,
  type CanonicalActionRow,
  type LegacyActionRow,
  type MentorshipActionFact,
  type MentorshipAttentionFacts,
  type MentorshipCheckInFact,
} from "@/lib/mentorship/attention";

/** Noon on a fixed day, so start/end-of-day math is unambiguous. */
const NOW = new Date("2026-06-17T12:00:00.000Z");
const HREF = "/mentorship/mentees/m1";

function daysFromNow(days: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return d;
}

function action(overrides: Partial<MentorshipActionFact> = {}): MentorshipActionFact {
  return {
    id: "a1",
    title: "Draft the plan",
    status: "NOT_STARTED",
    dueAt: null,
    mentorshipSessionId: null,
    legacy: false,
    ...overrides,
  };
}

function checkIn(overrides: Partial<MentorshipCheckInFact> = {}): MentorshipCheckInFact {
  return {
    id: "s1",
    scheduledAt: daysFromNow(7),
    completedAt: null,
    cancelledAt: null,
    ...overrides,
  };
}

function facts(overrides: Partial<MentorshipAttentionFacts> = {}): MentorshipAttentionFacts {
  return {
    mentorshipId: "m1",
    menteeId: "u-mentee",
    menteeName: "Sam Mentee",
    mentorName: "Morgan Mentor",
    status: "ACTIVE",
    openActions: [],
    checkIns: [],
    reviewDue: null,
    workspaceHref: HREF,
    ...overrides,
  };
}

describe("deriveMentorshipNextStep — locked ordering", () => {
  it("1. selects an overdue action first, above everything else", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [
          action({ id: "overdue", dueAt: daysFromNow(-2) }),
          action({ id: "blocked", status: "BLOCKED" }),
          action({ id: "soon", dueAt: daysFromNow(1) }),
        ],
        checkIns: [checkIn({ scheduledAt: daysFromNow(2) })],
        reviewDue: { kind: "REVIEW", dueAt: NOW },
      }),
      NOW
    );
    expect(step.type).toBe("OVERDUE_ACTION");
    expect(step.relatedId).toBe("overdue");
    expect(step.severity).toBe("critical");
  });

  it("2. selects a blocked action when no overdue action exists", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [
          action({ id: "blocked", status: "BLOCKED" }),
          action({ id: "soon", dueAt: daysFromNow(1) }),
        ],
        checkIns: [checkIn({ scheduledAt: daysFromNow(2) })],
        reviewDue: { kind: "REVIEW", dueAt: NOW },
      }),
      NOW
    );
    expect(step.type).toBe("BLOCKED_ACTION");
    expect(step.relatedId).toBe("blocked");
  });

  it("3. selects a due-soon action next", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [action({ id: "soon", dueAt: daysFromNow(1) })],
        checkIns: [checkIn({ scheduledAt: daysFromNow(2) })],
        reviewDue: { kind: "REVIEW", dueAt: NOW },
      }),
      NOW
    );
    expect(step.type).toBe("ACTION_DUE_SOON");
    expect(step.relatedId).toBe("soon");
  });

  it("4. selects missing next check-in next (no upcoming, cadence lapsed)", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [action({ dueAt: daysFromNow(30) })], // open but not urgent
        checkIns: [checkIn({ scheduledAt: daysFromNow(-40), completedAt: daysFromNow(-40) })],
        reviewDue: { kind: "REVIEW", dueAt: NOW },
      }),
      NOW
    );
    expect(step.type).toBe("MISSING_CHECK_IN");
    expect(step.reasonCode).toBe("CHECK_IN_OVERDUE");
  });

  it("5. selects upcoming check-in next", () => {
    const step = deriveMentorshipNextStep(
      facts({
        checkIns: [checkIn({ scheduledAt: daysFromNow(3) })],
        reviewDue: { kind: "REVIEW", dueAt: NOW },
      }),
      NOW
    );
    expect(step.type).toBe("UPCOMING_CHECK_IN");
    expect(step.relatedId).toBe("s1");
  });

  it("6. selects review/cycle due next (recent check-in, none scheduled)", () => {
    const step = deriveMentorshipNextStep(
      facts({
        // last check-in 2 days ago (within cadence), none scheduled
        checkIns: [checkIn({ scheduledAt: daysFromNow(-2), completedAt: daysFromNow(-2) })],
        reviewDue: { kind: "REVIEW", dueAt: NOW },
      }),
      NOW
    );
    expect(step.type).toBe("REVIEW_DUE");
  });

  it("7. falls back to no immediate action", () => {
    const step = deriveMentorshipNextStep(
      facts({
        checkIns: [checkIn({ scheduledAt: daysFromNow(-2), completedAt: daysFromNow(-2) })],
        reviewDue: null,
      }),
      NOW
    );
    expect(step.type).toBe("NONE");
    expect(step.severity).toBe("none");
  });
});

describe("deriveMentorshipNextStep — date boundaries", () => {
  it("treats an action due yesterday as overdue", () => {
    const step = deriveMentorshipNextStep(
      facts({ openActions: [action({ dueAt: daysFromNow(-1) })] }),
      NOW
    );
    expect(step.type).toBe("OVERDUE_ACTION");
  });

  it("treats an action due today as due-soon, not overdue", () => {
    const step = deriveMentorshipNextStep(
      facts({ openActions: [action({ dueAt: NOW })] }),
      NOW
    );
    expect(step.type).toBe("ACTION_DUE_SOON");
    expect(step.explanation).toContain("due today");
  });

  it("treats an action due tomorrow as due-soon", () => {
    const step = deriveMentorshipNextStep(
      facts({ openActions: [action({ dueAt: daysFromNow(1) })] }),
      NOW
    );
    expect(step.type).toBe("ACTION_DUE_SOON");
  });

  it("treats an action exactly at the due-soon threshold as due-soon", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [action({ dueAt: daysFromNow(MENTORSHIP_ATTENTION_THRESHOLDS.actionDueSoonDays) })],
      }),
      NOW
    );
    expect(step.type).toBe("ACTION_DUE_SOON");
  });

  // A recently-held check-in isolates these so the only variable is the action.
  const recentCheckIn = () => [checkIn({ scheduledAt: daysFromNow(-1), completedAt: daysFromNow(-1) })];

  it("does not treat an action one day past the due-soon threshold as a next step", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [
          action({ dueAt: daysFromNow(MENTORSHIP_ATTENTION_THRESHOLDS.actionDueSoonDays + 1) }),
        ],
        checkIns: recentCheckIn(),
      }),
      NOW
    );
    expect(step.type).toBe("NONE");
  });

  it("ignores a null due date for urgency (no overdue/due-soon)", () => {
    const step = deriveMentorshipNextStep(
      facts({ openActions: [action({ dueAt: null })], checkIns: recentCheckIn() }),
      NOW
    );
    expect(step.type).toBe("NONE");
  });

  it("excludes a completed action", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [action({ status: "COMPLETE", dueAt: daysFromNow(-2) })],
        checkIns: recentCheckIn(),
      }),
      NOW
    );
    expect(step.type).toBe("NONE");
  });

  it("excludes a cancelled (dropped) action", () => {
    const step = deriveMentorshipNextStep(
      facts({
        openActions: [action({ status: "DROPPED", dueAt: daysFromNow(-2) })],
        checkIns: recentCheckIn(),
      }),
      NOW
    );
    expect(step.type).toBe("NONE");
  });

  it("selects a blocked action even without a due date", () => {
    const step = deriveMentorshipNextStep(
      facts({ openActions: [action({ status: "BLOCKED", dueAt: null })] }),
      NOW
    );
    expect(step.type).toBe("BLOCKED_ACTION");
  });

  it("treats a check-in scheduled today as upcoming", () => {
    const step = deriveMentorshipNextStep(
      facts({ checkIns: [checkIn({ scheduledAt: NOW })] }),
      NOW
    );
    expect(step.type).toBe("UPCOMING_CHECK_IN");
    expect(step.explanation).toContain("today");
  });

  it("treats a past, never-held check-in as overdue", () => {
    const step = deriveMentorshipNextStep(
      facts({ checkIns: [checkIn({ scheduledAt: daysFromNow(-3), completedAt: null })] }),
      NOW
    );
    expect(step.type).toBe("MISSING_CHECK_IN");
    expect(step.reasonCode).toBe("CHECK_IN_OVERDUE");
  });

  it("reports no check-in scheduled when there is no history at all", () => {
    const step = deriveMentorshipNextStep(facts({ checkIns: [] }), NOW);
    expect(step.type).toBe("MISSING_CHECK_IN");
    expect(step.reasonCode).toBe("NO_CHECK_IN_SCHEDULED");
  });

  it("does not nag for a check-in right after one was held", () => {
    const step = deriveMentorshipNextStep(
      facts({ checkIns: [checkIn({ scheduledAt: daysFromNow(-1), completedAt: daysFromNow(-1) })] }),
      NOW
    );
    expect(step.type).toBe("NONE");
  });

  it("flags an overdue cadence exactly at the threshold", () => {
    const step = deriveMentorshipNextStep(
      facts({
        checkIns: [
          checkIn({
            scheduledAt: daysFromNow(-MENTORSHIP_ATTENTION_THRESHOLDS.checkInOverdueDays),
            completedAt: daysFromNow(-MENTORSHIP_ATTENTION_THRESHOLDS.checkInOverdueDays),
          }),
        ],
      }),
      NOW
    );
    expect(step.type).toBe("MISSING_CHECK_IN");
    expect(step.reasonCode).toBe("CHECK_IN_OVERDUE");
  });

  it("selects review due today over none", () => {
    const step = deriveMentorshipNextStep(
      facts({
        checkIns: [checkIn({ scheduledAt: daysFromNow(-1), completedAt: daysFromNow(-1) })],
        reviewDue: { kind: "REVIEW", dueAt: NOW },
      }),
      NOW
    );
    expect(step.type).toBe("REVIEW_DUE");
  });

  it("never surfaces a next step for a non-active relationship", () => {
    const step = deriveMentorshipNextStep(
      facts({ status: "COMPLETE", openActions: [action({ dueAt: daysFromNow(-9) })] }),
      NOW
    );
    expect(step.type).toBe("NONE");
  });
});

describe("deriveMentorshipAttention", () => {
  it("maps urgent next steps to needs_attention with a concrete headline", () => {
    const attention = deriveMentorshipAttention(
      facts({ openActions: [action({ dueAt: daysFromNow(-1) })] }),
      NOW
    );
    expect(attention.state).toBe("needs_attention");
    expect(attention.headline).toBe("Next step overdue");
    expect(attention.severity).toBe("critical");
    // never a vague label
    expect(attention.headline).not.toMatch(/unhealthy|rhythm reset|quiet/i);
  });

  it("maps an upcoming check-in to scheduled", () => {
    const attention = deriveMentorshipAttention(
      facts({ checkIns: [checkIn({ scheduledAt: daysFromNow(3) })] }),
      NOW
    );
    expect(attention.state).toBe("scheduled");
    expect(attention.headline).toBe("Check-in coming up");
  });

  it("maps no immediate action to on_track", () => {
    const attention = deriveMentorshipAttention(
      facts({ checkIns: [checkIn({ scheduledAt: daysFromNow(-1), completedAt: daysFromNow(-1) })] }),
      NOW
    );
    expect(attention.state).toBe("on_track");
    expect(attention.headline).toBe("No immediate action");
  });

  it("agrees with the next step it was derived from", () => {
    const input = facts({ openActions: [action({ status: "BLOCKED" })] });
    const attention = deriveMentorshipAttention(input, NOW);
    const step = deriveMentorshipNextStep(input, NOW);
    expect(attention.nextStep).toEqual(step);
    expect(attention.reasonCode).toBe(step.reasonCode);
  });
});

describe("mergeMentorshipActionFacts", () => {
  function canonical(overrides: Partial<CanonicalActionRow> = {}): CanonicalActionRow {
    return {
      id: "c1",
      title: "Canonical step",
      status: "NOT_STARTED",
      deadlineStart: daysFromNow(2),
      deadlineEnd: null,
      mentorshipSessionId: null,
      ...overrides,
    };
  }
  function legacy(overrides: Partial<LegacyActionRow> = {}): LegacyActionRow {
    return {
      id: "l1",
      title: "Legacy step",
      status: "OPEN",
      dueAt: daysFromNow(2),
      completedAt: null,
      linkedActionId: null,
      sessionId: null,
      ...overrides,
    };
  }

  it("keeps open canonical actions and prefers deadlineEnd as the due date", () => {
    const merged = mergeMentorshipActionFacts(
      [canonical({ deadlineStart: daysFromNow(1), deadlineEnd: daysFromNow(5) })],
      []
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].legacy).toBe(false);
    expect(merged[0].dueAt).toEqual(daysFromNow(5));
  });

  it("drops closed canonical actions", () => {
    expect(mergeMentorshipActionFacts([canonical({ status: "COMPLETE" })], [])).toHaveLength(0);
    expect(mergeMentorshipActionFacts([canonical({ status: "DROPPED" })], [])).toHaveLength(0);
  });

  it("includes only unlinked, open legacy rows", () => {
    const merged = mergeMentorshipActionFacts(
      [],
      [
        legacy({ id: "keep", linkedActionId: null }),
        legacy({ id: "linked", linkedActionId: "c-twin" }),
        legacy({ id: "done", completedAt: daysFromNow(-1) }),
        legacy({ id: "complete-status", status: "COMPLETE" }),
      ]
    );
    expect(merged.map((m) => m.id)).toEqual(["keep"]);
    expect(merged[0].legacy).toBe(true);
  });

  it("never double-counts a legacy row that is linked to a canonical twin", () => {
    const merged = mergeMentorshipActionFacts(
      [canonical({ id: "c-twin" })],
      [legacy({ id: "l-twin", linkedActionId: "c-twin" })]
    );
    expect(merged.map((m) => m.id)).toEqual(["c-twin"]);
  });

  it("summarizes open / overdue / blocked counts in one pass", () => {
    const merged = mergeMentorshipActionFacts(
      [
        canonical({ id: "ov", deadlineStart: daysFromNow(-3), deadlineEnd: null }),
        canonical({ id: "bl", status: "BLOCKED", deadlineStart: daysFromNow(5) }),
        canonical({ id: "ok", deadlineStart: daysFromNow(5) }),
      ],
      []
    );
    const summary = summarizeMentorshipActionFacts(merged, NOW);
    expect(summary).toEqual({ open: 3, overdue: 1, blocked: 1 });
  });
});
