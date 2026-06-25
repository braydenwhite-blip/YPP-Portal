import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/chapters/access", () => ({
  requireChapterManager: vi.fn(),
  requireChapterLeadership: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    meetingFollowUp: { findUnique: vi.fn() },
    actionItem: { findFirst: vi.fn(), create: vi.fn() },
    chapter: { findUnique: vi.fn(), update: vi.fn() },
    chapterNote: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

import { requireChapterManager } from "@/lib/chapters/access";
import { prisma } from "@/lib/prisma";
import {
  createActionFromMeetingFollowUp,
  submitChapterCheckIn,
} from "@/lib/chapters/actions";

const mockGuard = vi.mocked(requireChapterManager);
const mockPrisma = prisma as unknown as {
  meetingFollowUp: { findUnique: ReturnType<typeof vi.fn> };
  actionItem: { findFirst: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  chapter: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  chapterNote: { create: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
};

function asManager(isLeadership: boolean) {
  mockGuard.mockResolvedValue({
    user: { id: "cp1", name: "Casey President", email: "cp@example.com" },
    isLeadership,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("createActionFromMeetingFollowUp", () => {
  it("creates a chapter-scoped action linked back to the meeting follow-up", async () => {
    asManager(false);
    mockPrisma.meetingFollowUp.findUnique.mockResolvedValue({
      id: "f1",
      title: "Recruit 5 members",
      detail: "from the club fair",
      dueDate: null,
      ownerId: "cp1",
      meeting: { id: "m1", chapterId: "chap-1", facilitatorId: "cp1" },
    });
    mockPrisma.actionItem.findFirst.mockResolvedValue(null);
    mockPrisma.chapter.findUnique.mockResolvedValue({ presidentId: "cp1" });
    mockPrisma.actionItem.create.mockResolvedValue({ id: "act-1" });

    const res = await createActionFromMeetingFollowUp({ followUpId: "f1" });

    expect(res).toMatchObject({ ok: true, id: "act-1" });
    const data = mockPrisma.actionItem.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      chapterId: "chap-1",
      meetingId: "m1",
      sourceType: "MEETING_FOLLOW_UP",
      sourceId: "f1",
      leadId: "cp1",
    });
  });

  it("refuses a follow-up that is not on a chapter meeting", async () => {
    mockPrisma.meetingFollowUp.findUnique.mockResolvedValue({
      id: "f1",
      title: "Generic",
      detail: null,
      dueDate: null,
      ownerId: null,
      meeting: { id: "m1", chapterId: null, facilitatorId: null },
    });
    await expect(createActionFromMeetingFollowUp({ followUpId: "f1" })).rejects.toThrow(
      /not on a chapter meeting/i
    );
    expect(mockGuard).not.toHaveBeenCalled();
  });

  it("is idempotent — returns the existing action instead of creating a second", async () => {
    asManager(true);
    mockPrisma.meetingFollowUp.findUnique.mockResolvedValue({
      id: "f1",
      title: "Recruit",
      detail: null,
      dueDate: null,
      ownerId: null,
      meeting: { id: "m1", chapterId: "chap-1", facilitatorId: "fac" },
    });
    mockPrisma.actionItem.findFirst.mockResolvedValue({ id: "existing-1" });

    const res = await createActionFromMeetingFollowUp({ followUpId: "f1" });
    expect(res).toMatchObject({ ok: true, id: "existing-1", existing: true });
    expect(mockPrisma.actionItem.create).not.toHaveBeenCalled();
  });
});

describe("submitChapterCheckIn", () => {
  function wireTransaction() {
    const tx = {
      chapterNote: { create: vi.fn().mockResolvedValue({ id: "note-1" }) },
      chapter: { update: vi.fn().mockResolvedValue({}) },
      actionItem: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: "act-blk" })
          .mockResolvedValueOnce({ id: "act-help" }),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => cb(tx));
    return tx;
  }

  it("records a note and turns blockers + asks into real actions", async () => {
    asManager(false);
    mockPrisma.chapter.findUnique.mockResolvedValue({ presidentId: "cp1", lifecycleStatus: "ACTIVE" });
    const tx = wireTransaction();

    const res = await submitChapterCheckIn({
      chapterId: "chap-1",
      since: "Held first meeting",
      blocked: "No classroom space",
      needsHelp: "Need a curriculum reviewer",
      createActions: true,
    });

    expect(tx.chapterNote.create).toHaveBeenCalledTimes(1);
    expect(tx.actionItem.create).toHaveBeenCalledTimes(2);
    expect(res.createdActionIds).toEqual(["act-blk", "act-help"]);
  });

  it("does not create actions when createActions is off", async () => {
    asManager(true);
    mockPrisma.chapter.findUnique.mockResolvedValue({ presidentId: "cp1", lifecycleStatus: "ACTIVE" });
    const tx = wireTransaction();

    const res = await submitChapterCheckIn({
      chapterId: "chap-1",
      blocked: "Something",
      createActions: false,
    });
    expect(tx.actionItem.create).not.toHaveBeenCalled();
    expect(res.createdActionIds).toEqual([]);
  });

  it("a CP cannot change the lifecycle status; leadership can", async () => {
    // CP: status is ignored (no chapter.update).
    asManager(false);
    mockPrisma.chapter.findUnique.mockResolvedValue({ presidentId: "cp1", lifecycleStatus: "ACTIVE" });
    const txCp = wireTransaction();
    await submitChapterCheckIn({ chapterId: "chap-1", since: "ok", status: "AT_RISK" });
    expect(txCp.chapter.update).not.toHaveBeenCalled();

    // Leadership: status change is applied.
    asManager(true);
    mockPrisma.chapter.findUnique.mockResolvedValue({ presidentId: "cp1", lifecycleStatus: "ACTIVE" });
    const txLead = wireTransaction();
    await submitChapterCheckIn({ chapterId: "chap-1", since: "ok", status: "AT_RISK" });
    expect(txLead.chapter.update).toHaveBeenCalledTimes(1);
    expect(txLead.chapter.update.mock.calls[0][0].data.lifecycleStatus).toBe("AT_RISK");
  });

  it("rejects an empty check-in", async () => {
    asManager(false);
    await expect(submitChapterCheckIn({ chapterId: "chap-1" })).rejects.toThrow();
  });
});
