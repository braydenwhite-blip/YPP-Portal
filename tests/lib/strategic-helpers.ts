import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import type { DigestDecisionInput } from "@/lib/people-strategy/operational-digest";
import type { RelatedEntitySummary } from "@/lib/people-strategy/connections";

/**
 * Shared, DB-free fixtures for the Strategic Initiatives derivation tests.
 * Mirrors the factories the operational-digest test uses so "overdue" / "blocked"
 * / "complete" mean exactly the same thing here. Not a test file (no `.test`
 * suffix), so vitest never runs it directly.
 */

// Thursday of the operating week Mon Jun 1 – Sun Jun 7, 2026.
export const NOW = new Date("2026-06-04T12:00:00");

type Assignment = ActionItemWithRelations["assignments"][number];

export function assignment(userId: string, role: Assignment["role"]): Assignment {
  return {
    id: `${userId}-${role}`,
    role,
    createdAt: NOW,
    user: {
      id: userId,
      name: userId,
      email: `${userId}@x.org`,
      primaryRole: "ADMIN",
      title: null,
      adminSubtypes: [],
      profile: null,
    },
  } as Assignment;
}

export function action(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Item",
    description: null,
    goalCategory: null,
    actionType: null,
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-10T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    leadId: "alice",
    lead: {
      id: "alice",
      name: "Alice",
      email: "alice@x.org",
      primaryRole: "ADMIN",
      title: null,
      adminSubtypes: [],
      profile: null,
    },
    officerMeetingId: null,
    officerMeeting: null,
    relatedEntityType: null,
    relatedEntityId: null,
    flaggedAt: null,
    resolvedAt: null,
    createdAt: new Date("2026-05-20T00:00:00"),
    updatedAt: new Date("2026-06-03T00:00:00"),
    assignments: [assignment("alice", "LEAD"), assignment("bob", "EXECUTING")],
    comments: [],
    ...overrides,
  } as ActionItemWithRelations;
}

export function meetingCard(overrides: Partial<MeetingCardDTO> = {}): MeetingCardDTO {
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
    relatedEntityType: null,
    relatedEntityId: null,
    ...overrides,
  };
}

export function decision(overrides: Partial<DigestDecisionInput> = {}): DigestDecisionInput {
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

export function classLabel(id: string, label: string): [string, RelatedEntitySummary] {
  return [
    `CLASS_OFFERING:${id}`,
    { type: "CLASS_OFFERING", id, label, typeLabel: "Class", href: `/admin/classes/${id}` },
  ];
}

export function emptyLabels(): Map<string, RelatedEntitySummary> {
  return new Map();
}
