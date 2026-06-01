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
      update: vi.fn(),
    },
    meetingNote: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    miscUpdate: {
      create: vi.fn(),
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
  saveMeetingNote,
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
    fn(prisma.actionItem.findUnique).mockResolvedValue({ id: "a1" });

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
    await saveMeetingNote({ meetingId: "m1", actionItemId: "a1", discussionNotes: "Discussed" });

    const arg = fn(prisma.meetingNote.upsert).mock.calls[0][0];
    expect(arg.update.discussionNotes).toBe("Discussed");
    expect(arg.create.discussionNotes).toBe("Discussed");
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

  it("denies a member below officer-tier", async () => {
    sessionAs(["STUDENT"]);
    await expect(addMiscUpdate({ meetingId: "m1", body: "x" })).rejects.toThrow(
      "Unauthorized"
    );
    expect(prisma.miscUpdate.create).not.toHaveBeenCalled();
  });
});
