import { beforeEach, describe, expect, it, vi } from "vitest";

// Verifies the chair's one-off inline email edit is routed through
// `sendTemplatedEmailWithOverride` (and the default template sender is skipped),
// while omitting the override preserves the default send.

const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();
const mockTransaction = vi.fn();
const mockSendApplicationRejectedEmail = vi.fn();
const mockSendTemplatedEmailWithOverride = vi.fn();
const mockSyncInstructorApplicationWorkflow = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: { findUnique: mockFindUnique, update: mockUpdate },
    instructorApplicationTimelineEvent: { create: mockCreate },
    instructorApplicationChairDecision: {
      updateMany: mockCreate,
      create: mockCreate,
      findFirst: vi.fn(),
    },
    instructorApproval: { findFirst: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn() },
    userRole: { findUnique: vi.fn(), upsert: vi.fn(), deleteMany: vi.fn() },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth-supabase", () => ({ getSession: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/workflow", () => ({
  syncInstructorApplicationWorkflow: mockSyncInstructorApplicationWorkflow,
}));

vi.mock("@/lib/email", () => ({
  sendNewApplicationNotification: vi.fn(),
  sendApplicationApprovedEmail: vi.fn(),
  sendApplicationRejectedEmail: mockSendApplicationRejectedEmail,
  sendInfoRequestEmail: vi.fn(),
  sendChairDecisionEmail: vi.fn(),
  sendInterviewScheduledEmail: vi.fn(),
  sendPickYourTimeEmail: vi.fn(),
  sendInterviewConfirmedEmail: vi.fn(),
  sendInstructorPreApprovedEmail: vi.fn(),
  sendReviewerAssignedEmail: vi.fn(),
  sendInterviewerAssignedEmail: vi.fn(),
  sendInterviewTimesDeclinedEmail: vi.fn(),
  sendChairReviewQueuedEmail: vi.fn(),
}));

vi.mock("@/lib/email-templates/render", () => ({
  sendTemplatedEmailWithOverride: mockSendTemplatedEmailWithOverride,
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: vi.fn(),
  assertCanActAsChair: vi.fn(),
  assertCanAssignInterviewers: vi.fn(),
  assertCanManageApplication: vi.fn(),
  isAdmin: vi.fn(() => false),
  isHiringChair: vi.fn(() => true),
}));

vi.mock("@/lib/active-chair", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/active-chair")>();
  return { ...actual, getActiveChairUserId: async () => "chair-1" };
});

vi.mock("@/lib/portal-auth-utils", () => ({
  getBaseUrl: vi.fn(async () => "https://portal.test"),
}));
vi.mock("@/lib/telemetry", () => ({ trackApplicantEvent: vi.fn() }));

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

async function primeSession() {
  const { getSession } = await import("@/lib/auth-supabase");
  vi.mocked(getSession).mockResolvedValue({ user: { id: "chair-1" } } as never);
  const { getHiringActor, assertCanActAsChair } = await import(
    "@/lib/chapter-hiring-permissions"
  );
  vi.mocked(getHiringActor).mockResolvedValue({
    id: "chair-1",
    chapterId: null,
    roles: ["HIRING_CHAIR"],
    featureKeys: new Set(),
  } as never);
  vi.mocked(assertCanActAsChair).mockReturnValue(undefined);
  mockFindUnique.mockResolvedValueOnce(makeApp());
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
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
    return fn(tx);
  });
  mockSyncInstructorApplicationWorkflow.mockResolvedValue(undefined);
  mockUpdate.mockResolvedValue({});
  mockCreate.mockResolvedValue({});
}

describe("chairDecide — inline email override", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("routes a one-off override through sendTemplatedEmailWithOverride", async () => {
    await primeSession();
    mockSendTemplatedEmailWithOverride.mockResolvedValue({ success: true });

    const { chairDecide } = await import("@/lib/instructor-application-actions");
    const result = await chairDecide(
      makeFormData({
        applicationId: "app-1",
        action: "REJECT",
        rationale: "Not a good fit.",
        emailOverrideSubject: "A kinder subject",
        emailOverrideBody: "<p>Hand-written note</p>",
      })
    );

    expect(result.success).toBe(true);
    expect(mockSendTemplatedEmailWithOverride).toHaveBeenCalledWith(
      "jane@test.com",
      expect.objectContaining({
        subject: "A kinder subject",
        bodyHtml: expect.stringContaining("Hand-written note"),
      })
    );
    expect(mockSendApplicationRejectedEmail).not.toHaveBeenCalled();
  });

  it("uses the default template sender when no override is provided", async () => {
    await primeSession();
    mockSendApplicationRejectedEmail.mockResolvedValue({ success: true });

    const { chairDecide } = await import("@/lib/instructor-application-actions");
    const result = await chairDecide(
      makeFormData({
        applicationId: "app-1",
        action: "REJECT",
        rationale: "Not a good fit.",
      })
    );

    expect(result.success).toBe(true);
    expect(mockSendApplicationRejectedEmail).toHaveBeenCalled();
    expect(mockSendTemplatedEmailWithOverride).not.toHaveBeenCalled();
  });
});
