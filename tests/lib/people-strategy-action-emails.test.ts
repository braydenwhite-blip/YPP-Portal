import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSessionUser: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendNewAssignmentEmail: vi.fn(),
}));

vi.mock("@/lib/public-app-url", () => ({
  toAbsoluteAppUrl: (path: string) => `https://portal.test${path}`,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    actionItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    actionAssignment: {
      findUnique: vi.fn(),
    },
    actionComment: {
      create: vi.fn(),
    },
    department: {
      findUnique: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

import { getSessionUser } from "@/lib/auth-supabase";
import { sendNewAssignmentEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import {
  addActionAssignment,
  createActionItem,
} from "@/lib/people-strategy/action-items-actions";

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockSendNewAssignmentEmail = vi.mocked(sendNewAssignmentEmail);

function sessionAs(id: string, roles: string[] = ["STAFF"]) {
  mockGetSessionUser.mockResolvedValue({
    id,
    name: "Test",
    email: "t@example.com",
    roles,
    primaryRole: roles[0],
    chapterId: null,
    adminSubtypes: [],
  } as never);
}

function mockActionForEmail() {
  (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    title: "Launch onboarding",
    deadlineStart: new Date("2026-06-10T00:00:00.000Z"),
    deadlineEnd: null,
    lead: { name: "Lead Person", email: "lead@example.com" },
  });
  (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
    { id: "u1", name: "Lead Person", email: "lead@example.com" },
    { id: "u2", name: "Exec Person", email: "exec@example.com" },
  ]);
}

const txActionItemUpdate = vi.fn();
const txActionAssignmentUpsert = vi.fn();
const txActionAssignmentDeleteMany = vi.fn();
const txCommentCreate = vi.fn();

beforeEach(() => {
  process.env.ENABLE_ACTION_TRACKER = "true";
  vi.clearAllMocks();
  mockSendNewAssignmentEmail.mockResolvedValue({ success: true } as never);
  (prisma.$transaction as unknown as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<unknown>) =>
      cb({
        actionItem: { update: txActionItemUpdate },
        actionAssignment: {
          upsert: txActionAssignmentUpsert,
          deleteMany: txActionAssignmentDeleteMany,
        },
        actionComment: { create: txCommentCreate },
      })
  );
});

afterEach(() => {
  delete process.env.ENABLE_ACTION_TRACKER;
  delete process.env.ENABLE_ACTION_TRACKER_EMAILS;
});

describe("new assignment emails — createActionItem", () => {
  const baseInput = {
    title: "Launch onboarding",
    departmentId: "d1",
    leadId: "u1",
    deadlineStart: "2026-06-10",
    executingUserIds: ["u2"],
    inputUserIds: [],
  };

  function mockCreatePath() {
    (prisma.department.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "d1",
    });
    (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(2);
    (prisma.actionItem.create as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "created-action",
    });
  }

  it("sends exactly one email per newly created assignment when the flag is on", async () => {
    process.env.ENABLE_ACTION_TRACKER_EMAILS = "true";
    sessionAs("u1");
    mockCreatePath();
    mockActionForEmail();

    await createActionItem(baseInput);

    // LEAD (u1) + EXECUTING (u2) = 2 assignment rows = 2 emails.
    expect(mockSendNewAssignmentEmail).toHaveBeenCalledTimes(2);
    const roles = mockSendNewAssignmentEmail.mock.calls.map((c) => c[0].role).sort();
    expect(roles).toEqual(["EXECUTING", "LEAD"]);
    const lead = mockSendNewAssignmentEmail.mock.calls.find((c) => c[0].role === "LEAD")![0];
    expect(lead.to).toBe("lead@example.com");
    expect(lead.actionTitle).toBe("Launch onboarding");
    expect(lead.actionUrl).toBe("https://portal.test/actions/created-action");
  });

  it("does not send any email when the email flag is off", async () => {
    sessionAs("u1");
    mockCreatePath();

    await createActionItem(baseInput);

    expect(mockSendNewAssignmentEmail).not.toHaveBeenCalled();
  });
});

describe("new assignment emails — addActionAssignment", () => {
  function mockAccess() {
    (prisma.actionItem.findUnique as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        // loadAccess projection
        id: "a1",
        leadId: "u1",
        createdById: "u1",
        visibility: "ALL_LEADERSHIP",
        flaggedAt: null,
        assignments: [],
      })
      // notifyNewActionAssignments item lookup
      .mockResolvedValueOnce({
        title: "Launch onboarding",
        deadlineStart: new Date("2026-06-10T00:00:00.000Z"),
        deadlineEnd: null,
        lead: { name: "Lead Person", email: "lead@example.com" },
      });
    (prisma.user.count as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(1);
    (prisma.user.findMany as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "u2", name: "Exec Person", email: "exec@example.com" },
    ]);
  }

  it("sends one email for a genuinely new assignment", async () => {
    process.env.ENABLE_ACTION_TRACKER_EMAILS = "true";
    sessionAs("u1");
    mockAccess();
    (prisma.actionAssignment.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      null
    );

    await addActionAssignment("a1", "u2", "EXECUTING");

    expect(mockSendNewAssignmentEmail).toHaveBeenCalledTimes(1);
    expect(mockSendNewAssignmentEmail.mock.calls[0][0].to).toBe("exec@example.com");
    expect(mockSendNewAssignmentEmail.mock.calls[0][0].role).toBe("EXECUTING");
  });

  it("does not resend when the assignment already exists (unchanged)", async () => {
    process.env.ENABLE_ACTION_TRACKER_EMAILS = "true";
    sessionAs("u1");
    mockAccess();
    (prisma.actionAssignment.findUnique as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "existing",
    });

    await addActionAssignment("a1", "u2", "EXECUTING");

    expect(mockSendNewAssignmentEmail).not.toHaveBeenCalled();
  });
});
