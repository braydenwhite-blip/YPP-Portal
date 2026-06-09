import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import type {
  DecisionContextDTO,
  FollowUpContextDTO,
} from "@/lib/people-strategy/operational-context-queries";
import { deriveOperationalTimeline } from "@/lib/people-strategy/operational-timeline";

const NOW = new Date("2026-06-09T12:00:00");

function meeting(overrides: Partial<MeetingCardDTO> = {}): MeetingCardDTO {
  return {
    id: "m1",
    title: "Class sync",
    purpose: null,
    category: "CLASSES",
    categoryLabel: "Classes",
    priority: "MEDIUM",
    startISO: "2026-06-01T18:00:00.000Z",
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
    decisionCount: 1,
    openFollowUps: 0,
    overdueFollowUps: 0,
    openLinkedActions: 0,
    linkedActionCount: 1,
    relatedEntityType: "CLASS_OFFERING",
    relatedEntityId: "cls1",
    ...overrides,
  };
}

function action(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: "a1",
    title: "Finalize roster",
    status: "IN_PROGRESS",
    completedAt: null,
    createdAt: new Date("2026-06-03T00:00:00"),
    updatedAt: new Date("2026-06-05T00:00:00"),
    lead: { id: "u1", name: "Alice", email: "a@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null },
    ...overrides,
  } as ActionItemWithRelations;
}

function decision(overrides: Partial<DecisionContextDTO> = {}): DecisionContextDTO {
  return {
    id: "d1",
    decision: "Cap the class at 20",
    meetingId: "m1",
    meetingTitle: "Class sync",
    createdISO: "2026-06-01T19:00:00.000Z",
    decidedByName: "Alice",
    ...overrides,
  };
}

function followUp(overrides: Partial<FollowUpContextDTO> = {}): FollowUpContextDTO {
  return {
    id: "f1",
    title: "Email the waitlist",
    meetingId: "m1",
    meetingTitle: "Class sync",
    dueISO: "2026-06-15T00:00:00.000Z",
    effectiveStatus: "open",
    ownerName: "Bob",
    areaLabel: "Classes",
    ...overrides,
  };
}

describe("deriveOperationalTimeline", () => {
  it("combines meetings, actions, decisions, and follow-ups newest-first", () => {
    const events = deriveOperationalTimeline({
      meetings: [meeting()],
      actions: [action()],
      decisions: [decision()],
      followUps: [followUp()],
      now: NOW,
    });
    const types = events.map((e) => e.type);
    expect(types).toContain("meeting");
    expect(types).toContain("action_created");
    expect(types).toContain("decision");
    expect(types).toContain("follow_up");
    // Newest first — the future-dated follow-up leads.
    expect(events[0].type).toBe("follow_up");
    // Strictly descending by occurredAt.
    for (let i = 1; i < events.length; i++) {
      expect(events[i - 1].occurredAt.getTime()).toBeGreaterThanOrEqual(events[i].occurredAt.getTime());
    }
  });

  it("emits a completion event in addition to creation for completed actions", () => {
    const events = deriveOperationalTimeline({
      meetings: [],
      actions: [action({ status: "COMPLETE", completedAt: new Date("2026-06-07T00:00:00") })],
      decisions: [],
      followUps: [],
      now: NOW,
    });
    expect(events.map((e) => e.type).sort()).toEqual(["action_completed", "action_created"]);
    const completed = events.find((e) => e.type === "action_completed");
    expect(completed?.severity).toBe("positive");
  });

  it("marks an overdue follow-up as critical", () => {
    const [event] = deriveOperationalTimeline({
      meetings: [],
      actions: [],
      decisions: [],
      followUps: [followUp({ effectiveStatus: "overdue", dueISO: "2026-06-01T00:00:00.000Z" })],
      now: NOW,
    });
    expect(event.severity).toBe("critical");
  });

  it("is empty for an entity with no history", () => {
    expect(
      deriveOperationalTimeline({ meetings: [], actions: [], decisions: [], followUps: [], now: NOW })
    ).toEqual([]);
  });

  it("respects an explicit limit", () => {
    const events = deriveOperationalTimeline({
      meetings: [meeting({ id: "m1" }), meeting({ id: "m2", startISO: "2026-06-02T18:00:00.000Z" })],
      actions: [action({ id: "a1" }), action({ id: "a2" })],
      decisions: [],
      followUps: [],
      now: NOW,
      limit: 2,
    });
    expect(events).toHaveLength(2);
  });
});
