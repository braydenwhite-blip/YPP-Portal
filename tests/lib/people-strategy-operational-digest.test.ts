import { describe, expect, it, vi } from "vitest";

// The digest module is pure, but it imports types from query modules whose
// barrels touch prisma at load; mock so importing never spins up a real client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import type { RelatedEntitySummary } from "@/lib/people-strategy/connections";
import { computeOperationalHealth } from "@/lib/people-strategy/operational-context";
import {
  bucketActionsByUrgency,
  bucketMeetingsByUrgency,
  deriveActionTriage,
  deriveAreaHealth,
  deriveOperationalEntities,
  deriveWeeklyOperationalDigest,
  explainOperationalHealth,
  rankReviewItems,
  selectDecisionsNeedingAction,
  selectStaleEntities,
  toActionLite,
  toMeetingLite,
  type DigestDecisionInput,
} from "@/lib/people-strategy/operational-digest";

// Thursday of the operating week Mon Jun 1 – Sun Jun 7, 2026.
const NOW = new Date("2026-06-04T12:00:00");

type Assignment = ActionItemWithRelations["assignments"][number];

function assignment(userId: string, role: Assignment["role"]): Assignment {
  return {
    id: `${userId}-${role}`,
    role,
    createdAt: NOW,
    user: { id: userId, name: userId, email: `${userId}@x.org`, primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null },
  } as Assignment;
}

function action(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Item",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-10T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    leadId: "alice",
    lead: { id: "alice", name: "Alice", email: "alice@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null },
    officerMeetingId: null,
    officerMeeting: null,
    relatedEntityType: null,
    relatedEntityId: null,
    flaggedAt: null,
    resolvedAt: null,
    createdAt: new Date("2026-05-01T00:00:00"),
    updatedAt: new Date("2026-06-03T00:00:00"),
    assignments: [assignment("alice", "LEAD"), assignment("bob", "EXECUTING")],
    comments: [],
    ...overrides,
  } as ActionItemWithRelations;
}

function meetingCard(overrides: Partial<MeetingCardDTO> = {}): MeetingCardDTO {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Meeting",
    purpose: null,
    category: "CLASSES",
    categoryLabel: "Classes",
    priority: "MEDIUM",
    startISO: NOW.toISOString(),
    endISO: null,
    durationLabel: null,
    recurrence: null,
    location: null,
    facilitator: null,
    attendeeCount: 0,
    participantIds: [],
    effectiveStatus: "completed",
    agendaCount: 0,
    agendaDoneCount: 0,
    decisionCount: 0,
    openFollowUps: 0,
    overdueFollowUps: 0,
    openLinkedActions: 0,
    linkedActionCount: 0,
    decisionsPreview: [],
    unconvertedFollowUps: [],
    linkedActionsPreview: [],
    relatedEntityType: null,
    relatedEntityId: null,
    ...overrides,
  };
}

function decision(overrides: Partial<DigestDecisionInput> = {}): DigestDecisionInput {
  return {
    id: Math.random().toString(36).slice(2),
    decision: "Ship the new flow",
    meetingId: "m1",
    meetingTitle: "Ops Sync",
    meetingCategory: "CLASSES",
    createdAt: new Date("2026-06-01T00:00:00"),
    decidedByName: "Alice",
    hasLinkedAction: false,
    relatedEntityType: null,
    relatedEntityId: null,
    ...overrides,
  };
}

function classLabel(id: string, label: string): [string, RelatedEntitySummary] {
  return [
    `CLASS_OFFERING:${id}`,
    { type: "CLASS_OFFERING", id, label, typeLabel: "Class", href: `/admin/classes/${id}` },
  ];
}

// --- urgency buckets ---------------------------------------------------------

describe("bucketActionsByUrgency", () => {
  it("splits the mutually-exclusive deadline tiers", () => {
    const b = bucketActionsByUrgency(
      [
        action({ deadlineStart: new Date("2026-05-25T00:00:00") }), // overdue
        action({ deadlineStart: new Date("2026-06-04T00:00:00") }), // due today
        action({ deadlineStart: new Date("2026-06-09T00:00:00") }), // due this week
        action({ deadlineStart: new Date("2026-06-20T00:00:00") }), // later (dropped)
      ],
      NOW
    );
    expect(b.overdue).toHaveLength(1);
    expect(b.dueToday).toHaveLength(1);
    expect(b.dueThisWeek).toHaveLength(1);
  });

  it("captures orthogonal flags independently of the deadline tier", () => {
    const b = bucketActionsByUrgency(
      [
        action({ status: "BLOCKED", deadlineStart: new Date("2026-05-25T00:00:00") }), // blocked AND overdue
        action({ assignments: [assignment("alice", "LEAD")] }), // unassigned (no executor)
        action({ priority: "URGENT" }), // high priority
        action({ updatedAt: new Date("2026-05-01T00:00:00") }), // stale (>14d)
      ],
      NOW
    );
    expect(b.blocked).toHaveLength(1);
    // A blocked-and-overdue item is overdue (deadline tier) AND blocked (flag).
    expect(b.overdue).toHaveLength(1);
    expect(b.unassigned).toHaveLength(1);
    expect(b.highPriority).toHaveLength(1);
    expect(b.stale).toHaveLength(1);
  });

  it("only counts recently-completed wins, ignoring old completions", () => {
    const b = bucketActionsByUrgency(
      [
        action({ status: "COMPLETE", completedAt: new Date("2026-06-02T00:00:00") }), // recent
        action({ status: "COMPLETE", completedAt: new Date("2026-05-01T00:00:00") }), // old
        action({ status: "DROPPED" }), // settled, ignored
      ],
      NOW
    );
    expect(b.recentlyCompleted).toHaveLength(1);
  });
});

describe("bucketMeetingsByUrgency", () => {
  it("finds upcoming, recent, without-actions, follow-up, and decision-only meetings", () => {
    const b = bucketMeetingsByUrgency(
      [
        meetingCard({ effectiveStatus: "upcoming", startISO: "2026-06-06T18:00:00" }), // upcoming this week
        meetingCard({ effectiveStatus: "completed", startISO: "2026-06-02T18:00:00", linkedActionCount: 0 }), // recent + no actions
        meetingCard({ effectiveStatus: "needs_follow_up", startISO: "2026-06-02T18:00:00", openFollowUps: 2, overdueFollowUps: 1, linkedActionCount: 1 }), // unresolved follow-ups
        meetingCard({ effectiveStatus: "completed", startISO: "2026-06-02T18:00:00", decisionCount: 2, linkedActionCount: 0 }), // decisions, no action
        meetingCard({ effectiveStatus: "completed", startISO: "2026-06-02T18:00:00", recurrence: "WEEKLY", linkedActionCount: 3 }), // recurring
      ],
      NOW
    );
    expect(b.upcomingThisWeek).toHaveLength(1);
    expect(b.recent.length).toBeGreaterThanOrEqual(3);
    expect(b.withoutActions).toHaveLength(2); // the no-actions + the decisions-no-action one
    expect(b.withUnresolvedFollowUps).toHaveLength(1);
    expect(b.withDecisionsNoAction).toHaveLength(1);
    expect(b.recurring).toHaveLength(1);
  });

  it("never flags an un-started upcoming meeting as 'no action yet'", () => {
    const b = bucketMeetingsByUrgency(
      [meetingCard({ effectiveStatus: "upcoming", startISO: "2026-06-06T18:00:00", linkedActionCount: 0 })],
      NOW
    );
    expect(b.withoutActions).toHaveLength(0);
  });
});

describe("deriveActionTriage", () => {
  it("produces the four triage lenses as lite shapes", () => {
    const t = deriveActionTriage(
      [
        action({ deadlineStart: new Date("2026-05-20T00:00:00") }), // overdue
        action({ status: "BLOCKED", deadlineStart: new Date("2026-06-20T00:00:00") }), // blocked, far out
        action({ assignments: [assignment("alice", "LEAD")], deadlineStart: new Date("2026-06-20T00:00:00") }), // unassigned, far out
        action({ deadlineStart: new Date("2026-06-04T00:00:00") }), // due soon (today)
        action({ status: "COMPLETE" }), // settled — excluded everywhere
      ],
      NOW
    );
    expect(t.overdue).toHaveLength(1);
    expect(t.blocked).toHaveLength(1);
    expect(t.unassigned).toHaveLength(1);
    expect(t.dueSoon).toHaveLength(1);
    expect(t.overdue[0].href).toMatch(/^\/actions\//);
  });
});

// --- decisions ---------------------------------------------------------------

describe("selectDecisionsNeedingAction", () => {
  it("returns recent decisions without a linked action, newest first", () => {
    const out = selectDecisionsNeedingAction(
      [
        decision({ createdAt: new Date("2026-06-01T00:00:00"), hasLinkedAction: false, decision: "Recent open" }),
        decision({ createdAt: new Date("2026-06-03T00:00:00"), hasLinkedAction: false, decision: "Newer open" }),
        decision({ createdAt: new Date("2026-06-01T00:00:00"), hasLinkedAction: true, decision: "Has action" }),
        decision({ createdAt: new Date("2026-04-01T00:00:00"), hasLinkedAction: false, decision: "Too old" }),
      ],
      NOW
    );
    expect(out.map((d) => d.decision)).toEqual(["Newer open", "Recent open"]);
  });
});

// --- entity rollup -----------------------------------------------------------

describe("deriveOperationalEntities", () => {
  it("joins actions + meetings + decisions per entity and derives health", () => {
    const entities = deriveOperationalEntities({
      actions: [
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-21T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-22T00:00:00") }),
      ],
      meetings: [meetingCard({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", startISO: "2026-05-01T18:00:00" })],
      decisions: [decision({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1" })],
      labels: new Map([classLabel("cls1", "Algebra 101")]),
      now: NOW,
    });
    expect(entities).toHaveLength(1);
    const e = entities[0];
    expect(e.label).toBe("Algebra 101");
    expect(e.health.level).toBe("critical"); // 3 overdue actions
    expect(e.overdueActions).toBe(3);
    expect(e.daysSinceLastMeeting).toBe(34); // May 1 → Jun 4
    expect(e.recentDecisions).toBe(1);
  });

  it("falls back to the type label when no summary is supplied", () => {
    const [e] = deriveOperationalEntities({
      actions: [action({ relatedEntityType: "MENTORSHIP", relatedEntityId: "m9" })],
      meetings: [],
      decisions: [],
      labels: new Map(),
      now: NOW,
    });
    expect(e.label).toBe("Mentorship");
    expect(e.href).toBeNull();
  });

  it("orders entities worst-health first", () => {
    const entities = deriveOperationalEntities({
      actions: [
        // cls1: critical (3 overdue)
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        // cls2: at risk (1 overdue)
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls2", deadlineStart: new Date("2026-05-20T00:00:00") }),
        // cls3: healthy (settled)
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls3", status: "COMPLETE" }),
      ],
      meetings: [],
      decisions: [],
      labels: new Map([classLabel("cls1", "C1"), classLabel("cls2", "C2"), classLabel("cls3", "C3")]),
      now: NOW,
    });
    expect(entities.map((e) => e.id)).toEqual(["cls1", "cls2", "cls3"]);
  });
});

describe("selectStaleEntities", () => {
  it("flags entities with open work but no recent meeting", () => {
    const entities = deriveOperationalEntities({
      actions: [action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1" })], // open, due later
      meetings: [meetingCard({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", startISO: "2026-04-01T18:00:00" })], // 64d ago
      decisions: [],
      labels: new Map([classLabel("cls1", "Stale Class")]),
      now: NOW,
    });
    expect(selectStaleEntities(entities)).toHaveLength(1);
  });

  it("does not flag a fresh entity with a recent meeting", () => {
    const entities = deriveOperationalEntities({
      actions: [action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1" })],
      meetings: [meetingCard({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", startISO: "2026-06-02T18:00:00" })],
      decisions: [],
      labels: new Map([classLabel("cls1", "Fresh Class")]),
      now: NOW,
    });
    expect(selectStaleEntities(entities)).toHaveLength(0);
  });
});

// --- area health -------------------------------------------------------------

describe("deriveAreaHealth", () => {
  it("rolls actions + meetings up to operating areas, worst-health first", () => {
    const actions = [
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ relatedEntityType: "PARTNER", relatedEntityId: "p1" }), // open, not overdue
    ];
    const meetings = [
      meetingCard({ category: "MENTORSHIP", effectiveStatus: "upcoming", startISO: "2026-06-06T18:00:00" }),
    ];
    const entities = deriveOperationalEntities({ actions, meetings, decisions: [], labels: new Map(), now: NOW });
    const rows = deriveAreaHealth({ actions, meetings, entities, now: NOW });

    const classes = rows.find((r) => r.area === "CLASSES");
    expect(classes?.health.level).toBe("critical");
    expect(classes?.overdueActions).toBe(3);
    expect(classes?.criticalEntities).toBe(1);
    const mentorship = rows.find((r) => r.area === "MENTORSHIP");
    expect(mentorship?.meetingCount).toBe(1);
    expect(mentorship?.upcomingMeetings).toBe(1);
    // Classes (critical) sorts before Partnerships (attention) and Mentorship.
    expect(rows[0].area).toBe("CLASSES");
  });

  it("drops areas with no activity", () => {
    const rows = deriveAreaHealth({ actions: [], meetings: [], entities: [], now: NOW });
    expect(rows).toEqual([]);
  });
});

// --- health explanation ------------------------------------------------------

describe("explainOperationalHealth", () => {
  it("explains a critical entity with overdue work and a cold calendar", () => {
    const ex = explainOperationalHealth(computeOperationalHealth({ overdueActions: 3 }), {
      overdueActions: 3,
      openActions: 3,
      daysSinceLastMeeting: 34,
    });
    expect(ex.level).toBe("critical");
    expect(ex.headline).toMatch(/^Critical because 3 actions overdue/);
    expect(ex.headline).toContain("no meeting in 34 days");
    expect(ex.suggestedNextSteps.length).toBeGreaterThan(0);
  });

  it("explains a healthy surface with momentum language", () => {
    const ex = explainOperationalHealth(computeOperationalHealth({}), {});
    expect(ex.level).toBe("healthy");
    expect(ex.headline).toMatch(/^Healthy/);
    expect(ex.suggestedNextSteps[0]).toMatch(/review|rhythm/i);
  });

  it("explains a watch surface driven by unowned work", () => {
    const ex = explainOperationalHealth(
      computeOperationalHealth({ openActions: 1, unassignedActions: 1 }),
      { openActions: 1, unassignedActions: 1 }
    );
    expect(ex.level).toBe("attention");
    expect(ex.headline).toMatch(/^Watch because/);
    expect(ex.suggestedNextSteps).toContain("Assign an owner to the unowned actions");
  });
});

// --- ranking -----------------------------------------------------------------

describe("rankReviewItems", () => {
  it("ranks a critical entity above a warning entity above a watch decision", () => {
    const entities = deriveOperationalEntities({
      actions: [
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "PARTNER", relatedEntityId: "p1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      ],
      meetings: [],
      decisions: [],
      labels: new Map([classLabel("cls1", "Critical Class")]),
      now: NOW,
    });
    const ranked = rankReviewItems({
      entities,
      meetingsNeedingFollowThrough: [],
      decisionsNeedingAction: [
        { ...decision(), id: "d1", decision: "Open decision", href: "/actions/meetings/m1", areaLabel: "Classes", createdISO: NOW.toISOString(), relatedType: null, relatedId: null },
      ] as never,
      upcomingMeetings: [],
      urgentActions: [],
      now: NOW,
    });
    expect(ranked[0].kind).toBe("class");
    expect(ranked[0].severity).toBe("critical");
    // The partner (warning) outranks the standalone decision (watch).
    const kinds = ranked.map((r) => r.kind);
    expect(kinds.indexOf("partner")).toBeLessThan(kinds.indexOf("decision"));
  });

  it("does not double-surface an action already covered by its entity", () => {
    const entities = deriveOperationalEntities({
      actions: [
        action({ id: "a1", relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
      ],
      meetings: [],
      decisions: [],
      labels: new Map([classLabel("cls1", "C1")]),
      now: NOW,
    });
    const ranked = rankReviewItems({
      entities,
      meetingsNeedingFollowThrough: [],
      decisionsNeedingAction: [],
      upcomingMeetings: [],
      urgentActions: [toActionLite(action({ id: "a1", relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }), NOW)],
      now: NOW,
    });
    expect(ranked.filter((r) => r.kind === "action")).toHaveLength(0);
    expect(ranked.filter((r) => r.kind === "class")).toHaveLength(1);
  });
});

// --- full digest -------------------------------------------------------------

describe("deriveWeeklyOperationalDigest", () => {
  it("produces an all-zero, empty digest for an empty org", () => {
    const d = deriveWeeklyOperationalDigest({
      actions: [],
      meetings: [],
      decisions: [],
      labels: new Map(),
      now: NOW,
    });
    expect(d.counts.overdueActions).toBe(0);
    expect(d.counts.criticalEntities).toBe(0);
    expect(d.urgentActions).toEqual([]);
    expect(d.recommendedReviewOrder).toEqual([]);
    expect(d.window.start.getTime()).toBeLessThan(d.window.end.getTime());
  });

  it("celebrates momentum without inventing problems when all is healthy", () => {
    const d = deriveWeeklyOperationalDigest({
      actions: [
        action({ status: "COMPLETE", completedAt: new Date("2026-06-02T00:00:00"), relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1" }),
      ],
      meetings: [
        meetingCard({ effectiveStatus: "completed", startISO: "2026-06-02T18:00:00", linkedActionCount: 2, relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1" }),
      ],
      decisions: [],
      labels: new Map([classLabel("cls1", "Healthy Class")]),
      now: NOW,
    });
    expect(d.counts.criticalEntities).toBe(0);
    expect(d.counts.overdueActions).toBe(0);
    expect(d.recentlyCompletedActions).toHaveLength(1);
    expect(d.recommendedReviewOrder).toEqual([]);
  });

  it("surfaces a mixed critical / warning digest with a ranked review queue", () => {
    const d = deriveWeeklyOperationalDigest({
      actions: [
        // cls1 → critical (3 overdue)
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1", deadlineStart: new Date("2026-05-20T00:00:00") }),
        // partner → warning (1 overdue)
        action({ relatedEntityType: "PARTNER", relatedEntityId: "p1", deadlineStart: new Date("2026-05-25T00:00:00") }),
        // due today, unlinked
        action({ deadlineStart: new Date("2026-06-04T00:00:00") }),
      ],
      meetings: [
        meetingCard({ effectiveStatus: "needs_follow_up", startISO: "2026-06-02T18:00:00", openFollowUps: 2, overdueFollowUps: 1, linkedActionCount: 0, decisionCount: 1, relatedEntityType: "CLASS_OFFERING", relatedEntityId: "cls1" }),
        meetingCard({ effectiveStatus: "upcoming", startISO: "2026-06-05T18:00:00" }),
      ],
      decisions: [
        decision({ createdAt: new Date("2026-06-02T00:00:00"), hasLinkedAction: false }),
      ],
      labels: new Map([classLabel("cls1", "Algebra 101")]),
      now: NOW,
    });

    expect(d.counts.criticalEntities).toBe(1);
    expect(d.counts.warningEntities).toBe(1);
    expect(d.counts.openActions).toBe(5);
    expect(d.counts.overdueActions).toBe(4);
    expect(d.counts.dueTodayActions).toBe(1);
    expect(d.counts.meetingsThisWeek).toBe(2);
    expect(d.counts.upcomingMeetings).toBe(1);
    expect(d.counts.unresolvedFollowUps).toBe(2);
    expect(d.counts.decisionsNeedingAction).toBe(1);
    expect(d.triage.overdue).toHaveLength(4);
    expect(d.triage.dueSoon).toHaveLength(1);
    expect(d.recentMeetings.length).toBeGreaterThan(0);
    expect(d.criticalEntities[0].label).toBe("Algebra 101");
    expect(d.meetingsNeedingFollowThrough.length).toBeGreaterThan(0);
    expect(d.recommendedReviewOrder[0].kind).toBe("class");
    expect(d.recommendedReviewOrder.length).toBeGreaterThan(1);
    // Area health rolls up the classes area as critical.
    expect(d.areaHealth.find((r) => r.area === "CLASSES")?.health.level).toBe("critical");
  });

  it("surfaces meeting follow-ups that have not been converted into actions", () => {
    const d = deriveWeeklyOperationalDigest({
      actions: [],
      meetings: [
        meetingCard({
          id: "m1",
          title: "Curriculum sync",
          relatedEntityType: "CLASS_OFFERING",
          relatedEntityId: "cls1",
          openFollowUps: 1,
          unconvertedFollowUps: [
            {
              id: "f1",
              title: "Confirm STEM scope before emailing the partner",
              description: "Rockets and planes might be too narrow.",
              owner: { id: "alice", name: "Alice", initials: "A" },
              dueISO: "2026-06-07T00:00:00.000Z",
              effectiveStatus: "open",
              priority: "HIGH",
              area: "CLASSES",
              areaLabel: "Classes",
              linkedActionId: null,
            },
          ],
        }),
      ],
      decisions: [],
      labels: new Map([classLabel("cls1", "STEM pilot")]),
      now: NOW,
    });

    expect(d.counts.unconvertedFollowUps).toBe(1);
    expect(d.unresolvedMeetingFollowUps[0]).toMatchObject({
      title: "Confirm STEM scope before emailing the partner",
      meetingTitle: "Curriculum sync",
      ownerName: "Alice",
      relatedLabel: "STEM pilot",
    });
  });

  it("respects explicit limits and window", () => {
    const window = { start: new Date("2026-06-01T00:00:00"), end: new Date("2026-06-07T23:59:59") };
    const d = deriveWeeklyOperationalDigest({
      actions: [
        action({ deadlineStart: new Date("2026-05-20T00:00:00") }),
        action({ deadlineStart: new Date("2026-05-21T00:00:00") }),
        action({ deadlineStart: new Date("2026-05-22T00:00:00") }),
      ],
      meetings: [],
      decisions: [],
      labels: new Map(),
      now: NOW,
      window,
      limits: { urgentActions: 2, review: 1 },
    });
    expect(d.urgentActions).toHaveLength(2);
    expect(d.recommendedReviewOrder).toHaveLength(1);
    expect(d.window).toBe(window);
  });
});

// --- lite mappers ------------------------------------------------------------

describe("lite mappers", () => {
  it("maps an action to a serializable lite shape", () => {
    const lite = toActionLite(
      action({
        id: "a1",
        title: "Call partner",
        description: "Partner needs final schedule.",
        relatedEntityType: "PARTNER",
        relatedEntityId: "p1",
        officerMeetingId: "m1",
        officerMeeting: { id: "m1", title: "Partner sync", date: new Date("2026-06-01T00:00:00"), category: "PARTNERSHIPS" },
        deadlineStart: new Date("2026-05-20T00:00:00"),
        comments: [
          {
            id: "c1",
            body: "Waiting on the partner contact.",
            type: "NOTE",
            createdAt: new Date("2026-06-03T00:00:00"),
            authorId: "alice",
            actionItemId: "a1",
            author: { id: "alice", name: "Alice", email: "alice@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null },
          },
        ],
      }),
      NOW,
      new Map([["PARTNER:p1", { type: "PARTNER", id: "p1", label: "Lincoln HS", typeLabel: "Partner", href: "/admin/partners/p1" }]])
    );
    expect(lite).toMatchObject({
      id: "a1",
      title: "Call partner",
      overdue: true,
      relatedType: "PARTNER",
      relatedId: "p1",
      relatedLabel: "Lincoln HS",
      sourceMeetingId: "m1",
      sourceMeetingTitle: "Partner sync",
      href: "/actions/a1",
    });
    expect(lite.latestUpdate).toBe("Waiting on the partner contact.");
    expect(lite.nextStep).toBe("Partner needs final schedule.");
    expect(lite.daysOverdue).toBeGreaterThan(0);
  });

  it("maps a meeting card to a lite shape with a workspace href", () => {
    const lite = toMeetingLite(
      meetingCard({
        id: "m1",
        title: "Sync",
        facilitator: { id: "u1", name: "Alice", initials: "A" },
        attendeeCount: 2,
        relatedEntityType: "CLASS_OFFERING",
        relatedEntityId: "cls1",
        decisionsPreview: [
          {
            id: "d1",
            decision: "Use broader STEM for the pilot.",
            rationale: null,
            decidedBy: null,
            createdISO: "2026-06-02T00:00:00.000Z",
            linkedActionId: null,
          },
        ],
        unconvertedFollowUps: [
          {
            id: "f1",
            title: "Confirm before emailing partner",
            description: null,
            owner: { id: "u1", name: "Alice", initials: "A" },
            dueISO: "2026-06-07T00:00:00.000Z",
            effectiveStatus: "open",
            priority: "HIGH",
            area: "CLASSES",
            areaLabel: "Classes",
            linkedActionId: null,
          },
        ],
        linkedActionsPreview: [{ id: "a1", title: "Draft options", owner: null, status: "IN_PROGRESS", priority: "MEDIUM", deadlineISO: "2026-06-07T00:00:00.000Z", departmentName: null }],
      }),
      NOW,
      new Map([classLabel("cls1", "STEM pilot")])
    );
    expect(lite).toMatchObject({ id: "m1", title: "Sync", href: "/actions/meetings/m1", relatedType: "CLASS_OFFERING", relatedId: "cls1", relatedLabel: "STEM pilot" });
    expect(lite.keyDecisions).toEqual(["Use broader STEM for the pilot."]);
    expect(lite.linkedActionTitles).toEqual(["Draft options"]);
    expect(lite.unconvertedFollowUps[0]).toMatchObject({ title: "Confirm before emailing partner", ownerName: "Alice" });
  });
});
