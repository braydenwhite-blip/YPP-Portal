import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActionInboxGroups } from "@/components/people-strategy/action-inbox-groups";
import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";

const NOW = new Date("2026-06-09T12:00:00");
type Assignment = ActionItemWithRelations["assignments"][number];
function person(id: string) {
  return { id, name: id, email: `${id}@x.org`, primaryRole: "ADMIN", profile: null };
}
function assignment(userId: string, role: Assignment["role"]): Assignment {
  return { id: `${userId}-${role}`, role, createdAt: NOW, user: person(userId) } as Assignment;
}
function item(overrides: Partial<ActionItemWithRelations>): ActionItemWithRelations {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Confirm the venue contract",
    description: null,
    goalCategory: null,
    departmentId: "d1",
    status: "IN_PROGRESS",
    priority: "MEDIUM",
    deadlineStart: new Date("2026-06-12T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    visibility: "ALL_LEADERSHIP",
    leadId: "alice",
    officerMeetingId: null,
    flaggedAt: null,
    escalatedToLeadershipAt: null,
    resolvedAt: null,
    boardRolledUpAt: null,
    createdById: "alice",
    createdAt: new Date("2026-05-01T00:00:00"),
    updatedAt: new Date("2026-06-08T00:00:00"),
    sourceType: null,
    sourceId: null,
    sourceActionId: null,
    strategicInitiativeId: null,
    strategicProjectId: null,
    successDefinition: "Signed",
    blockedReason: null,
    completionNote: null,
    completionOutcome: null,
    nextFollowUpAt: null,
    department: { id: "d1", name: "Instruction", slug: "instruction" },
    lead: person("alice"),
    createdBy: person("alice"),
    assignments: [assignment("alice", "LEAD"), assignment("bob", "EXECUTING")],
    comments: [],
    fileLinks: [],
    ...overrides,
  } as ActionItemWithRelations;
}

describe("ActionInboxGroups", () => {
  it("renders ranked triage lenses with item rows", () => {
    render(
      <ActionInboxGroups
        items={[
          item({ id: "b", title: "Unblock the vendor", status: "BLOCKED" }),
          item({ id: "u", title: "Email the coordinator", assignments: [assignment("alice", "LEAD")] }),
          item({ id: "s", title: "Stale outreach", updatedAt: new Date("2026-05-01T00:00:00") }),
        ]}
        now={NOW}
      />
    );
    expect(screen.getByText("Operational inbox")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("No owner")).toBeInTheDocument();
    expect(screen.getByText("Stale")).toBeInTheDocument();
    // The blocked item surfaces in more than one lens (needs attention + blocked).
    const links = screen.getAllByRole("link", { name: "Unblock the vendor" });
    expect(links.length).toBeGreaterThan(0);
    expect(links[0]).toHaveAttribute("href", "/actions/b");
  });

  it("shows a clean-board empty state when nothing needs triage", () => {
    render(
      <ActionInboxGroups
        items={[item({ status: "IN_PROGRESS", deadlineStart: new Date("2026-08-01T00:00:00") })]}
        now={NOW}
      />
    );
    expect(screen.getByText(/Clean board/)).toBeInTheDocument();
  });
});
