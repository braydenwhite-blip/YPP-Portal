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
import { flagActionToCPO } from "@/lib/people-strategy/action-items-actions";

const mockGetSessionUser = vi.mocked(getSessionUser);

function sessionAs(overrides: { id?: string; roles?: string[]; adminSubtypes?: string[] }) {
  mockGetSessionUser.mockResolvedValue({
    id: overrides.id ?? "u1",
    name: "Test",
    email: "t@example.com",
    roles: overrides.roles ?? ["STAFF"],
    primaryRole: overrides.roles?.[0] ?? "STAFF",
    chapterId: null,
    adminSubtypes: overrides.adminSubtypes ?? [],
  } as never);
}

// $transaction invokes the callback with a tx client whose methods we capture.
const txActionItemUpdate = vi.fn();
const txCommentCreate = vi.fn();

beforeEach(() => {
  process.env.ENABLE_ACTION_TRACKER = "true";
  vi.clearAllMocks();
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

describe("flagActionToCPO", () => {
  it("sets flaggedAt and posts a system-style comment", async () => {
    sessionAs({ id: "o1", roles: ["STAFF"] });
    (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a1",
      leadId: null,
      createdById: "x",
      visibility: "ALL_LEADERSHIP",
      assignments: [],
    });

    const result = await flagActionToCPO("a1");

    expect(result.flaggedAt).toBeInstanceOf(Date);
    expect(txActionItemUpdate).toHaveBeenCalledTimes(1);
    const updateArg = txActionItemUpdate.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "a1" });
    expect(updateArg.data.flaggedAt).toBeInstanceOf(Date);

    expect(txCommentCreate).toHaveBeenCalledTimes(1);
    const commentArg = txCommentCreate.mock.calls[0][0];
    expect(commentArg.data.type).toBe("NOTE");
    expect(commentArg.data.body).toContain("Flagged to CPO");
    expect(commentArg.data.actionItemId).toBe("a1");
    expect(commentArg.data.authorId).toBe("o1");
  });

  it("lets a member flag an action they are assigned to", async () => {
    sessionAs({ id: "m1", roles: ["STUDENT"] });
    (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a2",
      leadId: null,
      createdById: "x",
      visibility: "ALL_LEADERSHIP",
      assignments: [{ userId: "m1", role: "INPUT" }],
    });

    await expect(flagActionToCPO("a2")).resolves.toHaveProperty("flaggedAt");
    expect(txActionItemUpdate).toHaveBeenCalledTimes(1);
  });

  it("rejects a member who cannot view the action", async () => {
    sessionAs({ id: "m1", roles: ["STUDENT"] });
    (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "a3",
      leadId: "someoneElse",
      createdById: "x",
      visibility: "ALL_LEADERSHIP",
      assignments: [],
    });

    await expect(flagActionToCPO("a3")).rejects.toThrow("Unauthorized");
    expect(txActionItemUpdate).not.toHaveBeenCalled();
  });

  it("rejects when the feature flag is off", async () => {
    delete process.env.ENABLE_ACTION_TRACKER;
    sessionAs({ id: "o1", roles: ["STAFF"] });

    await expect(flagActionToCPO("a1")).rejects.toThrow("not enabled");
    expect(prisma.actionItem.findUnique).not.toHaveBeenCalled();
  });
});
