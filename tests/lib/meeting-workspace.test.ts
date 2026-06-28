import { describe, expect, it } from "vitest";

import { assessMeetingWorkspace, workspaceCompletionPercent } from "@/lib/weekly-meetings/meeting-workspace";
import type { MeetingDetail } from "@/lib/weekly-meetings/meeting-types";

function baseMeeting(overrides: Partial<MeetingDetail> = {}): MeetingDetail {
  return {
    id: "m1",
    type: "GENERIC",
    typeLabel: "Meeting",
    status: "SCHEDULED",
    title: "Partner intro",
    purpose: null,
    scheduledISO: new Date().toISOString(),
    notes: null,
    agenda: null,
    proposal: null,
    nextSteps: null,
    outcome: null,
    facilitator: null,
    partner: null,
    partnerDetail: null,
    scopeLabel: null,
    weekKey: null,
    weekLabel: null,
    attendees: [],
    presentations: [],
    impactCoverage: null,
    officerTopics: [],
    decisions: [],
    followUps: [],
    boardRows: [],
    boardTopics: [],
    linkedActions: [],
    chapterContext: null,
    ...overrides,
  };
}

describe("meeting-workspace", () => {
  it("flags incomplete workspace fields", () => {
    const checks = assessMeetingWorkspace(baseMeeting());
    expect(checks.find((c) => c.key === "agenda")?.complete).toBe(false);
    expect(checks.find((c) => c.key === "owner")?.complete).toBe(false);
    expect(workspaceCompletionPercent(checks)).toBeLessThan(50);
  });

  it("marks complete when all workspace fields are filled", () => {
    const checks = assessMeetingWorkspace(
      baseMeeting({
        agenda: "1. Intro\n2. Proposal",
        proposal: "Summer workshop at Lincoln MS",
        notes: "Good conversation",
        nextSteps: "Send contract",
        outcome: "Interested — scheduling follow-up",
        facilitator: { id: "u1", name: "Alex" },
        partner: { id: "p1", name: "Lincoln Middle School" },
        followUps: [
          {
            id: "f1",
            title: "Send proposal PDF",
            detail: null,
            status: "OPEN",
            dueISO: null,
            owner: { id: "u1", name: "Alex" },
            linkedActionId: null,
          },
        ],
      }),
    );
    expect(workspaceCompletionPercent(checks)).toBe(100);
  });
});
