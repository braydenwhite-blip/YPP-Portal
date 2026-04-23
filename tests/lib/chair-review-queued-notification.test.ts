import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();
const mockTransaction = vi.fn();
const mockSendChairReviewQueuedEmail = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    instructorApplicationTimelineEvent: {
      create: mockCreate,
    },
    instructorApplicationInterviewer: {
      findUnique: vi.fn(),
    },
    offeredInterviewSlot: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    instructorApplicationChairDecision: {
      updateMany: mockUpdateMany,
      create: mockCreate,
      findFirst: vi.fn(),
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
  syncInstructorApplicationWorkflow: vi.fn(),
}));

vi.mock("@/lib/email", () => ({
  sendReviewerAssignedEmail: vi.fn(),
  sendInterviewerAssignedEmail: vi.fn(),
  sendApplicationApprovedEmail: vi.fn(),
  sendApplicationRejectedEmail: vi.fn(),
  sendChairDecisionEmail: vi.fn(),
  sendInfoRequestEmail: vi.fn(),
  sendInterviewScheduledEmail: vi.fn(),
  sendPickYourTimeEmail: vi.fn(),
  sendInterviewConfirmedEmail: vi.fn(),
  sendInstructorPreApprovedEmail: vi.fn(),
  sendInterviewTimesDeclinedEmail: vi.fn(),
  sendChairReviewQueuedEmail: mockSendChairReviewQueuedEmail,
  generateIcsContent: vi.fn(() => "ICS"),
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: vi.fn(),
  assertCanActAsChair: vi.fn(),
  assertCanAssignInterviewers: vi.fn(),
  assertCanManageApplication: vi.fn(),
  isAdmin: vi.fn(() => false),
}));

vi.mock("@/lib/portal-auth-utils", () => ({
  getBaseUrl: vi.fn(async () => "https://portal.test"),
}));

vi.mock("@/lib/telemetry", () => ({
  trackApplicantEvent: vi.fn(),
}));

// ─── Auto-transition INTERVIEW_COMPLETED → CHAIR_REVIEW ───────────────────────

describe("INTERVIEW_COMPLETED → CHAIR_REVIEW auto-transition notification", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  function makeApp(overrides: Record<string, unknown> = {}) {
    return {
      status: "INTERVIEW_SCHEDULED",
      interviewRound: 1,
      chairQueuedAt: null,
      applicant: { name: "Jane Doe", email: "jane@test.com" },
      interviewerAssignments: [{ interviewerId: "bob", round: 1 }],
      interviewReviews: [{ reviewerId: "bob", status: "SUBMITTED", round: 1, recommendation: "ACCEPT" }],
      ...overrides,
    };
  }

  it("sends CHAIR_REVIEW_QUEUED email and creates timeline event on first transition", async () => {
    mockFindUnique.mockResolvedValueOnce(makeApp());
    mockSendChairReviewQueuedEmail.mockResolvedValue({ success: true });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          updateMany: vi
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 }),
        },
        instructorApplicationTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx);
    });

    const { syncInstructorApplicationWorkflow } = await import("@/lib/workflow");
    vi.mocked(syncInstructorApplicationWorkflow).mockResolvedValue(undefined as never);

    const { maybeAutoAdvanceAfterInterviewReview } = await import(
      "@/lib/instructor-interview-actions"
    );
    const advanced = await maybeAutoAdvanceAfterInterviewReview("app-1", "actor-1");

    expect(advanced).toBe(true);
    expect(mockSendChairReviewQueuedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@test.com",
        applicantName: "Jane Doe",
        statusUrl: "https://portal.test/application-status",
      })
    );
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "CHAIR_REVIEW_QUEUED",
          payload: { emailed: true },
        }),
      })
    );
  });

  it("does not send email or event when chairQueuedAt is already set (idempotent re-sync)", async () => {
    mockFindUnique.mockResolvedValueOnce(makeApp({ chairQueuedAt: new Date() }));
    mockSendChairReviewQueuedEmail.mockResolvedValue({ success: true });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          updateMany: vi
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 }),
        },
        instructorApplicationTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx);
    });

    const { syncInstructorApplicationWorkflow } = await import("@/lib/workflow");
    vi.mocked(syncInstructorApplicationWorkflow).mockResolvedValue(undefined as never);

    const { maybeAutoAdvanceAfterInterviewReview } = await import(
      "@/lib/instructor-interview-actions"
    );
    await maybeAutoAdvanceAfterInterviewReview("app-1", "actor-1");

    expect(mockSendChairReviewQueuedEmail).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "CHAIR_REVIEW_QUEUED" }),
      })
    );
  });

  it("still creates the CHAIR_REVIEW_QUEUED event with emailed:false when email throws", async () => {
    mockFindUnique.mockResolvedValueOnce(makeApp());
    mockSendChairReviewQueuedEmail.mockRejectedValue(new Error("SMTP timeout"));

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          updateMany: vi
            .fn()
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 1 }),
        },
        instructorApplicationTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx);
    });

    const { syncInstructorApplicationWorkflow } = await import("@/lib/workflow");
    vi.mocked(syncInstructorApplicationWorkflow).mockResolvedValue(undefined as never);

    const { maybeAutoAdvanceAfterInterviewReview } = await import(
      "@/lib/instructor-interview-actions"
    );
    const advanced = await maybeAutoAdvanceAfterInterviewReview("app-1", "actor-1");

    expect(advanced).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "CHAIR_REVIEW_QUEUED",
          payload: { emailed: false },
        }),
      })
    );
  });
});
