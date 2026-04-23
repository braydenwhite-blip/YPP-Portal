import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock setup ───────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();
const mockFindFirst = vi.fn();
const mockTransaction = vi.fn();
const mockSendApplicationApprovedEmail = vi.fn();
const mockSendApplicationRejectedEmail = vi.fn();
const mockSendInfoRequestEmail = vi.fn();
const mockSendChairDecisionEmail = vi.fn();
const mockSyncInstructorApplicationWorkflow = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    instructorApplicationTimelineEvent: {
      create: mockCreate,
    },
    instructorApplicationChairDecision: {
      updateMany: mockUpdateMany,
      create: mockCreate,
      findFirst: mockFindFirst,
    },
    instructorApproval: { findFirst: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    userRole: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/workflow", () => ({
  syncInstructorApplicationWorkflow: mockSyncInstructorApplicationWorkflow,
}));

vi.mock("@/lib/email", () => ({
  sendNewApplicationNotification: vi.fn(),
  sendApplicationApprovedEmail: mockSendApplicationApprovedEmail,
  sendApplicationRejectedEmail: mockSendApplicationRejectedEmail,
  sendInfoRequestEmail: mockSendInfoRequestEmail,
  sendChairDecisionEmail: mockSendChairDecisionEmail,
  sendInterviewScheduledEmail: vi.fn(),
  sendPickYourTimeEmail: vi.fn(),
  sendInterviewConfirmedEmail: vi.fn(),
  sendInstructorPreApprovedEmail: vi.fn(),
  sendReviewerAssignedEmail: vi.fn(),
  sendInterviewerAssignedEmail: vi.fn(),
  sendInterviewTimesDeclinedEmail: vi.fn(),
  sendChairReviewQueuedEmail: vi.fn(),
  generateIcsContent: vi.fn(() => "ICS"),
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: vi.fn(),
  assertCanActAsChair: vi.fn(),
  assertCanAssignInterviewers: vi.fn(),
  assertCanManageApplication: vi.fn(),
  isAdmin: vi.fn(() => false),
  isHiringChair: vi.fn(() => true),
}));

vi.mock("@/lib/portal-auth-utils", () => ({
  getBaseUrl: vi.fn(async () => "https://portal.test"),
}));

vi.mock("@/lib/telemetry", () => ({
  trackApplicantEvent: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeApp(overrides: Record<string, unknown> = {}) {
  return {
    status: "CHAIR_REVIEW",
    applicantId: "applicant-1",
    reviewerId: null,
    interviewRound: 1,
    applicant: { id: "applicant-1", name: "Jane Doe", email: "jane@test.com" },
    interviewerAssignments: [],
    ...overrides,
  };
}

function makeFormData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ─── chairDecide — email success ─────────────────────────────────────────────

describe("chairDecide — email success clears notification error flags", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("clears lastNotificationError after successful REJECT email", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({ user: { id: "chair-1" } } as never);

    const { getHiringActor, assertCanActAsChair } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "chair-1",
      chapterId: null,
      roles: ["HIRING_CHAIR"],
      featureKeys: new Set(),
    } as never);
    vi.mocked(assertCanActAsChair).mockReturnValue(undefined);

    mockFindUnique.mockResolvedValueOnce(makeApp());
    mockSendApplicationRejectedEmail.mockResolvedValue({ success: true });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          findUnique: vi.fn().mockResolvedValue({ status: "CHAIR_REVIEW" }),
          update: vi.fn().mockResolvedValue({}),
        },
        instructorApplicationChairDecision: {
          updateMany: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        instructorApplicationTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
        user: { findUnique: vi.fn(), update: vi.fn() },
        userRole: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
        instructorApproval: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
      };
      return fn(fakeTx);
    });

    mockSyncInstructorApplicationWorkflow.mockResolvedValue(undefined);

    const { chairDecide } = await import("@/lib/instructor-application-actions");
    const fd = makeFormData({
      applicationId: "app-1",
      action: "REJECT",
      rationale: "Not a good fit.",
    });
    const result = await chairDecide(fd);

    expect(result.success).toBe(true);
    // The update clearing the error flags
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastNotificationError: null,
          lastNotificationErrorAt: null,
        }),
      })
    );
    // No NOTIFICATION_FAILED timeline event
    expect(mockCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "NOTIFICATION_FAILED" }),
      })
    );
  });
});

// ─── chairDecide — email failure ─────────────────────────────────────────────

describe("chairDecide — email failure persists error and creates timeline event", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("sets lastNotificationError, creates NOTIFICATION_FAILED event, and still returns success", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({ user: { id: "chair-1" } } as never);

    const { getHiringActor, assertCanActAsChair } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "chair-1",
      chapterId: null,
      roles: ["HIRING_CHAIR"],
      featureKeys: new Set(),
    } as never);
    vi.mocked(assertCanActAsChair).mockReturnValue(undefined);

    mockFindUnique.mockResolvedValueOnce(makeApp());
    mockSendApplicationRejectedEmail.mockRejectedValue(new Error("SMTP connection refused"));

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          findUnique: vi.fn().mockResolvedValue({ status: "CHAIR_REVIEW" }),
          update: vi.fn().mockResolvedValue({}),
        },
        instructorApplicationChairDecision: {
          updateMany: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
        },
        instructorApplicationTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
        user: { findUnique: vi.fn(), update: vi.fn() },
        userRole: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
        instructorApproval: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
      };
      return fn(fakeTx);
    });

    mockUpdate.mockResolvedValue({});
    mockCreate.mockResolvedValue({});

    const { chairDecide } = await import("@/lib/instructor-application-actions");
    const fd = makeFormData({
      applicationId: "app-1",
      action: "REJECT",
      rationale: "Not a good fit.",
    });
    const result = await chairDecide(fd);

    // Decision still succeeded — application was transitioned
    expect(result.success).toBe(true);

    // Error persisted on the row
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastNotificationError: "SMTP connection refused",
          lastNotificationErrorAt: expect.any(Date),
        }),
      })
    );

    // NOTIFICATION_FAILED timeline event created
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "NOTIFICATION_FAILED",
          payload: expect.objectContaining({
            emailKind: "REJECT",
            error: "SMTP connection refused",
          }),
        }),
      })
    );
  });
});

// ─── resendChairDecisionEmail ─────────────────────────────────────────────────

describe("resendChairDecisionEmail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns ok:false when no chair decision exists", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({ user: { id: "chair-1" } } as never);

    const { getHiringActor, isAdmin, isHiringChair } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "chair-1",
      chapterId: null,
      roles: ["HIRING_CHAIR"],
      featureKeys: new Set(),
    } as never);
    vi.mocked(isAdmin).mockReturnValue(false);
    vi.mocked(isHiringChair).mockReturnValue(true);

    mockFindUnique.mockResolvedValueOnce({
      applicant: { name: "Jane Doe", email: "jane@test.com" },
      infoRequest: null,
    });
    mockFindFirst.mockResolvedValueOnce(null);

    const { resendChairDecisionEmail } = await import("@/lib/instructor-application-actions");
    const result = await resendChairDecisionEmail("app-1");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("No chair decision to resend.");
  });

  it("clears flags and creates NOTIFICATION_RESENT on success", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({ user: { id: "chair-1" } } as never);

    const { getHiringActor, isAdmin, isHiringChair } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "chair-1",
      chapterId: null,
      roles: ["HIRING_CHAIR"],
      featureKeys: new Set(),
    } as never);
    vi.mocked(isAdmin).mockReturnValue(false);
    vi.mocked(isHiringChair).mockReturnValue(true);

    mockFindUnique.mockResolvedValueOnce({
      applicant: { name: "Jane Doe", email: "jane@test.com" },
      infoRequest: null,
    });
    mockFindFirst.mockResolvedValueOnce({
      id: "decision-1",
      action: "REJECT",
      rationale: "Not a good fit.",
      decidedAt: new Date(),
      supersededAt: null,
    });

    mockSendApplicationRejectedEmail.mockResolvedValue({ success: true });
    mockUpdate.mockResolvedValue({});
    mockCreate.mockResolvedValue({});

    const { resendChairDecisionEmail } = await import("@/lib/instructor-application-actions");
    const result = await resendChairDecisionEmail("app-1");

    expect(result.ok).toBe(true);

    // Error flags cleared
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastNotificationError: null,
          lastNotificationErrorAt: null,
        }),
      })
    );

    // NOTIFICATION_RESENT event
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "NOTIFICATION_RESENT",
          payload: expect.objectContaining({ emailKind: "REJECT" }),
        }),
      })
    );
  });

  it("rejects with auth error when called by a non-admin/non-chair", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({ user: { id: "random-1" } } as never);

    const { getHiringActor, isAdmin, isHiringChair } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "random-1",
      chapterId: null,
      roles: ["REVIEWER"],
      featureKeys: new Set(),
    } as never);
    vi.mocked(isAdmin).mockReturnValue(false);
    vi.mocked(isHiringChair).mockReturnValue(false);

    const { resendChairDecisionEmail } = await import("@/lib/instructor-application-actions");
    const result = await resendChairDecisionEmail("app-1");

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Only Admins or Hiring Chairs/);
  });
});
