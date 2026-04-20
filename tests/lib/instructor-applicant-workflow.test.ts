/**
 * Unit-style tests for Instructor Applicant Workflow V1 hardening (Section 1).
 *
 * Risks covered:
 *   Risk 2  — auto-advance only counts active (non-removed) assignments
 *   Risk 7  — duplicate assign* within 5 min produces a single email
 *   Risk 8  — auto-advance race handles "0 rows updated" gracefully
 *   Risk 10 — APPROVE + sync failure triggers compensating rollback
 *   Risk 12 — PRE_APPROVED apps are excluded from the chair queue
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockFindFirst = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateMany = vi.fn();
const mockCreate = vi.fn();
const mockTransaction = vi.fn();
const mockCount = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findUnique: mockFindUnique,
      findMany: mockFindMany,
      update: mockUpdate,
      count: mockCount,
    },
    instructorApplicationInterviewer: {
      findUnique: vi.fn(),
    },
    instructorApplicationTimelineEvent: {
      create: mockCreate,
    },
    instructorApplicationChairDecision: {
      updateMany: mockUpdateMany,
      create: mockCreate,
      findFirst: mockFindFirst,
    },
    instructorApproval: {
      findFirst: mockFindFirst,
    },
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    userRole: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
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
  sendChairDecisionEmail: vi.fn(),
}));

vi.mock("@/lib/chapter-hiring-permissions", () => ({
  getHiringActor: vi.fn(),
  assertCanActAsChair: vi.fn(),
  assertCanAssignInterviewers: vi.fn(),
}));

// ─── Risk 2: auto-advance only counts non-removed assignments ──────────────────

describe("Risk 2 — maybeAutoAdvanceAfterInterviewReview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("does not auto-advance when the only non-removed interviewer has not submitted", async () => {
    // Removed interviewer Alice has a review; active interviewer Bob does not.
    mockFindUnique.mockResolvedValueOnce({
      status: "INTERVIEW_SCHEDULED",
      interviewerAssignments: [
        // Only active (removedAt: null) assignments are included here because
        // the query uses `where: { removedAt: null }`.
        { interviewerId: "bob" },
      ],
      interviewReviews: [
        // Alice submitted but is now removed; her review is preserved.
        { reviewerId: "alice", status: "SUBMITTED" },
      ],
    });

    const { maybeAutoAdvanceAfterInterviewReview } = await import(
      "@/lib/instructor-interview-actions"
    );
    const advanced = await maybeAutoAdvanceAfterInterviewReview("app-1", "actor-1");

    expect(advanced).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("auto-advances when all active interviewers have submitted", async () => {
    mockFindUnique.mockResolvedValueOnce({
      status: "INTERVIEW_SCHEDULED",
      interviewerAssignments: [{ interviewerId: "bob" }],
      interviewReviews: [{ reviewerId: "bob", status: "SUBMITTED" }],
    });

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          findUnique: vi.fn().mockResolvedValue({ status: "INTERVIEW_SCHEDULED" }),
          update: vi.fn().mockResolvedValue({}),
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
  });
});

// ─── Risk 7: notification debounce ────────────────────────────────────────────

describe("Risk 7 — assignment notification debounce", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("returns true the first time and false within the debounce window", async () => {
    const { shouldSendAssignmentNotification, DEBOUNCE_WINDOW_MS } = await import(
      "@/lib/notification-policy"
    );

    const first = shouldSendAssignmentNotification("REVIEWER_ASSIGNED", "user-1", "app-1");
    expect(first).toBe(true);

    const duplicate = shouldSendAssignmentNotification("REVIEWER_ASSIGNED", "user-1", "app-1");
    expect(duplicate).toBe(false);

    // Different application → different key → should fire
    const different = shouldSendAssignmentNotification("REVIEWER_ASSIGNED", "user-1", "app-2");
    expect(different).toBe(true);

    // Confirm DEBOUNCE_WINDOW_MS is 5 minutes
    expect(DEBOUNCE_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it("allows re-send after the debounce window expires", async () => {
    const { shouldSendAssignmentNotification, DEBOUNCE_WINDOW_MS } = await import(
      "@/lib/notification-policy"
    );

    const fakeNow = Date.now();
    const dateSpy = vi.spyOn(Date, "now");

    dateSpy.mockReturnValue(fakeNow);
    shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", "user-2", "app-3");

    // Simulate time passing beyond the window
    dateSpy.mockReturnValue(fakeNow + DEBOUNCE_WINDOW_MS + 1);
    const after = shouldSendAssignmentNotification("INTERVIEWER_ASSIGNED", "user-2", "app-3");
    expect(after).toBe(true);

    dateSpy.mockRestore();
  });
});

// ─── Risk 8: auto-advance race — 0 rows updated handled gracefully ─────────────

describe("Risk 8 — auto-advance race condition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("skips silently when another request already advanced the status", async () => {
    mockFindUnique.mockResolvedValueOnce({
      status: "INTERVIEW_SCHEDULED",
      interviewerAssignments: [{ interviewerId: "bob" }],
      interviewReviews: [{ reviewerId: "bob", status: "SUBMITTED" }],
    });

    // Simulate the race: by the time we open the transaction, status is CHAIR_REVIEW
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          findUnique: vi.fn().mockResolvedValue({ status: "CHAIR_REVIEW" }),
          update: vi.fn(),
        },
        instructorApplicationTimelineEvent: { create: vi.fn() },
      };
      return fn(fakeTx);
    });

    const { maybeAutoAdvanceAfterInterviewReview } = await import(
      "@/lib/instructor-interview-actions"
    );
    // Should not throw; returns false because the transaction returned early
    const advanced = await maybeAutoAdvanceAfterInterviewReview("app-race", "actor-1");
    expect(advanced).toBe(false);
  });
});

// ─── Risk 10: APPROVE + sync failure → compensating rollback ──────────────────

describe("Risk 10 — chairDecide APPROVE sync failure rollback", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("returns an error and compensates when sync throws", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "chair-1", roles: ["ADMIN"], email: "chair@test.com" },
    } as never);

    const { getHiringActor, assertCanActAsChair } = await import(
      "@/lib/chapter-hiring-permissions"
    );
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "chair-1",
      roles: ["ADMIN"],
    } as never);
    vi.mocked(assertCanActAsChair).mockReturnValue(undefined);

    mockFindUnique.mockResolvedValueOnce({
      status: "CHAIR_REVIEW",
      applicantId: "applicant-1",
      reviewerId: null,
      applicant: { id: "applicant-1", name: "Test User", email: "applicant@test.com" },
      interviewerAssignments: [],
    });

    // Main decision transaction succeeds
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplicationChairDecision: {
          updateMany: vi.fn().mockResolvedValue({}),
          create: vi.fn().mockResolvedValue({}),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        instructorApplication: {
          findUnique: vi.fn().mockResolvedValue({ status: "CHAIR_REVIEW" }),
          update: vi.fn().mockResolvedValue({}),
        },
        user: { update: vi.fn().mockResolvedValue({}) },
        userRole: { upsert: vi.fn().mockResolvedValue({}) },
        instructorApproval: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        instructorApplicationTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx);
    });

    // Sync throws
    const { syncInstructorApplicationWorkflow } = await import("@/lib/workflow");
    vi.mocked(syncInstructorApplicationWorkflow).mockRejectedValueOnce(
      new Error("Simulated sync failure")
    );

    // Compensating rollback transaction succeeds
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplicationChairDecision: { updateMany: vi.fn().mockResolvedValue({}) },
        instructorApplication: { update: vi.fn().mockResolvedValue({}) },
        instructorApplicationTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
      };
      return fn(fakeTx);
    });

    const { chairDecide } = await import("@/lib/instructor-application-actions");
    const fd = new FormData();
    fd.set("applicationId", "app-10");
    fd.set("action", "APPROVE");

    const result = await chairDecide(fd);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Onboarding sync failed");
    // Compensating rollback transaction was called
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });
});

// ─── Risk 12: PRE_APPROVED excluded from chair queue ──────────────────────────

describe("Risk 12 — chair queue excludes PRE_APPROVED", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getChairQueue only returns CHAIR_REVIEW applications", async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const { getChairQueue } = await import("@/lib/instructor-applicant-board-queries");
    await getChairQueue({ scope: "admin" });

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "CHAIR_REVIEW",
        }),
      })
    );
  });

  it("PRE_APPROVED applications remain in interview_prep column, not chair_review", async () => {
    // getDerivedColumn logic: PRE_APPROVED → interview_prep
    // We test the board query enrichment indirectly via pipeline shape
    mockFindMany.mockResolvedValueOnce([
      {
        id: "pre-app-1",
        status: "PRE_APPROVED",
        materialsReadyAt: null,
        archivedAt: null,
        reviewerAssignedAt: null,
        reviewerAssignedById: null,
        chairQueuedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        subjectsOfInterest: null,
        applicant: { id: "u1", name: "A", email: "a@test.com", chapterId: "c1", chapter: null },
        reviewer: null,
        interviewerAssignments: [],
        chairDecision: null,
        applicationReviews: [],
      },
    ]);

    const { getApplicantPipeline } = await import("@/lib/instructor-applicant-board-queries");
    const { columns } = await getApplicantPipeline({ scope: "admin" });

    expect(columns.chair_review).toHaveLength(0);
    expect(columns.interview_prep).toHaveLength(1);
  });
});
