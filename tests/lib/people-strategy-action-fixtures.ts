import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

/**
 * Shared test fixtures for the Action Tracker pure selectors. Not a spec file
 * (no `.test`/`.spec` suffix) so Vitest never runs it directly — it only feeds
 * the next-cta / operating-board / context-label suites a realistic row.
 */

export const NOW = new Date("2026-06-15T12:00:00Z");

type Assignment = ActionItemWithRelations["assignments"][number];
type Comment = ActionItemWithRelations["comments"][number];

export function person(id: string) {
  return {
    id,
    name: id,
    email: `${id}@x.org`,
    primaryRole: "ADMIN",
    title: null,
    adminSubtypes: [],
    profile: null,
  };
}

export function assignment(userId: string, role: Assignment["role"]): Assignment {
  return { id: `${userId}-${role}`, role, createdAt: NOW, user: person(userId) } as Assignment;
}

export function comment(
  authorId: string,
  type: Comment["type"],
  createdAt: Date = NOW,
  body = "note"
): Comment {
  return { id: `c-${authorId}-${type}`, body, type, createdAt, author: person(authorId) } as Comment;
}

export function actionItem(
  overrides: Partial<ActionItemWithRelations> = {}
): ActionItemWithRelations {
  return {
    id: "action-1",
    title: "Follow up with the Mohawk Day Camp partner",
    description: null,
    goalCategory: null,
    actionType: null,
    departmentId: null,
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-30T00:00:00Z"),
    deadlineEnd: null,
    completedAt: null,
    visibility: "ALL_LEADERSHIP",
    leadId: "lead-1",
    officerMeetingId: null,
    createdById: "lead-1",
    createdAt: NOW,
    updatedAt: NOW,
    sourceType: null,
    sourceId: null,
    sourceActionId: null,
    strategicInitiativeId: null,
    strategicProjectId: null,
    flaggedAt: null,
    escalatedToLeadershipAt: null,
    resolvedAt: null,
    boardRolledUpAt: null,
    successDefinition: "Partner confirms summer dates",
    blockedReason: null,
    completionNote: null,
    completionOutcome: null,
    nextFollowUpAt: null,
    relatedEntityType: null,
    relatedEntityId: null,
    department: null,
    lead: person("lead-1"),
    createdBy: person("lead-1"),
    officerMeeting: null,
    assignments: [assignment("lead-1", "LEAD"), assignment("owner-1", "EXECUTING")],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as ActionItemWithRelations;
}
