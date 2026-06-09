import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isActionTrackerEnabled: () => true }));
vi.mock("@/lib/authorization", () => ({ requireOfficer: vi.fn() }));
vi.mock("@/lib/people-strategy/action-items-actions", () => ({ createActionItem: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    officerMeeting: { create: vi.fn() },
    meetingFollowUp: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    meetingAgendaItem: { findUnique: vi.fn(), update: vi.fn() },
    meetingDecision: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { requireOfficer } from "@/lib/authorization";
import { createActionItem } from "@/lib/people-strategy/action-items-actions";
import { prisma } from "@/lib/prisma";
import {
  addFollowUp,
  convertDecisionToAction,
  convertFollowUpToAction,
  createMeeting,
} from "@/lib/people-strategy/meetings-actions";

const officerMeeting = prisma.officerMeeting as unknown as { create: ReturnType<typeof vi.fn> };
const followUp = prisma.meetingFollowUp as unknown as {
  create: ReturnType<typeof vi.fn>;
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};
const decision = prisma.meetingDecision as unknown as {
  findUnique: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireOfficer).mockResolvedValue({ id: "viewer1", roles: ["ADMIN"] } as never);
  vi.mocked(createActionItem).mockResolvedValue({ id: "act_new" });
  officerMeeting.create.mockResolvedValue({ id: "m1" });
  followUp.create.mockResolvedValue({ id: "f1" });
  followUp.update.mockResolvedValue({ officerMeetingId: "m1" });
  decision.update.mockResolvedValue({ officerMeetingId: "m1" });
});

afterEach(() => vi.clearAllMocks());

describe("createMeeting", () => {
  it("combines date + time, upper-cases the category, and nests attendees + agenda", async () => {
    const res = await createMeeting({
      title: "Weekly Leadership Sync",
      category: "leadership",
      priority: "HIGH",
      date: "2026-06-12",
      startTime: "18:00",
      endTime: "19:00",
      recurrence: "WEEKLY",
      facilitatorId: "u1",
      attendeeIds: ["u2", "u2", "u3"],
      agendaTitles: ["Review actions", "Signups"],
    });
    expect(res).toEqual({ id: "m1" });

    const arg = officerMeeting.create.mock.calls[0][0];
    expect(arg.data.title).toBe("Weekly Leadership Sync");
    expect(arg.data.category).toBe("LEADERSHIP");
    expect(arg.data.priority).toBe("HIGH");
    expect(arg.data.recurrence).toBe("WEEKLY");
    expect(arg.data.date).toEqual(new Date("2026-06-12T18:00:00"));
    expect(arg.data.endTime).toEqual(new Date("2026-06-12T19:00:00"));
    expect(arg.data.attendees.create).toEqual([{ userId: "u2" }, { userId: "u3" }]);
    expect(arg.data.agendaItems.create).toEqual([
      { title: "Review actions", sortOrder: 0 },
      { title: "Signups", sortOrder: 1 },
    ]);
  });

  it("stores NONE recurrence as null", async () => {
    await createMeeting({ title: "One-off", date: "2026-06-12", recurrence: "NONE" });
    expect(officerMeeting.create.mock.calls[0][0].data.recurrence).toBeNull();
  });

  it("rejects an unknown category", async () => {
    await expect(
      createMeeting({ title: "X", category: "nope", date: "2026-06-12" })
    ).rejects.toThrow(/Unknown meeting category/);
    expect(officerMeeting.create).not.toHaveBeenCalled();
  });

  it("requires a title", async () => {
    await expect(createMeeting({ title: "  ", date: "2026-06-12" })).rejects.toBeTruthy();
  });

  it("links the meeting to a YPP entity when both ref fields are supplied", async () => {
    await createMeeting({
      title: "Class check-in",
      date: "2026-06-12",
      relatedEntityType: "CLASS_OFFERING",
      relatedEntityId: "cls1",
    });
    const arg = officerMeeting.create.mock.calls[0][0];
    expect(arg.data.relatedEntityType).toBe("CLASS_OFFERING");
    expect(arg.data.relatedEntityId).toBe("cls1");
  });

  it("stores no entity link when neither ref field is supplied", async () => {
    await createMeeting({ title: "Untied", date: "2026-06-12" });
    const arg = officerMeeting.create.mock.calls[0][0];
    expect(arg.data.relatedEntityType).toBeNull();
    expect(arg.data.relatedEntityId).toBeNull();
  });

  it("rejects a half-specified entity link (type without id)", async () => {
    await expect(
      createMeeting({ title: "Bad", date: "2026-06-12", relatedEntityType: "CLASS_OFFERING" })
    ).rejects.toThrow(/needs both a type and an id/);
    expect(officerMeeting.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown entity link type", async () => {
    await expect(
      createMeeting({ title: "Bad", date: "2026-06-12", relatedEntityType: "WAT", relatedEntityId: "x" })
    ).rejects.toThrow(/Unknown linked entity type/);
    expect(officerMeeting.create).not.toHaveBeenCalled();
  });
});

describe("convertFollowUpToAction", () => {
  it("creates a linked action for the meeting and stores its id on the follow-up", async () => {
    followUp.findUnique.mockResolvedValue({
      id: "f1",
      title: "Email the camp directors",
      description: null,
      ownerId: "owner1",
      dueDate: new Date("2026-06-13T00:00:00"),
      priority: "HIGH",
      area: "PARTNERSHIPS",
      linkedActionId: null,
      officerMeeting: { id: "m1", date: new Date("2026-06-08T18:00:00"), category: "PARTNERSHIPS", facilitatorId: "fac1" },
    });

    const res = await convertFollowUpToAction("f1");
    expect(res).toEqual({ id: "act_new" });

    const actionArg = vi.mocked(createActionItem).mock.calls[0][0] as Record<string, unknown>;
    expect(actionArg.title).toBe("Email the camp directors");
    expect(actionArg.leadId).toBe("owner1");
    expect(actionArg.officerMeetingId).toBe("m1");
    expect(actionArg.actionType).toBe("FOLLOW_UP");
    expect(actionArg.priority).toBe("HIGH");
    expect(actionArg.deadlineStart).toBe("2026-06-13");

    expect(followUp.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { linkedActionId: "act_new" },
    });
  });

  it("falls back to the meeting facilitator for the lead when the follow-up has no owner", async () => {
    followUp.findUnique.mockResolvedValue({
      id: "f2",
      title: "No owner",
      description: null,
      ownerId: null,
      dueDate: null,
      priority: "MEDIUM",
      area: null,
      linkedActionId: null,
      officerMeeting: { id: "m1", date: new Date("2026-06-08T18:00:00"), category: null, facilitatorId: "fac1" },
    });
    await convertFollowUpToAction("f2");
    const actionArg = vi.mocked(createActionItem).mock.calls[0][0] as Record<string, unknown>;
    expect(actionArg.leadId).toBe("fac1");
  });

  it("is idempotent — already-linked follow-ups skip creation", async () => {
    followUp.findUnique.mockResolvedValue({
      id: "f3",
      linkedActionId: "act_existing",
      officerMeeting: { id: "m1", date: new Date(), category: null, facilitatorId: null },
    });
    const res = await convertFollowUpToAction("f3");
    expect(res).toEqual({ id: "act_existing" });
    expect(createActionItem).not.toHaveBeenCalled();
  });
});

describe("convertDecisionToAction", () => {
  it("creates a linked, entity-aware action from a decision and stores its id", async () => {
    decision.findUnique.mockResolvedValue({
      id: "d1",
      decision: "Email Lincoln HS about the spring cohort",
      rationale: "They asked for dates",
      linkedActionId: null,
      decidedById: "dec1",
      officerMeeting: {
        id: "m1",
        title: "Partnerships Sync",
        date: new Date("2026-06-08T18:00:00"),
        category: "PARTNERSHIPS",
        facilitatorId: "fac1",
        relatedEntityType: "PARTNER",
        relatedEntityId: "p1",
      },
    });

    const res = await convertDecisionToAction("d1");
    expect(res).toEqual({ id: "act_new" });

    const actionArg = vi.mocked(createActionItem).mock.calls[0][0] as Record<string, unknown>;
    expect(actionArg.title).toBe("Email Lincoln HS about the spring cohort");
    expect(actionArg.officerMeetingId).toBe("m1");
    expect(actionArg.leadId).toBe("dec1"); // decidedBy wins for the lead
    expect(actionArg.relatedEntityType).toBe("PARTNER");
    expect(actionArg.relatedEntityId).toBe("p1");
    expect(actionArg.goalCategory).toBe("PARTNERSHIPS");
    expect(actionArg.actionType).toBe("FOLLOW_UP");
    expect(actionArg.description).toContain("Rationale: They asked for dates");
    // Action 4.0: the converted action records its honest provenance + a seeded
    // definition of done, so the meeting → action loop stays accountable.
    expect(actionArg.sourceType).toBe("MEETING_DECISION");
    expect(actionArg.sourceId).toBe("d1");
    expect(actionArg.successDefinition).toBeTruthy();

    expect(decision.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { linkedActionId: "act_new" },
    });
  });

  it("is idempotent — an already-linked decision skips creation", async () => {
    decision.findUnique.mockResolvedValue({
      id: "d2",
      decision: "Already done",
      rationale: null,
      linkedActionId: "act_existing",
      decidedById: null,
      officerMeeting: { id: "m1", title: null, date: new Date(), category: null, facilitatorId: null, relatedEntityType: null, relatedEntityId: null },
    });
    const res = await convertDecisionToAction("d2");
    expect(res).toEqual({ id: "act_existing" });
    expect(createActionItem).not.toHaveBeenCalled();
  });
});

describe("addFollowUp", () => {
  it("creates a follow-up and, when createAction is set, links an action", async () => {
    followUp.findUnique.mockResolvedValue({
      id: "f1",
      title: "Track me",
      description: null,
      ownerId: "owner1",
      dueDate: null,
      priority: "MEDIUM",
      area: "CLASSES",
      linkedActionId: null,
      officerMeeting: { id: "m1", date: new Date("2026-06-08T18:00:00"), category: "CLASSES", facilitatorId: "fac1" },
    });

    await addFollowUp({ meetingId: "m1", title: "Track me", priority: "MEDIUM", area: "CLASSES", createAction: true });

    expect(followUp.create).toHaveBeenCalled();
    expect(createActionItem).toHaveBeenCalledTimes(1);
  });

  it("does not create an action when createAction is false", async () => {
    await addFollowUp({ meetingId: "m1", title: "Just a note", createAction: false });
    expect(followUp.create).toHaveBeenCalled();
    expect(createActionItem).not.toHaveBeenCalled();
  });
});
