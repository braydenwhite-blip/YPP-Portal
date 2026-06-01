import { describe, expect, it } from "vitest";

import {
  buildOfficerMeetingAgendaFallback,
  buildOfficerMeetingSummaryFallback,
  canGenerateSummaryEmail,
  missingDiscussionNotes,
  type OfficerMeetingForGeneration,
} from "@/lib/people-strategy/officer-meeting-generation";

const MEETING_DATE = new Date("2026-06-15T14:30:00");

function meeting(
  overrides: Partial<OfficerMeetingForGeneration> = {}
): OfficerMeetingForGeneration {
  return {
    date: MEETING_DATE,
    actionItems: [
      {
        title: "Launch onboarding revamp",
        status: "IN_PROGRESS",
        deadlineStart: new Date("2026-06-20T00:00:00"),
        deadlineEnd: null,
        departmentName: "People",
        leadName: "Ada Lovelace",
        goalCategory: "Retention",
        assignees: [
          { role: "EXECUTING", name: "Grace Hopper" },
          { role: "LEAD", name: "Ada Lovelace" },
          { role: "INPUT", name: "Alan Turing" },
        ],
        discussionNotes: "Agreed to ship the new flow next sprint.",
      },
    ],
    miscUpdates: [{ body: "Budget approved for Q3", addedByName: "CPO" }],
    ...overrides,
  };
}

describe("buildOfficerMeetingAgendaFallback", () => {
  it("composes date, action items, statuses, deadlines, assignees and misc updates", () => {
    const text = buildOfficerMeetingAgendaFallback(meeting());

    expect(text).toContain("Officer Meeting Agenda");
    expect(text).toContain("Monday, Jun 15, 2026 at 2:30 PM");
    expect(text).toContain("1. Action Items for Discussion (1)");
    expect(text).toContain("1. Launch onboarding revamp");
    expect(text).toContain("Status: In progress · Due Jun 20, 2026");
    expect(text).toContain("Department: People · Goal: Retention");
    expect(text).toContain("Lead: Ada Lovelace");
    // Assignees ordered Lead → Executing → Input regardless of input order.
    expect(text).toContain(
      "Lead: Ada Lovelace · Executing: Grace Hopper · Input: Alan Turing"
    );
    expect(text).toContain(
      "Discussion notes: Agreed to ship the new flow next sprint."
    );
    expect(text).toContain("2. Miscellaneous Updates (1)");
    expect(text).toContain("• Budget approved for Q3 (CPO)");
  });

  it("is deterministic — identical input yields identical output", () => {
    expect(buildOfficerMeetingAgendaFallback(meeting())).toBe(
      buildOfficerMeetingAgendaFallback(meeting())
    );
  });

  it("handles an empty meeting and items without notes", () => {
    const text = buildOfficerMeetingAgendaFallback(
      meeting({ actionItems: [], miscUpdates: [] })
    );
    expect(text).toContain("No action items linked yet.");
    expect(text).toContain("No miscellaneous updates.");

    const noNotes = buildOfficerMeetingAgendaFallback(
      meeting({
        actionItems: [{ ...meeting().actionItems[0], discussionNotes: "" }],
      })
    );
    expect(noNotes).toContain("Discussion notes: (none yet)");
  });
});

describe("summary-email readiness", () => {
  it("reports items missing notes", () => {
    const m = meeting({
      actionItems: [
        { ...meeting().actionItems[0], title: "A", discussionNotes: "done" },
        { ...meeting().actionItems[0], title: "B", discussionNotes: "   " },
      ],
    });
    expect(missingDiscussionNotes(m)).toEqual(["B"]);
    expect(canGenerateSummaryEmail(m)).toBe(false);
  });

  it("is ready when all items have notes (or there are none)", () => {
    expect(canGenerateSummaryEmail(meeting())).toBe(true);
    expect(canGenerateSummaryEmail(meeting({ actionItems: [] }))).toBe(true);
  });
});

describe("buildOfficerMeetingSummaryFallback", () => {
  it("throws while any linked item is missing notes", () => {
    const m = meeting({
      actionItems: [{ ...meeting().actionItems[0], discussionNotes: "" }],
    });
    expect(() => buildOfficerMeetingSummaryFallback(m)).toThrow(
      /until every action item has discussion notes/
    );
  });

  it("composes a recap once every item has notes", () => {
    const text = buildOfficerMeetingSummaryFallback(meeting());

    expect(text).toContain("Subject: Officer Meeting Recap — Jun 15, 2026");
    expect(text).toContain("Action Items Discussed");
    expect(text).toContain("1. Launch onboarding revamp");
    expect(text).toContain("Discussion: Agreed to ship the new flow next sprint.");
    expect(text).toContain("• Budget approved for Q3 — CPO");
  });

  it("is deterministic", () => {
    expect(buildOfficerMeetingSummaryFallback(meeting())).toBe(
      buildOfficerMeetingSummaryFallback(meeting())
    );
  });
});
