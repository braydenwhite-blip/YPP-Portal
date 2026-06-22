import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  officerMeeting: { findFirst: vi.fn() },
  actionItem: { findMany: vi.fn() },
  teamPresentationExpectation: { findMany: vi.fn() },
  meetingFollowUp: { findMany: vi.fn() },
  weeklyTeamBrief: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  teamMeeting: { findUnique: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  weeklyTaskUpdate: { findUnique: vi.fn(), upsert: vi.fn() },
  preparedPresentationItem: { findUnique: vi.fn(), update: vi.fn() },
  meetingAgendaItem: { aggregate: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/feature-flags", () => ({
  isWeeklyTeamBriefsEnabled: () => true,
}));

import {
  actionBelongsToWorkstream,
  agendaKindForPreparedItem,
  buildPreparedItemDedupeKey,
  endOfUTCWeek,
  generateWeeklyTeamBriefs,
  promotePreparedPresentationToOfficerAgenda,
  startOfUTCWeek,
} from "@/lib/people-strategy/weekly-team-briefs";
import type { StrategicInitiativeDef, WorkstreamDef } from "@/lib/people-strategy/strategic-initiatives";

const initiative: StrategicInitiativeDef = {
  id: "communication-expansion",
  title: "Communication and Expansion Priorities",
  description: "Grow communication and expansion work.",
  area: "LEADERSHIP",
  status: "active",
  priority: "high",
  match: { keywords: ["instagram", "facebook", "outreach"] },
  workstreams: [
    {
      id: "social-media",
      title: "Social Media Team",
      order: 1,
      match: { keywords: ["instagram", "facebook", "carousel"] },
    },
  ],
  milestones: [],
};

const social = initiative.workstreams![0] as WorkstreamDef;

function action(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    title: "Instagram carousel",
    description: "Build the campaign carousel",
    goalCategory: null,
    actionType: null,
    relatedEntityType: null,
    relatedEntityId: null,
    strategicInitiativeId: null,
    leadId: "owner-1",
    createdById: "creator-1",
    visibility: "ALL_LEADERSHIP",
    assignments: [],
    fileLinks: [],
    ...overrides,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("weekly team brief domain helpers", () => {
  it("uses Monday UTC as the reporting week boundary", () => {
    const weekStart = startOfUTCWeek(new Date("2026-06-18T15:30:00.000Z"));
    const weekEnd = endOfUTCWeek(weekStart);

    expect(weekStart.toISOString()).toBe("2026-06-15T00:00:00.000Z");
    expect(weekEnd.toISOString()).toBe("2026-06-21T23:59:59.999Z");
  });

  it("classifies an action into the matching workstream", () => {
    expect(actionBelongsToWorkstream(initiative, social, action())).toBe(true);
    expect(
      actionBelongsToWorkstream(
        initiative,
        social,
        action({ title: "School outreach list", description: "Call principals" })
      )
    ).toBe(false);
  });

  it("keeps prepared item dedupe stable for the same Team Meeting source", () => {
    expect(
      buildPreparedItemDedupeKey({
        teamMeetingId: "tm1",
        weeklyTaskUpdateId: "tu1",
        expectationId: "e1",
        reason: "Leadership decision",
      })
    ).toBe(
      buildPreparedItemDedupeKey({
        teamMeetingId: "tm1",
        weeklyTaskUpdateId: "tu1",
        expectationId: "e1",
        reason: " leadership   decision ",
      })
    );
  });

  it("does not treat every prepared item as a deliverable review", () => {
    expect(
      agendaKindForPreparedItem({
        requestedDecision: "Approve the campaign message",
        reasonForOfficerReview: "Needs leadership decision",
      })
    ).toBe("DECISION");
    expect(
      agendaKindForPreparedItem({
        deliverableLinkIds: ["file1"],
        reasonForOfficerReview: "Show actual carousel",
      })
    ).toBe("DELIVERABLE_REVIEW");
    expect(
      agendaKindForPreparedItem({
        reasonForOfficerReview: "Routine team status",
      })
    ).toBe("TEAM_STATUS");
  });

  it("generates one brief and one Team Meeting per workstream/week", async () => {
    prismaMock.officerMeeting.findFirst.mockResolvedValue({ id: "om1" });
    prismaMock.actionItem.findMany.mockResolvedValue([]);
    prismaMock.teamPresentationExpectation.findMany.mockResolvedValue([
      {
        id: "expect1",
        initiativeId: "summer-camps-2026",
        workstreamId: "marketing",
        actionItemId: null,
      },
    ]);
    prismaMock.meetingFollowUp.findMany.mockResolvedValue([]);
    prismaMock.weeklyTeamBrief.findUnique.mockResolvedValueOnce(null);
    prismaMock.weeklyTeamBrief.upsert.mockResolvedValue({ id: "brief1", status: "DRAFT" });
    prismaMock.teamMeeting.findUnique.mockResolvedValueOnce(null);
    prismaMock.teamMeeting.upsert.mockResolvedValue({ id: "tm1" });

    const result = await generateWeeklyTeamBriefs(new Date("2026-06-18T12:00:00Z"), {
      initiativeId: "summer-camps-2026",
      workstreamId: "marketing",
    });

    expect(result.createdBriefs).toBe(1);
    expect(result.createdTeamMeetings).toBe(1);
    expect(prismaMock.weeklyTeamBrief.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          initiativeId_workstreamId_weekStart: {
            initiativeId: "summer-camps-2026",
            workstreamId: "marketing",
            weekStart: new Date("2026-06-15T00:00:00.000Z"),
          },
        },
      })
    );
    expect(prismaMock.teamMeeting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { briefId: "brief1" },
      })
    );
    expect(prismaMock.meetingAgendaItem.upsert).not.toHaveBeenCalled();
  });

  it("promotes a prepared Team Meeting item with source links", async () => {
    prismaMock.preparedPresentationItem.findUnique.mockResolvedValue({
      id: "prep1",
      title: "Instagram carousel review",
      statusSummary: "Draft carousel is ready for officer review.",
      requestedDecision: "Approve campaign message",
      reasonForOfficerReview: "Leadership decision needed",
      deliverableLinkIds: ["file1"],
      readiness: "SUBMITTED",
      presenterId: "presenter-1",
      initiativeId: "communication-expansion",
      workstreamId: "social-media",
      briefId: "brief1",
      teamMeetingId: "team-meeting-1",
      actionItemId: "action1",
      presentationExpectationId: "expect1",
      targetOfficerMeetingId: "om1",
      presentationExpectation: { kind: "PRESENT_DELIVERABLE" },
      brief: { id: "brief1" },
      teamMeeting: { id: "team-meeting-1" },
      actionItem: { id: "action1", title: "Instagram carousel" },
    });
    prismaMock.meetingAgendaItem.aggregate.mockResolvedValue({ _max: { sortOrder: 2 } });
    prismaMock.meetingAgendaItem.upsert.mockResolvedValue({ id: "agenda1" });
    prismaMock.preparedPresentationItem.update.mockResolvedValue({});
    prismaMock.weeklyTeamBrief.update.mockResolvedValue({});
    prismaMock.teamMeeting.update.mockResolvedValue({});

    const result = await promotePreparedPresentationToOfficerAgenda({
      preparedPresentationItemId: "prep1",
      officerMeetingId: "om1",
    });

    expect(result).toEqual({ id: "agenda1" });
    expect(prismaMock.meetingAgendaItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { preparedPresentationItemId: "prep1" },
        create: expect.objectContaining({
          officerMeetingId: "om1",
          itemKind: "DECISION",
          briefId: "brief1",
          teamMeetingId: "team-meeting-1",
          preparedPresentationItemId: "prep1",
          sourceActionId: "action1",
          presentationExpectationId: "expect1",
          requestedDecision: "Approve campaign message",
        }),
      })
    );
    expect(prismaMock.preparedPresentationItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "prep1" },
        data: expect.objectContaining({ readiness: "ACCEPTED", targetOfficerMeetingId: "om1" }),
      })
    );
    expect(prismaMock.weeklyTeamBrief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "brief1" },
        data: expect.objectContaining({ officerMeetingId: "om1", readyForOfficerMeeting: true }),
      })
    );
  });
});
