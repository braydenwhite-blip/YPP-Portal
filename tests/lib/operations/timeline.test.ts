import { describe, expect, it } from "vitest";

import type {
  ActionLite,
  DecisionLite,
  MeetingLite,
} from "@/lib/people-strategy/operational-digest";
import {
  buildUnifiedTimeline,
  filterTimeline,
  groupTimelineByDay,
} from "@/lib/operations/timeline";

const NOW = new Date("2026-06-11T12:00:00.000Z");

function action(overrides: Partial<ActionLite> = {}): ActionLite {
  return {
    id: "a1",
    title: "Onboard instructors",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    dueISO: "2026-06-15T00:00:00.000Z",
    ownerName: "Brayden Kim",
    overdue: false,
    daysOverdue: 0,
    blocked: false,
    unassigned: false,
    relatedType: "CLASS_OFFERING",
    relatedId: "c1",
    relatedLabel: "Intro to Entrepreneurship",
    relatedTypeLabel: "Class",
    sourceMeetingId: null,
    sourceMeetingTitle: null,
    sourceMeetingStartISO: null,
    latestUpdate: null,
    nextStep: null,
    contextSummary: "Linked to Class: Intro to Entrepreneurship",
    createdISO: "2026-06-09T10:00:00.000Z",
    href: "/actions/a1",
    ...overrides,
  };
}

function meeting(overrides: Partial<MeetingLite> = {}): MeetingLite {
  return {
    id: "m1",
    title: "Beth El planning sync",
    startISO: "2026-06-08T15:00:00.000Z",
    category: "PARTNERSHIPS",
    categoryLabel: "Partnerships",
    effectiveStatus: "completed",
    openFollowUps: 1,
    overdueFollowUps: 0,
    decisionCount: 2,
    linkedActionCount: 1,
    facilitatorName: "Ian Chen",
    attendeeCount: 4,
    recurrence: null,
    relatedType: "PARTNER",
    relatedId: "p1",
    relatedLabel: "Beth El Day Camp",
    keyDecisions: [],
    linkedActionTitles: [],
    unconvertedFollowUps: [],
    outcome: "productive",
    href: "/actions/meetings/m1",
    ...overrides,
  } as MeetingLite;
}

function decision(overrides: Partial<DecisionLite> = {}): DecisionLite {
  return {
    id: "d1",
    decision: "Run the pilot in July",
    meetingId: "m1",
    meetingTitle: "Beth El planning sync",
    areaLabel: "Partnerships",
    decidedByName: "Ian Chen",
    createdISO: "2026-06-08T16:00:00.000Z",
    hasLinkedAction: false,
    relatedType: null,
    relatedId: null,
    href: "/actions/meetings/m1",
    ...overrides,
  };
}

describe("buildUnifiedTimeline", () => {
  it("merges meetings, decisions, and action create/complete events newest-first", () => {
    const events = buildUnifiedTimeline({
      actions: [
        action({
          status: "COMPLETE",
          completedISO: "2026-06-10T09:00:00.000Z",
        }),
      ],
      meetings: [meeting()],
      decisions: [decision()],
      now: NOW,
    });
    expect(events.map((e) => e.kind)).toEqual([
      "action_completed",
      "action_created",
      "decision",
      "meeting",
    ]);
    const times = events.map((e) => new Date(e.occurredAtISO).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("excludes upcoming and cancelled meetings — the timeline is history", () => {
    const events = buildUnifiedTimeline({
      actions: [],
      meetings: [
        meeting({ id: "up", effectiveStatus: "upcoming", startISO: "2026-06-10T00:00:00.000Z" }),
        meeting({ id: "gone", effectiveStatus: "canceled" }),
      ],
      decisions: [],
      now: NOW,
    });
    expect(events).toEqual([]);
  });

  it("drops events outside the lookback window and honours the limit", () => {
    const events = buildUnifiedTimeline({
      actions: [action({ createdISO: "2026-01-01T00:00:00.000Z" })],
      meetings: [meeting()],
      decisions: [decision()],
      now: NOW,
      daysBack: 30,
      limit: 1,
    });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("decision");
  });

  it("summarises what each meeting produced", () => {
    const [event] = buildUnifiedTimeline({
      actions: [],
      meetings: [meeting()],
      decisions: [],
      now: NOW,
    });
    expect(event.detail).toBe("Partnerships · 2 decisions · 1 action created · 1 open follow-up");
    expect(event.actorName).toBe("Ian Chen");
  });
});

describe("filterTimeline", () => {
  const events = buildUnifiedTimeline({
    actions: [action({ status: "COMPLETE", completedISO: "2026-06-10T09:00:00.000Z" })],
    meetings: [meeting()],
    decisions: [decision()],
    now: NOW,
  });

  it("keeps everything on 'all' and scopes the chips correctly", () => {
    expect(filterTimeline(events, "all")).toHaveLength(4);
    expect(filterTimeline(events, "meetings").map((e) => e.kind)).toEqual(["meeting"]);
    expect(filterTimeline(events, "decisions").map((e) => e.kind)).toEqual(["decision"]);
    expect(filterTimeline(events, "actions").map((e) => e.kind)).toEqual([
      "action_completed",
      "action_created",
    ]);
  });
});

describe("groupTimelineByDay", () => {
  it("buckets a newest-first stream into dated day groups", () => {
    const events = buildUnifiedTimeline({
      actions: [action({ status: "COMPLETE", completedISO: "2026-06-10T09:00:00.000Z" })],
      meetings: [meeting()],
      decisions: [decision()],
      now: NOW,
    });
    const days = groupTimelineByDay(events);
    expect(days.length).toBeGreaterThanOrEqual(2);
    // Every event lands in exactly one day group.
    expect(days.flatMap((d) => d.events)).toHaveLength(events.length);
    // Day labels are human ("Jun 10"), keys are stable ISO days.
    expect(days[0].dayLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
    expect(days[0].dayISO).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
