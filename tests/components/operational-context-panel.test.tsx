import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { MeetingCardDTO } from "@/lib/people-strategy/meetings-queries";
import { computeOperationalHealth } from "@/lib/people-strategy/operational-context";
import { OperationalContextPanel } from "@/components/people-strategy/operational-context-panel";
import { RelatedMeetingsList } from "@/components/people-strategy/related-meetings-list";
import {
  OperationalHealthBadge,
  RelatedEntityBadge,
  SourceMeetingBadge,
} from "@/components/people-strategy/operational-badges";

const NOW = new Date("2026-06-09T12:00:00");

function meeting(overrides: Partial<MeetingCardDTO> = {}): MeetingCardDTO {
  return {
    id: "m1",
    title: "Classes Operations Check-In",
    purpose: null,
    category: "CLASSES",
    categoryLabel: "Classes",
    priority: "MEDIUM",
    startISO: "2026-06-05T18:00:00.000Z",
    endISO: null,
    durationLabel: null,
    recurrence: null,
    location: null,
    facilitator: { id: "u1", name: "Brayden White", initials: "BW" },
    attendeeCount: 3,
    participantIds: ["u1"],
    effectiveStatus: "needs_follow_up",
    agendaCount: 2,
    agendaDoneCount: 1,
    decisionCount: 1,
    openFollowUps: 2,
    overdueFollowUps: 1,
    openLinkedActions: 1,
    linkedActionCount: 2,
    relatedEntityType: "CLASS_OFFERING",
    relatedEntityId: "cls1",
    ...overrides,
  };
}

function action(overrides: Partial<ActionItemWithRelations> = {}): ActionItemWithRelations {
  return {
    id: "a1",
    title: "Finalize class description",
    status: "IN_PROGRESS",
    priority: "HIGH",
    deadlineStart: new Date("2026-06-12T00:00:00"),
    deadlineEnd: null,
    completedAt: null,
    leadId: "u2",
    officerMeetingId: null,
    lead: { id: "u2", name: "Ian D", email: "ian@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null },
    officerMeeting: null,
    assignments: [{ id: "x", role: "EXECUTING", createdAt: NOW, user: { id: "u2", name: "Ian D", email: "ian@x.org", primaryRole: "ADMIN", title: null, adminSubtypes: [], profile: null } }],
    comments: [],
    ...overrides,
  } as unknown as ActionItemWithRelations;
}

describe("OperationalContextPanel", () => {
  it("renders the title, health, related meetings, and open actions", () => {
    render(
      <OperationalContextPanel
        title="Class Operations"
        subtitle="Sports Business 101"
        health={computeOperationalHealth({ openActions: 1, overdueFollowUps: 1 })}
        meetings={[meeting()]}
        actions={[action()]}
        now={NOW}
      />
    );
    expect(screen.getByRole("heading", { name: "Class Operations" })).toBeInTheDocument();
    expect(screen.getByText("Sports Business 101")).toBeInTheDocument();
    expect(screen.getByText("Related meetings")).toBeInTheDocument();
    expect(screen.getByText("Open actions")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Classes Operations Check-In" })).toHaveAttribute(
      "href",
      "/actions/meetings/m1"
    );
    expect(screen.getByRole("link", { name: "Finalize class description" })).toHaveAttribute(
      "href",
      "/actions/a1"
    );
    // At-risk health (an overdue follow-up) renders its label.
    expect(screen.getByText("At risk")).toBeInTheDocument();
  });

  it("shows a connected empty state and create CTAs when nothing is linked", () => {
    render(
      <OperationalContextPanel
        title="Class Operations"
        health={computeOperationalHealth({})}
        meetings={[]}
        actions={[]}
        canCreate
        createActionHref="/actions/new?relatedType=CLASS_OFFERING&relatedId=cls1"
        createMeetingHref="/actions/meetings?new=1"
        now={NOW}
      />
    );
    expect(screen.getByText(/Nothing is connected here yet/i)).toBeInTheDocument();
    expect(screen.getByText("Healthy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create action" })).toHaveAttribute(
      "href",
      "/actions/new?relatedType=CLASS_OFFERING&relatedId=cls1"
    );
    expect(screen.getByRole("link", { name: "Schedule meeting" })).toBeInTheDocument();
  });

  it("surfaces a source-meeting badge on actions generated from a meeting", () => {
    render(
      <OperationalContextPanel
        title="Class Operations"
        health={computeOperationalHealth({ openActions: 1 })}
        meetings={[]}
        actions={[
          action({
            officerMeetingId: "m9",
            officerMeeting: { id: "m9", title: "Kickoff", date: new Date("2026-06-01T00:00:00"), category: "CLASSES" } as ActionItemWithRelations["officerMeeting"],
          }),
        ]}
        now={NOW}
      />
    );
    expect(screen.getByText(/Source: Meeting/i)).toBeInTheDocument();
  });
});

describe("RelatedMeetingsList", () => {
  it("lists meetings with a follow-up summary", () => {
    render(<RelatedMeetingsList meetings={[meeting()]} />);
    expect(screen.getByText("Related meetings")).toBeInTheDocument();
    expect(screen.getByText(/1 need follow-up/)).toBeInTheDocument();
    expect(screen.getByText("Needs follow-up")).toBeInTheDocument();
  });

  it("renders the empty state", () => {
    render(<RelatedMeetingsList meetings={[]} emptyHint="No meetings yet." />);
    expect(screen.getByText("No meetings yet.")).toBeInTheDocument();
  });
});

describe("operational badges", () => {
  it("links a related entity to its page", () => {
    render(<RelatedEntityBadge type="CLASS_OFFERING" label="Algebra 101" href="/admin/classes/cls1" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/admin/classes/cls1");
    expect(link).toHaveTextContent("Class · Algebra 101");
  });

  it("links a source meeting back to its workspace", () => {
    render(<SourceMeetingBadge id="m1" title="Sync" dateISO="2026-06-05T00:00:00.000Z" />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/actions/meetings/m1");
  });

  it("labels operational health", () => {
    render(<OperationalHealthBadge health={computeOperationalHealth({ overdueActions: 4 })} withReasons />);
    expect(screen.getByText("Critical")).toBeInTheDocument();
    expect(screen.getByText(/overdue actions/)).toBeInTheDocument();
  });
});
