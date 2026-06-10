import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionCard } from "@/components/people-strategy/action-card";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

function action(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: "a1",
    title: "Clarify Lily STEM curriculum direction",
    description: "Instructor accepted but curriculum framing is unclear.",
    goalCategory: "Summer Camps 2026",
    actionType: "CURRICULUM",
    departmentId: null,
    leadId: "u1",
    createdById: "u1",
    status: "IN_PROGRESS",
    priority: "HIGH",
    completedAt: null,
    visibility: "ALL_LEADERSHIP",
    deadlineStart: new Date("2026-06-12T00:00:00.000Z"),
    deadlineEnd: null,
    officerMeetingId: null,
    relatedEntityType: null,
    relatedEntityId: null,
    sourceType: "INITIATIVE",
    sourceId: null,
    sourceActionId: null,
    strategicInitiativeId: "summer-camps-2026",
    strategicProjectId: null,
    successDefinition: null,
    blockedReason: null,
    completionNote: null,
    completionOutcome: null,
    nextFollowUpAt: null,
    flaggedAt: null,
    createdAt: new Date("2026-06-09T00:00:00.000Z"),
    updatedAt: new Date("2026-06-09T00:00:00.000Z"),
    lead: {
      id: "u1",
      name: "Brayden",
      email: "brayden@ypp.org",
      primaryRole: "ADMIN",
      title: "Leadership",
      adminSubtypes: [],
      profile: { avatarUrl: null },
    },
    createdBy: {
      id: "u1",
      name: "Brayden",
      email: "brayden@ypp.org",
      primaryRole: "ADMIN",
      title: "Leadership",
      adminSubtypes: [],
      profile: { avatarUrl: null },
    },
    department: null,
    officerMeeting: null,
    assignments: [],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as unknown as ActionItemWithRelations;
}

describe("ActionCard", () => {
  it("shows related initiative context on action cards", () => {
    render(<ActionCard item={action()} now={new Date("2026-06-10T12:00:00.000Z")} />);
    expect(screen.getByText("Initiative: Summer Camps 2026")).toBeInTheDocument();
  });
});
