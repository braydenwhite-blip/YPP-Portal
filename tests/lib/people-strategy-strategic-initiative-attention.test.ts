import { describe, expect, it } from "vitest";

import {
  deriveInitiativeAttention,
  initiativeNeedsAttention,
  lastMeetingEvent,
  nextMeetingEvent,
  nextOpenMilestone,
  primaryNextStep,
  topAttentionReason,
} from "@/lib/people-strategy/strategic-initiative-attention";
import type { InitiativeSummary, InitiativeCounts } from "@/lib/people-strategy/strategic-initiative-summary";
import type { InitiativeMilestoneSummary } from "@/lib/people-strategy/strategic-milestones";
import type {
  StrategicTimeline,
  StrategicTimelineEvent,
} from "@/lib/people-strategy/strategic-timeline";

const NOW = new Date("2026-06-14T12:00:00.000Z");

function counts(overrides: Partial<InitiativeCounts> = {}): InitiativeCounts {
  return {
    totalActions: 0,
    openActions: 3,
    overdueActions: 0,
    blockedActions: 0,
    unassignedActions: 0,
    completedActions: 0,
    meetingCount: 0,
    upcomingMeetings: 0,
    openFollowUps: 0,
    decisionsWithoutAction: 0,
    milestonesTotal: 2,
    milestonesComplete: 0,
    milestonesBehind: 0,
    criticalEntities: 0,
    ...overrides,
  };
}

function milestone(overrides: Partial<InitiativeMilestoneSummary> = {}): InitiativeMilestoneSummary {
  return {
    id: "m1",
    title: "Run pilot",
    description: null,
    order: 0,
    targetDateISO: null,
    status: "in_progress",
    statusLabel: "In progress",
    percent: 40,
    totalActions: 3,
    openActions: 2,
    completedActions: 1,
    blockedActions: 0,
    overdueActions: 0,
    unassignedActions: 0,
    meetingCount: 0,
    decisionCount: 0,
    health: { level: "steady", label: "Steady", tone: "info" } as InitiativeMilestoneSummary["health"],
    ownerName: "Dana",
    behindSchedule: false,
    actionIds: [],
    ...overrides,
  };
}

function emptyTimeline(): StrategicTimeline {
  return { events: [], upcoming: [], keyMoments: [] };
}

function meetingEvent(id: string, iso: string, upcoming: boolean): StrategicTimelineEvent {
  return {
    id: `meeting:${id}`,
    type: "meeting",
    occurredAtISO: iso,
    upcoming,
    title: `Meeting ${id}`,
    explanation: "",
    severity: "neutral",
    sourceType: "meeting",
    ownerName: null,
    initiativeId: "i1",
    initiativeTitle: "Test",
    entity: null,
    href: `/meetings/${id}`,
  };
}

function summary(overrides: Partial<InitiativeSummary> = {}): InitiativeSummary {
  const base: Partial<InitiativeSummary> = {
    id: "i1",
    title: "Test initiative",
    description: "Do the thing",
    status: "active",
    owner: "Dana",
    ownerDeclared: true,
    pastTargetDate: false,
    counts: counts(),
    milestones: [milestone()],
    recommendations: [],
    timeline: emptyTimeline(),
    ownership: { clarity: "clear" } as InitiativeSummary["ownership"],
    healthExplanation: { suggestedNextSteps: [] } as unknown as InitiativeSummary["healthExplanation"],
  };
  return { ...base, ...overrides } as InitiativeSummary;
}

describe("deriveInitiativeAttention", () => {
  it("returns no reasons for a healthy active initiative", () => {
    expect(deriveInitiativeAttention(summary(), NOW)).toEqual([]);
    expect(initiativeNeedsAttention(summary(), NOW)).toBe(false);
  });

  it("never flags terminal (completed/archived) initiatives", () => {
    const blockedCompleted = summary({
      status: "completed",
      counts: counts({ blockedActions: 4, openFollowUps: 2 }),
      owner: null,
    });
    expect(deriveInitiativeAttention(blockedCompleted, NOW)).toEqual([]);
  });

  it("flags blocked actions", () => {
    const reasons = deriveInitiativeAttention(summary({ counts: counts({ blockedActions: 2 }) }), NOW);
    expect(reasons.map((r) => r.key)).toContain("blocked");
  });

  it("flags a blocked milestone", () => {
    const reasons = deriveInitiativeAttention(
      summary({ milestones: [milestone({ status: "blocked" })] }),
      NOW
    );
    expect(reasons.map((r) => r.key)).toContain("blocked");
  });

  it("flags an overdue (behind-schedule) next milestone", () => {
    const reasons = deriveInitiativeAttention(
      summary({ milestones: [milestone({ behindSchedule: true, targetDateISO: "2026-06-01" })] }),
      NOW
    );
    expect(reasons.map((r) => r.key)).toContain("overdue");
    expect(reasons.map((r) => r.key)).not.toContain("due_soon");
  });

  it("flags a past initiative target date", () => {
    const reasons = deriveInitiativeAttention(summary({ pastTargetDate: true }), NOW);
    expect(reasons.map((r) => r.key)).toContain("overdue");
  });

  it("flags a milestone due soon (within 14 days)", () => {
    const reasons = deriveInitiativeAttention(
      summary({ milestones: [milestone({ targetDateISO: "2026-06-20" })] }),
      NOW
    );
    expect(reasons.map((r) => r.key)).toContain("due_soon");
  });

  it("does not flag a milestone due far in the future", () => {
    const reasons = deriveInitiativeAttention(
      summary({ milestones: [milestone({ targetDateISO: "2026-12-01" })] }),
      NOW
    );
    expect(reasons.map((r) => r.key)).not.toContain("due_soon");
  });

  it("flags no next action when work is incomplete but nothing is open", () => {
    const reasons = deriveInitiativeAttention(summary({ counts: counts({ openActions: 0 }) }), NOW);
    expect(reasons.map((r) => r.key)).toContain("no_next_action");
  });

  it("does not flag no next action for a planning initiative", () => {
    const reasons = deriveInitiativeAttention(
      summary({ status: "planning", counts: counts({ openActions: 0 }) }),
      NOW
    );
    expect(reasons.map((r) => r.key)).not.toContain("no_next_action");
  });

  it("flags a missing owner", () => {
    expect(
      deriveInitiativeAttention(summary({ owner: null }), NOW).map((r) => r.key)
    ).toContain("owner_missing");
    expect(
      deriveInitiativeAttention(
        summary({ ownership: { clarity: "unowned" } as InitiativeSummary["ownership"] }),
        NOW
      ).map((r) => r.key)
    ).toContain("owner_missing");
  });

  it("flags waiting on meeting follow-up", () => {
    const reasons = deriveInitiativeAttention(
      summary({ counts: counts({ openFollowUps: 1, decisionsWithoutAction: 2 }) }),
      NOW
    );
    expect(reasons.map((r) => r.key)).toContain("meeting_follow_up");
  });

  it("orders the most urgent reason first", () => {
    const top = topAttentionReason(
      summary({ counts: counts({ blockedActions: 1, openFollowUps: 1 }), owner: null }),
      NOW
    );
    expect(top?.key).toBe("blocked");
  });
});

describe("connection helpers", () => {
  it("nextOpenMilestone returns the first incomplete milestone", () => {
    const s = summary({
      milestones: [
        milestone({ id: "m1", status: "complete" }),
        milestone({ id: "m2", status: "in_progress", title: "Scale" }),
      ],
    });
    expect(nextOpenMilestone(s)?.id).toBe("m2");
  });

  it("nextOpenMilestone returns null when all complete", () => {
    expect(nextOpenMilestone(summary({ milestones: [milestone({ status: "complete" })] }))).toBeNull();
  });

  it("primaryNextStep prefers the top recommendation", () => {
    const s = summary({
      recommendations: [
        { id: "r1", title: "Assign an owner", detail: "", kind: "ownership", severity: "warning", href: "#", score: 9 },
      ],
    });
    expect(primaryNextStep(s)).toBe("Assign an owner");
  });

  it("primaryNextStep falls back to the next milestone", () => {
    expect(primaryNextStep(summary({ milestones: [milestone({ title: "Run pilot" })] }))).toContain("Run pilot");
  });

  it("lastMeetingEvent / nextMeetingEvent read the timeline", () => {
    const s = summary({
      timeline: {
        events: [meetingEvent("past", "2026-06-01T00:00:00.000Z", false)],
        upcoming: [meetingEvent("future", "2026-06-20T00:00:00.000Z", true)],
        keyMoments: [],
      },
    });
    expect(lastMeetingEvent(s)?.id).toBe("meeting:past");
    expect(nextMeetingEvent(s)?.id).toBe("meeting:future");
    expect(lastMeetingEvent(summary())).toBeNull();
  });
});
