import { describe, expect, it } from "vitest";

import {
  buildImpactMeetingAgenda,
  buildImpactMeetingAgendaSection,
  generateImpactMeetingAgendaText,
  generateImpactMeetingSummary,
  IMPACT_TEAMS,
} from "@/lib/people-strategy/impact-meetings";
import type {
  WeeklyBriefTaskUpdateDTO,
  WeeklyBriefWorkspace,
} from "@/lib/people-strategy/weekly-team-briefs";

const presenter = { id: "u-tech", name: "Tech Lead" };

function task(overrides: Partial<WeeklyBriefTaskUpdateDTO> = {}): WeeklyBriefTaskUpdateDTO {
  return {
    id: "tu1",
    actionItemId: "a1",
    taskTitle: "Ship portal testing checklist",
    liveStatus: "IN_PROGRESS",
    deadlineISO: null,
    owner: null,
    commitment: null,
    statusNarrative: "Testing is underway.",
    workCompleted: "Fixed login bug",
    currentResult: "Checklist draft is ready",
    remainingWork: "Run final QA",
    blockerNote: "Need rollout approval",
    explanation: "This is the core Tech proof for the week.",
    decisionNeeded: "Approve Friday rollout",
    nextAction: "Finish QA checklist",
    teamMeetingReady: true,
    officerMeetingReady: true,
    escalationNeeded: false,
    officerReviewRequested: true,
    teamMeetingPresenter: null,
    officerMeetingPresenter: presenter,
    deliverables: [
      {
        id: "link1",
        label: "Testing checklist",
        url: "https://example.com/checklist",
        addedAtISO: "2026-06-18T00:00:00.000Z",
      },
    ],
    allDeliverables: [
      {
        id: "link1",
        label: "Testing checklist",
        url: "https://example.com/checklist",
        addedAtISO: "2026-06-18T00:00:00.000Z",
      },
    ],
    expectationIds: [],
    ...overrides,
  };
}

function brief(overrides: Partial<WeeklyBriefWorkspace> = {}): WeeklyBriefWorkspace {
  return {
    id: "brief-tech",
    initiativeId: "global-operations-impact",
    workstreamId: "tech",
    weekStartISO: "2026-06-15T00:00:00.000Z",
    weekEndISO: "2026-06-21T23:59:59.999Z",
    status: "SUBMITTED",
    teamName: "Tech",
    teamObjective: "Make the portal safer to use.",
    teamLead: presenter,
    targetOfficerMeeting: null,
    teamMeeting: null,
    expectations: [],
    followUps: [],
    overallStatus: "Portal update shipped",
    lastCommitments: "Finish dashboard QA",
    blockersSummary: "",
    decisionsNeeded: "",
    nextActionsSummary: "",
    nextCycleCommitments: "Publish rollout notes",
    taskUpdates: [task()],
    ...overrides,
  } as WeeklyBriefWorkspace;
}

describe("Impact Meeting agenda helpers", () => {
  it("builds one section per Impact team and flags missing updates", () => {
    const sections = IMPACT_TEAMS.map((team) =>
      buildImpactMeetingAgendaSection({
        team,
        weekKey: "2026-06-15",
        brief: team.id === "tech" ? brief() : null,
        now: new Date("2026-06-19T12:00:00.000Z"),
      })
    );
    const agenda = buildImpactMeetingAgenda({
      meetingId: "m1",
      meetingTitle: "Global Operations Impact",
      meetingDateISO: "2026-06-19T12:00:00.000Z",
      weekKey: "2026-06-15",
      sections,
    });

    expect(agenda.sections.map((section) => section.teamName)).toEqual([
      "Tech",
      "Fundraising",
      "Expansion",
      "Socials",
    ]);
    expect(agenda.submittedTeams).toEqual(["Tech"]);
    expect(agenda.missingTeams).toEqual(["Fundraising", "Expansion", "Socials"]);
    expect(agenda.needsAttention).toContain("Fundraising update missing");
  });

  it("includes deliverables, blockers, decisions, and related actions in generated agenda text", () => {
    const section = buildImpactMeetingAgendaSection({
      team: IMPACT_TEAMS[0],
      weekKey: "2026-06-15",
      brief: brief(),
      now: new Date("2026-06-19T12:00:00.000Z"),
    });
    const agenda = buildImpactMeetingAgenda({
      meetingId: "m1",
      meetingTitle: "Global Operations Impact",
      meetingDateISO: "2026-06-19T12:00:00.000Z",
      weekKey: "2026-06-15",
      sections: [section],
    });
    const text = generateImpactMeetingAgendaText(agenda);

    expect(text).toContain("## Tech");
    expect(text).toContain("Testing checklist");
    expect(text).toContain("Approve Friday rollout");
    expect(text).toContain("Need rollout approval");
    expect(text).toContain("Ship portal testing checklist");
  });

  it("warns when a commitment has no owner or due date", () => {
    const section = buildImpactMeetingAgendaSection({
      team: IMPACT_TEAMS[0],
      weekKey: "2026-06-15",
      brief: brief({ taskUpdates: [task({ owner: null, deadlineISO: null })] }),
      now: new Date("2026-06-19T12:00:00.000Z"),
    });

    expect(section.needsAttention).toContain(
      "Ship portal testing checklist commitment has no owner"
    );
    expect(section.needsAttention).toContain(
      "Ship portal testing checklist commitment has no due date"
    );
  });

  it("summarizes presented teams, missing teams, deliverables, follow-ups, and warnings", () => {
    const tech = buildImpactMeetingAgendaSection({
      team: IMPACT_TEAMS[0],
      weekKey: "2026-06-15",
      brief: brief(),
      now: new Date("2026-06-19T12:00:00.000Z"),
    });
    const fundraising = buildImpactMeetingAgendaSection({
      team: IMPACT_TEAMS[1],
      weekKey: "2026-06-15",
      brief: null,
      now: new Date("2026-06-19T12:00:00.000Z"),
    });
    const agenda = buildImpactMeetingAgenda({
      meetingId: "m1",
      meetingTitle: "Global Operations Impact",
      meetingDateISO: "2026-06-19T12:00:00.000Z",
      weekKey: "2026-06-15",
      sections: [tech, fundraising],
    });

    const summary = generateImpactMeetingSummary({
      agenda,
      notesText: "Tech discussed rollout risk.",
      decisions: [{ decision: "Approve Friday rollout", decidedByName: "Senior leadership" }],
      followUps: [{ title: "Send rollout note", ownerName: null, dueISO: null, status: "OPEN" }],
    });

    expect(summary.text).toContain("## Teams Presented");
    expect(summary.text).toContain("- Tech");
    expect(summary.text).toContain("## Teams Missing Updates");
    expect(summary.text).toContain("- Fundraising");
    expect(summary.text).toContain("Testing checklist");
    expect(summary.text).toContain("Send rollout note");
    expect(summary.warnings).toContain("Send rollout note has no owner");
    expect(summary.warnings).toContain("Send rollout note has no due date");
  });
});
