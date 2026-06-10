import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/people-strategy/meetings-actions", () => ({
  addDecision: vi.fn(),
  addFollowUp: vi.fn(),
  createMeeting: vi.fn(),
  saveMeetingNotes: vi.fn(),
}));

import { WeeklyExecutionOSView } from "@/components/people-strategy/weekly-execution";
import type { WeeklyExecutionOS } from "@/lib/people-strategy/weekly-execution";

const people = [{ id: "u1", name: "Brayden" }];

function osFixture(overrides: Partial<WeeklyExecutionOS> = {}): WeeklyExecutionOS {
  const os: WeeklyExecutionOS = {
    snapshot: {
      urgent: 2,
      blocked: 1,
      dueThisWeek: 1,
      meetingsThisWeek: 1,
      decisionsNeeded: 1,
      communicationsNeeded: 1,
      initiativesNeedingAttention: 1,
    },
    agendaSections: [
      {
        id: "urgent_blockers",
        title: "Urgent blockers",
        items: [
          {
            id: "action:blocked",
            sectionId: "urgent_blockers",
            title: "Blocked: clarify STEM curriculum direction",
            why: "Instructor accepted but curriculum direction is unclear.",
            owner: "Brayden",
            dueISO: "2026-06-12T00:00:00.000Z",
            relatedMeetingTitle: "Officer meeting",
            relatedEntityLabel: "Lily",
            href: "/actions/blocked",
            suggestedDiscussionQuestion: "Should Lily build rockets/planes or broader K-5 STEM?",
            suggestedNextAction: "Brayden confirms direction and emails Lily.",
          },
        ],
      },
      {
        id: "initiatives",
        title: "Initiatives needing attention",
        items: [
          {
            id: "initiative:camp-stem",
            sectionId: "initiatives",
            title: "Camp / STEM Curriculum Launch",
            why: "Curriculum direction needs confirmation.",
            owner: "Brayden",
            dueISO: null,
            relatedMeetingTitle: null,
            relatedEntityLabel: null,
            href: "/operations/initiatives/camp-stem",
            suggestedDiscussionQuestion: "What must happen this week to move camp STEM forward?",
            suggestedNextAction: "Confirm class framing.",
            initiativeTitle: "Camp / STEM Curriculum Launch",
          },
        ],
      },
      {
        id: "due_this_week",
        title: "Due this week",
        items: [
          {
            id: "action:due",
            sectionId: "due_this_week",
            title: "Draft instructor training plan",
            why: "Due this week.",
            owner: "Brayden",
            dueISO: "2026-06-14T00:00:00.000Z",
            relatedMeetingTitle: null,
            relatedEntityLabel: null,
            href: "/actions/due",
            suggestedDiscussionQuestion: "Is the plan still the right next move?",
            suggestedNextAction: "Finish the draft.",
          },
        ],
      },
      { id: "decisions_needed", title: "Decisions needed", items: [] },
      { id: "follow_ups_not_captured", title: "Follow-ups not captured", items: [] },
      { id: "people_partner_issues", title: "People / partner issues", items: [] },
      { id: "communication_needed", title: "Communication needed", items: [] },
    ],
    looseEnds: [
      {
        id: "follow-up:f1",
        title: "Message Lily about Friday 4 PM",
        kind: "missing_owner",
        why: "Follow-up has no owner.",
        owner: null,
        dueISO: null,
        meetingTitle: "Officer meeting",
        href: "/actions/meetings/m1",
      },
    ],
    communications: [
      {
        id: "communication:lily",
        title: "Clarify STEM curriculum direction",
        audience: "instructor",
        contactLabel: "Lily",
        why: "Instructor needs confirmation before training.",
        suggestedMessage: "Confirm whether Friday 4 PM works and ask for 2-3 STEM ideas.",
        owner: "Brayden",
        href: "/actions/blocked",
        source: "action",
      },
    ],
    initiativesNeedingAttention: [
      {
        id: "initiative:camp-stem",
        title: "Camp / STEM Curriculum Launch",
        owner: "Brayden",
        status: "At risk",
        priority: "Flagship",
        currentMilestone: "Confirm STEM class framing",
        why: "Curriculum direction needs confirmation.",
        href: "/operations/initiatives/camp-stem",
        suggestedDiscussionQuestion: "Should Lily build rockets/planes or broader K-5 STEM?",
        suggestedNextAction: "Confirm class framing.",
      },
    ],
    recap: {
      draft: [
        "Hi team,",
        "",
        "Here is the weekly YPP operations recap.",
        "",
        "Initiative updates:",
        "- Camp / STEM Curriculum Launch: curriculum direction needs confirmation.",
      ].join("\n"),
      completed: [],
      newActions: [],
      overdue: [],
      blocked: [],
      decisions: [],
      meetings: [],
      openFollowUps: [],
      topPriorities: [],
      initiatives: [],
    },
  };
  return { ...os, ...overrides };
}

describe("WeeklyExecutionOSView", () => {
  it("renders the weekly execution sections and operational content", () => {
    render(<WeeklyExecutionOSView os={osFixture()} people={people} currentUserId="u1" />);

    expect(screen.getByText("Agenda")).toBeInTheDocument();
    expect(screen.getByText("Meeting Capture")).toBeInTheDocument();
    expect(screen.getByText("Loose Ends")).toBeInTheDocument();
    expect(screen.getByText("Weekly Recap")).toBeInTheDocument();
    expect(screen.getByText("Initiatives Needing Attention")).toBeInTheDocument();
    expect(screen.getByText("Communication Needed")).toBeInTheDocument();

    expect(screen.getByText("Blocked: clarify STEM curriculum direction")).toBeInTheDocument();
    expect(screen.getByText("Draft instructor training plan")).toBeInTheDocument();
    expect(screen.getByText("Message Lily about Friday 4 PM")).toBeInTheDocument();
    expect(screen.getByText("Lily - Clarify STEM curriculum direction")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Here is the weekly YPP operations recap/)).toBeInTheDocument();
  });

  it("renders a copyable weekly recap draft", () => {
    render(<WeeklyExecutionOSView os={osFixture()} people={people} currentUserId="u1" />);
    const draft = screen.getByLabelText("Weekly recap draft");
    expect((draft as HTMLTextAreaElement).value).toContain("Initiative updates:");
  });

  it("shows simple empty states when queues are clear", () => {
    const empty = osFixture({
      agendaSections: osFixture().agendaSections.map((section) => ({ ...section, items: [] })),
      looseEnds: [],
      communications: [],
      initiativesNeedingAttention: [],
    });
    render(<WeeklyExecutionOSView os={empty} people={people} currentUserId="u1" />);
    const looseEnds = screen.getByText("Loose Ends").closest("section")!;
    expect(within(looseEnds).getByText(/No loose ends/)).toBeInTheDocument();
    const communication = screen.getByText("Communication Needed").closest("section")!;
    expect(within(communication).getByText(/No communication items/)).toBeInTheDocument();
    expect(screen.getByText(/No strategic initiatives need officer discussion/)).toBeInTheDocument();
  });
});
