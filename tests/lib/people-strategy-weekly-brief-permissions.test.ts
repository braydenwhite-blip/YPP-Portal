import { describe, expect, it } from "vitest";

import {
  canEditWeeklyBriefOverall,
  canEditWeeklyTaskUpdate,
  canFinalizeTeamMeeting,
  canManageOfficerMeetingOutputs,
  canPrepareOfficerPresentation,
  canViewWeeklyBrief,
} from "@/lib/people-strategy/weekly-brief-permissions";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";

function viewer(overrides: Partial<ActionViewer> = {}): ActionViewer {
  return {
    id: "member-1",
    roles: ["INSTRUCTOR"],
    primaryRole: "INSTRUCTOR",
    adminSubtypes: [],
    ...overrides,
  };
}

const action = {
  leadId: "owner-1",
  createdById: "creator-1",
  visibility: "ALL_LEADERSHIP" as const,
  assignments: [{ userId: "owner-1", role: "LEAD" as const }],
};

describe("weekly brief permissions", () => {
  it("allows a task owner to view and edit their assigned task update", () => {
    const owner = viewer({ id: "owner-1" });

    expect(canViewWeeklyBrief(owner, { taskUpdates: [{ actionItem: action }] })).toBe(true);
    expect(canEditWeeklyTaskUpdate(owner, action)).toBe(true);
  });

  it("denies an ordinary member with no team or task relationship", () => {
    const member = viewer({ id: "other-member" });

    expect(canViewWeeklyBrief(member, { taskUpdates: [{ actionItem: action }] })).toBe(false);
    expect(canEditWeeklyTaskUpdate(member, action)).toBe(false);
    expect(canManageOfficerMeetingOutputs(member)).toBe(false);
  });

  it("allows configured team leads to edit overall status and finalize Team Meetings", () => {
    const teamLead = viewer({ id: "lead-1" });
    const brief = { teamLeadId: "lead-1", taskUpdates: [{ actionItem: action }] };

    expect(canEditWeeklyBriefOverall(teamLead, brief)).toBe(true);
    expect(canFinalizeTeamMeeting(teamLead, brief)).toBe(true);
    expect(canPrepareOfficerPresentation(teamLead, brief, action)).toBe(true);
  });

  it("allows officer-tier users to manage Officer Meeting outputs", () => {
    const officer = viewer({
      id: "officer-1",
      roles: ["STAFF"],
      primaryRole: "STAFF",
    });

    expect(canViewWeeklyBrief(officer, { taskUpdates: [] })).toBe(true);
    expect(canManageOfficerMeetingOutputs(officer)).toBe(true);
  });
});
