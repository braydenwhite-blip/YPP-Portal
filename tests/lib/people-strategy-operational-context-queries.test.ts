import { describe, expect, it, vi } from "vitest";

// The query module imports prisma + feature flags at the top level; the pure
// derivations under test don't touch them, but mock so importing never spins up
// a real client.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { MeetingCardDTO } from "@/lib/people-strategy/meeting-card-types";
import {
  combineHealthSignals,
  deriveActionSignals,
  deriveMeetingSignals,
  deriveOperationalHealth,
} from "@/lib/people-strategy/operational-context-queries";

// Thursday of the operating week starting Mon Jun 1 2026.
const NOW = new Date("2026-06-04T12:00:00");

type Assignment = ActionItemWithRelations["assignments"][number];

function assignment(userId: string, role: Assignment["role"]): Assignment {
  return {
    id: `${userId}-${role}`,
    role,
    createdAt: NOW,
    user: { id: userId, name: userId, email: `${userId}@x.org`, primaryRole: "ADMIN", profile: null },
  } as Assignment;
}

function action(overrides: Partial<ActionItemWithRelations>): ActionItemWithRelations {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Item",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-10T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    leadId: "alice",
    flaggedAt: null,
    resolvedAt: null,
    createdAt: new Date("2026-05-01T00:00:00"),
    updatedAt: new Date("2026-06-03T00:00:00"),
    assignments: [assignment("alice", "LEAD"), assignment("bob", "EXECUTING")],
    comments: [],
    ...overrides,
  } as ActionItemWithRelations;
}

function meetingCard(overrides: Partial<MeetingCardDTO>): MeetingCardDTO {
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
    relatedEntityType: "CLASS_OFFERING",
    relatedEntityId: "cls1",
    ...overrides,
  };
}

describe("deriveActionSignals", () => {
  it("counts open / overdue / blocked / unassigned, ignoring settled work", () => {
    const actions = [
      action({ deadlineStart: new Date("2026-05-25T00:00:00") }), // overdue, has executor
      action({ status: "BLOCKED" }), // blocked, open
      action({ assignments: [assignment("alice", "LEAD")] }), // open, no executor
      action({ status: "COMPLETE" }), // settled — excluded
      action({ status: "DROPPED" }), // settled — excluded
    ];
    const s = deriveActionSignals(actions, NOW);
    expect(s.open).toBe(3); // overdue + blocked + unowned
    expect(s.overdue).toBe(1);
    expect(s.blocked).toBe(1);
    expect(s.unassigned).toBe(1);
  });

  it("flags stale open actions by last-update age", () => {
    const fresh = action({ updatedAt: new Date("2026-06-03T00:00:00") });
    const stale = action({ updatedAt: new Date("2026-05-01T00:00:00") }); // >14 days
    const s = deriveActionSignals([fresh, stale], NOW);
    expect(s.stale).toBe(1);
    expect(s.open).toBe(2);
  });

  it("is all-zero for an empty set", () => {
    expect(deriveActionSignals([], NOW)).toEqual({
      open: 0,
      overdue: 0,
      blocked: 0,
      unassigned: 0,
      stale: 0,
    });
  });
});

describe("deriveMeetingSignals", () => {
  it("sums follow-ups and counts meetings needing follow-up", () => {
    const meetings = [
      meetingCard({ openFollowUps: 2, overdueFollowUps: 1, effectiveStatus: "needs_follow_up" }),
      meetingCard({ openFollowUps: 1, overdueFollowUps: 0, effectiveStatus: "needs_follow_up" }),
      meetingCard({ openFollowUps: 0, overdueFollowUps: 0, effectiveStatus: "completed" }),
    ];
    const s = deriveMeetingSignals(meetings);
    expect(s.openFollowUps).toBe(3);
    expect(s.overdueFollowUps).toBe(1);
    expect(s.meetingsNeedingFollowUp).toBe(2);
  });
});

describe("combineHealthSignals", () => {
  it("maps the two signal shapes into the health-input shape", () => {
    const combined = combineHealthSignals(
      { open: 4, overdue: 2, blocked: 1, unassigned: 1, stale: 0 },
      { openFollowUps: 3, overdueFollowUps: 1, meetingsNeedingFollowUp: 1 }
    );
    expect(combined).toEqual({
      openActions: 4,
      overdueActions: 2,
      blockedActions: 1,
      unassignedActions: 1,
      staleActions: 0,
      openFollowUps: 3,
      overdueFollowUps: 1,
      meetingsNeedingFollowUp: 1,
    });
  });
});

describe("deriveOperationalHealth", () => {
  it("is healthy when there is no open work anywhere", () => {
    const h = deriveOperationalHealth(
      [action({ status: "COMPLETE" })],
      [meetingCard({ effectiveStatus: "completed" })],
      NOW
    );
    expect(h.level).toBe("healthy");
  });

  it("escalates from combined action + meeting signals", () => {
    const actions = [
      action({ deadlineStart: new Date("2026-05-20T00:00:00") }),
      action({ deadlineStart: new Date("2026-05-21T00:00:00") }),
      action({ deadlineStart: new Date("2026-05-22T00:00:00") }),
    ];
    const meetings = [
      meetingCard({ openFollowUps: 1, overdueFollowUps: 1, effectiveStatus: "needs_follow_up" }),
    ];
    const h = deriveOperationalHealth(actions, meetings, NOW);
    expect(h.level).toBe("critical"); // 3 overdue actions
    expect(h.reasons[0]).toBe("3 overdue actions");
  });
});
