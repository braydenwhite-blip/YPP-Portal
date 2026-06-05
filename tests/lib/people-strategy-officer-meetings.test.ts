import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    officerMeeting: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    actionItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    meetingNote: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    miscUpdate: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  addMiscUpdate,
  assignActionItemToMeeting,
  createOfficerMeeting,
  generateOfficerMeetingAgenda,
  generateOfficerMeetingSummaryEmail,
  saveMeetingNote,
  updateMiscUpdate,
} from "@/lib/people-strategy/officer-meetings-actions";

const mockGetSessionUser = vi.mocked(getSessionUser);

function sessionAs(roles: string[], id = "u1") {
  mockGetSessionUser.mockResolvedValue({
    id,
    name: "Test",
    email: "t@example.com",
    roles,
    primaryRole: roles[0] ?? "STUDENT",
    chapterId: null,
    adminSubtypes: [],
  } as never);
}

const fn = (m: unknown) => m as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ENABLE_ACTION_TRACKER = "true";
  vi.clearAllMocks();
  fn(prisma.$transaction).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        actionItem: { update: prisma.actionItem.update },
        meetingNote: {
          upsert: prisma.meetingNote.upsert,
          deleteMany: prisma.meetingNote.deleteMany,
        },
      })
  );
});

afterEach(() => {
  delete process.env.ENABLE_ACTION_TRACKER;
});

describe("createOfficerMeeting", () => {
  it("lets an officer schedule a meeting", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.officerMeeting.create).mockResolvedValue({ id: "m1" });

    const result = await createOfficerMeeting({ date: "2026-06-15T14:00" });

    expect(result).toEqual({ id: "m1" });
    const arg = fn(prisma.officerMeeting.create).mock.calls[0][0];
    expect(arg.data.date).toBeInstanceOf(Date);
  });

  it("denies a user below officer-tier", async () => {
    sessionAs(["STUDENT"]);
    await expect(createOfficerMeeting({ date: "2026-06-15T14:00" })).rejects.toThrow(
      "Unauthorized"
    );
    expect(prisma.officerMeeting.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid date", async () => {
    sessionAs(["ADMIN"]);
    await expect(createOfficerMeeting({ date: "not-a-date" })).rejects.toThrow();
  });

  it("throws when the feature flag is off", async () => {
    delete process.env.ENABLE_ACTION_TRACKER;
    sessionAs(["ADMIN"]);
    await expect(createOfficerMeeting({ date: "2026-06-15T14:00" })).rejects.toThrow(
      "Action Tracker is not enabled"
    );
  });
});

describe("assignActionItemToMeeting", () => {
  it("links the item and seeds an empty discussion note", async () => {
    sessionAs(["CHAPTER_PRESIDENT"]);
    fn(prisma.officerMeeting.findUnique).mockResolvedValue({ id: "m1" });
    fn(prisma.actionItem.findUnique).mockResolvedValue({ id: "a1", officerMeetingId: null });

    await assignActionItemToMeeting({ meetingId: "m1", actionItemId: "a1" });

    expect(prisma.actionItem.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { officerMeetingId: "m1" },
    });
    const noteArg = fn(prisma.meetingNote.upsert).mock.calls[0][0];
    expect(noteArg.where.officerMeetingId_actionItemId).toEqual({
      officerMeetingId: "m1",
      actionItemId: "a1",
    });
    expect(noteArg.create.discussionNotes).toBe("");
  });

  it("rejects moving an already-assigned item without unassigning first", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.officerMeeting.findUnique).mockResolvedValue({ id: "m2" });
    fn(prisma.actionItem.findUnique).mockResolvedValue({ id: "a1", officerMeetingId: "m1" });

    await expect(
      assignActionItemToMeeting({ meetingId: "m2", actionItemId: "a1" })
    ).rejects.toThrow("Unassign it first");
    expect(prisma.actionItem.update).not.toHaveBeenCalled();
  });

  it("denies a member below officer-tier", async () => {
    sessionAs(["INSTRUCTOR"]);
    await expect(
      assignActionItemToMeeting({ meetingId: "m1", actionItemId: "a1" })
    ).rejects.toThrow("Unauthorized");
  });
});

describe("saveMeetingNote", () => {
  it("upserts editable discussion notes", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.actionItem.findFirst).mockResolvedValue({ id: "a1" });
    await saveMeetingNote({ meetingId: "m1", actionItemId: "a1", discussionNotes: "Discussed" });

    const arg = fn(prisma.meetingNote.upsert).mock.calls[0][0];
    expect(arg.update.discussionNotes).toBe("Discussed");
    expect(arg.create.discussionNotes).toBe("Discussed");
  });

  it("rejects notes for an item not linked to that meeting", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.actionItem.findFirst).mockResolvedValue(null);

    await expect(
      saveMeetingNote({ meetingId: "m1", actionItemId: "a1", discussionNotes: "Nope" })
    ).rejects.toThrow("not assigned to this meeting");
    expect(prisma.meetingNote.upsert).not.toHaveBeenCalled();
  });
});

describe("addMiscUpdate", () => {
  it("records a misc update authored by the officer", async () => {
    sessionAs(["ADMIN"], "officer-1");
    fn(prisma.officerMeeting.findUnique).mockResolvedValue({ id: "m1" });

    await addMiscUpdate({ meetingId: "m1", body: "Budget approved" });

    const arg = fn(prisma.miscUpdate.create).mock.calls[0][0];
    expect(arg.data).toMatchObject({
      officerMeetingId: "m1",
      body: "Budget approved",
      addedById: "officer-1",
    });
  });

  it("edits a miscellaneous update", async () => {
    sessionAs(["STAFF"]);

    await updateMiscUpdate({ id: "misc-1", body: "Updated note" });

    expect(prisma.miscUpdate.update).toHaveBeenCalledWith({
      where: { id: "misc-1" },
      data: { body: "Updated note" },
    });
  });

  it("denies a member below officer-tier", async () => {
    sessionAs(["STUDENT"]);
    await expect(addMiscUpdate({ meetingId: "m1", body: "x" })).rejects.toThrow(
      "Unauthorized"
    );
    expect(prisma.miscUpdate.create).not.toHaveBeenCalled();
  });
});

function meetingWithRelations(notes: string) {
  return {
    id: "m1",
    date: new Date("2026-06-15T14:30:00"),
    status: "SCHEDULED",
    agendaText: null,
    summaryEmailText: null,
    actionItems: [
      {
        id: "a1",
        title: "Launch onboarding revamp",
        status: "IN_PROGRESS",
        deadlineStart: new Date("2026-06-20T00:00:00"),
        deadlineEnd: null,
        departmentName: undefined,
        goalCategory: "Retention",
        department: { id: "d1", name: "People" },
        lead: { id: "u9", name: "Ada", email: "ada@x.com" },
        meetingNotes: [
          { id: "n1", officerMeetingId: "m1", discussionNotes: notes },
        ],
        assignments: [
          { role: "LEAD", user: { id: "u9", name: "Ada", email: "ada@x.com" } },
        ],
      },
    ],
    miscUpdates: [
      { id: "x1", body: "Budget approved", addedBy: { id: "u1", name: "LEADERSHIP", email: null } },
    ],
  };
}

describe("generateOfficerMeetingAgenda", () => {
  it("composes and stores agendaText", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.officerMeeting.findUnique).mockResolvedValue(meetingWithRelations(""));

    const result = await generateOfficerMeetingAgenda("m1");

    expect(result.agendaText).toContain("Officer Meeting Agenda");
    expect(result.agendaText).toContain("Launch onboarding revamp");
    const arg = fn(prisma.officerMeeting.update).mock.calls[0][0];
    expect(arg.where).toEqual({ id: "m1" });
    expect(arg.data.agendaText).toBe(result.agendaText);
  });

  it("throws when the meeting is missing", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.officerMeeting.findUnique).mockResolvedValue(null);
    await expect(generateOfficerMeetingAgenda("nope")).rejects.toThrow("Meeting not found");
  });

  it("denies a member below officer-tier", async () => {
    sessionAs(["STUDENT"]);
    await expect(generateOfficerMeetingAgenda("m1")).rejects.toThrow("Unauthorized");
  });
});

describe("generateOfficerMeetingSummaryEmail", () => {
  it("stays disabled until every linked item has discussion notes", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.officerMeeting.findUnique).mockResolvedValue(meetingWithRelations(""));

    await expect(generateOfficerMeetingSummaryEmail("m1")).rejects.toThrow(
      /until every action item has discussion notes/
    );
    expect(prisma.officerMeeting.update).not.toHaveBeenCalled();
  });

  it("composes and stores summaryEmailText once notes are filled", async () => {
    sessionAs(["STAFF"]);
    fn(prisma.officerMeeting.findUnique).mockResolvedValue(
      meetingWithRelations("Shipping next sprint.")
    );

    const result = await generateOfficerMeetingSummaryEmail("m1");

    expect(result.summaryEmailText).toContain("Officer Meeting Recap");
    expect(result.summaryEmailText).toContain("Shipping next sprint.");
    const arg = fn(prisma.officerMeeting.update).mock.calls[0][0];
    expect(arg.data.summaryEmailText).toBe(result.summaryEmailText);
  });
});
