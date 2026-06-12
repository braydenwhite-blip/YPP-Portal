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
    actionItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    actionComment: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import {
  captureActionBlocker,
  captureActionCompletion,
} from "@/lib/people-strategy/action-items-actions";

const mockGetSessionUser = vi.mocked(getSessionUser);

function sessionAs(overrides: { id?: string; roles?: string[] } = {}) {
  mockGetSessionUser.mockResolvedValue({
    id: overrides.id ?? "u1",
    name: "Test",
    email: "t@example.com",
    roles: overrides.roles ?? ["STAFF"],
    primaryRole: overrides.roles?.[0] ?? "STAFF",
    chapterId: null,
    adminSubtypes: [],
  } as never);
}

const txActionItemUpdate = vi.fn();
const txCommentCreate = vi.fn();

/** Access shape: u1 is the action lead, so canEditAction passes. */
function actionExists(status = "IN_PROGRESS") {
  (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>)
    // loadAccess read
    .mockResolvedValueOnce({
      id: "a1",
      leadId: "u1",
      createdById: "u1",
      visibility: "ALL_LEADERSHIP",
      assignments: [],
    })
    // status read
    .mockResolvedValueOnce({ status });
}

beforeEach(() => {
  process.env.ENABLE_ACTION_TRACKER = "true";
  vi.clearAllMocks();
  // clearAllMocks doesn't drop unconsumed mockResolvedValueOnce queues —
  // reset the read mock so validation-failure tests can't leak into the next.
  (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>).mockReset();
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        actionItem: { update: txActionItemUpdate },
        actionComment: { create: txCommentCreate },
      })
  );
});

afterEach(() => {
  delete process.env.ENABLE_ACTION_TRACKER;
});

describe("captureActionCompletion", () => {
  it("marks COMPLETE with outcome, note, follow-up, and stamps completedAt", async () => {
    sessionAs();
    actionExists("IN_PROGRESS");

    await captureActionCompletion({
      id: "a1",
      completionOutcome: "PARTIAL",
      completionNote: "Shipped the draft; final copy still pending.",
      nextFollowUpAt: "2026-06-20",
    });

    expect(txActionItemUpdate).toHaveBeenCalledTimes(1);
    const arg = txActionItemUpdate.mock.calls[0][0];
    expect(arg.where).toEqual({ id: "a1" });
    expect(arg.data.status).toBe("COMPLETE");
    expect(arg.data.completedAt).toBeInstanceOf(Date);
    expect(arg.data.completionOutcome).toBe("PARTIAL");
    expect(arg.data.completionNote).toBe("Shipped the draft; final copy still pending.");
    expect(arg.data.nextFollowUpAt).toBeInstanceOf(Date);

    expect(txCommentCreate).toHaveBeenCalledTimes(1);
    expect(txCommentCreate.mock.calls[0][0].data.body).toContain("COMPLETE");
    expect(txCommentCreate.mock.calls[0][0].data.body).toContain("PARTIAL");
  });

  it("allows updating completion details on an already-complete action without touching completedAt", async () => {
    sessionAs();
    actionExists("COMPLETE");

    await captureActionCompletion({ id: "a1", completionOutcome: "DELIVERED" });

    const arg = txActionItemUpdate.mock.calls[0][0];
    expect(arg.data.status).toBe("COMPLETE");
    expect("completedAt" in arg.data).toBe(false);
    expect(arg.data.completionOutcome).toBe("DELIVERED");
    expect(txCommentCreate.mock.calls[0][0].data.body).toContain(
      "Completion details updated"
    );
  });

  it("clears nextFollowUpAt when completion capture leaves the date blank", async () => {
    sessionAs();
    actionExists("IN_PROGRESS");

    await captureActionCompletion({ id: "a1", completionOutcome: "DELIVERED" });

    const arg = txActionItemUpdate.mock.calls[0][0];
    expect(arg.data.nextFollowUpAt).toBeNull();
  });

  it("rejects an unknown completion outcome", async () => {
    sessionAs();
    actionExists("IN_PROGRESS");
    await expect(
      captureActionCompletion({ id: "a1", completionOutcome: "WONDERFUL" })
    ).rejects.toThrow();
    expect(txActionItemUpdate).not.toHaveBeenCalled();
  });

  it("refuses when the viewer cannot edit the action", async () => {
    sessionAs({ id: "stranger", roles: ["STUDENT"] });
    (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: "a1",
      leadId: "someone-else",
      createdById: "someone-else",
      visibility: "ALL_LEADERSHIP",
      assignments: [],
    });
    await expect(
      captureActionCompletion({ id: "a1", completionNote: "done" })
    ).rejects.toThrow("Unauthorized");
  });
});

describe("captureActionBlocker", () => {
  it("marks BLOCKED with the reason and optional follow-up", async () => {
    sessionAs();
    actionExists("IN_PROGRESS");

    await captureActionBlocker({
      id: "a1",
      blockedReason: "Waiting on the venue contract.",
      nextFollowUpAt: "2026-06-18",
    });

    const arg = txActionItemUpdate.mock.calls[0][0];
    expect(arg.data.status).toBe("BLOCKED");
    expect(arg.data.blockedReason).toBe("Waiting on the venue contract.");
    expect(arg.data.nextFollowUpAt).toBeInstanceOf(Date);
    expect(txCommentCreate.mock.calls[0][0].data.body).toContain("BLOCKED");
  });

  it("requires a non-empty blocker reason", async () => {
    sessionAs();
    actionExists("IN_PROGRESS");
    await expect(
      captureActionBlocker({ id: "a1", blockedReason: "   " })
    ).rejects.toThrow();
    expect(txActionItemUpdate).not.toHaveBeenCalled();
  });

  it("clears completedAt when blocking a previously-complete action", async () => {
    sessionAs();
    actionExists("COMPLETE");

    await captureActionBlocker({ id: "a1", blockedReason: "Reopened — delivery bounced." });

    const arg = txActionItemUpdate.mock.calls[0][0];
    expect(arg.data.status).toBe("BLOCKED");
    expect(arg.data.completedAt).toBeNull();
  });

  it("clears nextFollowUpAt when blocker capture leaves the date blank", async () => {
    sessionAs();
    actionExists("IN_PROGRESS");

    await captureActionBlocker({ id: "a1", blockedReason: "Waiting on a partner." });

    const arg = txActionItemUpdate.mock.calls[0][0];
    expect(arg.data.nextFollowUpAt).toBeNull();
  });
});
