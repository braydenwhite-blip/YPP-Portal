/**
 * Unit-style tests for Instructor Applicant Workflow V1 hardening (Section 1).
 *
 * Risks covered:
 *   Risk 2  — auto-advance only counts active (non-removed) assignments
 *   Risk 7  — duplicate assign* within 5 min produces a single email
 *   Risk 8  — auto-advance race handles "0 rows updated" gracefully
 *   Risk 10 — APPROVE + sync failure triggers compensating rollback
 *   Risk 12 — PRE_APPROVED apps are excluded from the chair queue
 *   Risk 13 — workspace second-interviewer candidates do not crash without LEAD
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
const mockOfferedSlotDeleteMany = vi.fn();
const mockOfferedSlotCreateMany = vi.fn();
const mockSendPickYourTimeEmail = vi.fn();
const mockSendInterviewTimesDeclinedEmail = vi.fn();

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
    offeredInterviewSlot: {
      deleteMany: mockOfferedSlotDeleteMany,
      createMany: mockOfferedSlotCreateMany,
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
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
      findUnique: vi.fn(),
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
  sendApplicationRejectedEmail: vi.fn(),
  sendChairDecisionEmail: vi.fn(),
  sendInfoRequestEmail: vi.fn(),
  sendInterviewScheduledEmail: vi.fn(),
  sendPickYourTimeEmail: mockSendPickYourTimeEmail,
  sendInterviewConfirmedEmail: vi.fn(),
  sendInstructorPreApprovedEmail: vi.fn(),
  sendInterviewTimesDeclinedEmail: mockSendInterviewTimesDeclinedEmail,
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

// ─── Risk 2: auto-advance only counts non-removed assignments ──────────────────

describe("Risk 2 — maybeAutoAdvanceAfterInterviewReview", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("does not auto-advance when the only non-removed interviewer has not submitted", async () => {
    // Removed interviewer Alice has a review; active interviewer Bob does not.
    mockFindUnique.mockResolvedValueOnce({
      status: "INTERVIEW_SCHEDULED",
      interviewRound: 1,
      interviewerAssignments: [
        // Only active (removedAt: null) assignments are included here because
        // the query uses `where: { removedAt: null }`.
        { interviewerId: "bob", round: 1 },
      ],
      interviewReviews: [
        // Alice submitted but is now removed; her review is preserved.
        { reviewerId: "alice", status: "SUBMITTED", round: 1, recommendation: "ACCEPT" },
      ],
    });

    const { maybeAutoAdvanceAfterInterviewReview } = await import(
      "@/lib/instructor-interview-actions"
    );
    const advanced = await maybeAutoAdvanceAfterInterviewReview("app-1", "actor-1");

    expect(advanced).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("does not auto-advance until every current-round submission has a recommendation", async () => {
    mockFindUnique.mockResolvedValueOnce({
      status: "INTERVIEW_SCHEDULED",
      interviewRound: 1,
      interviewerAssignments: [{ interviewerId: "bob", round: 1 }],
      interviewReviews: [{ reviewerId: "bob", status: "SUBMITTED", round: 1, recommendation: null }],
    });

    const { maybeAutoAdvanceAfterInterviewReview } = await import(
      "@/lib/instructor-interview-actions"
    );
    const advanced = await maybeAutoAdvanceAfterInterviewReview("app-1", "actor-1");

    expect(advanced).toBe(false);
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("ignores prior-round recommendations when a second interview round is active", async () => {
    mockFindUnique.mockResolvedValueOnce({
      status: "INTERVIEW_SCHEDULED",
      interviewRound: 2,
      interviewerAssignments: [{ interviewerId: "bob", round: 2 }],
      interviewReviews: [{ reviewerId: "bob", status: "SUBMITTED", round: 1, recommendation: "ACCEPT" }],
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
      interviewRound: 1,
      interviewerAssignments: [{ interviewerId: "bob", round: 1 }],
      interviewReviews: [{ reviewerId: "bob", status: "SUBMITTED", round: 1, recommendation: "ACCEPT" }],
    });

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
      interviewRound: 1,
      interviewerAssignments: [{ interviewerId: "bob", round: 1 }],
      interviewReviews: [{ reviewerId: "bob", status: "SUBMITTED", round: 1, recommendation: "ACCEPT" }],
    });

    // Simulate the race: by the time we open the transaction, status is CHAIR_REVIEW
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const fakeTx = {
        instructorApplication: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
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
      interviewRound: 1,
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
        user: {
          findUnique: vi.fn().mockResolvedValue({ primaryRole: "APPLICANT" }),
          update: vi.fn().mockResolvedValue({}),
        },
        userRole: {
          findUnique: vi.fn().mockResolvedValue(null),
          upsert: vi.fn().mockResolvedValue({}),
        },
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
        instructorApproval: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        userRole: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
        user: { update: vi.fn().mockResolvedValue({}) },
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
        interviewScheduledAt: null,
        interviewRound: 1,
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
        chairDecisions: [],
        applicationReviews: [],
      },
    ]);

    const { getApplicantPipeline } = await import("@/lib/instructor-applicant-board-queries");
    const { columns } = await getApplicantPipeline({ scope: "admin" });

    expect(columns.chair_review).toHaveLength(0);
    expect(columns.interview_prep).toHaveLength(1);
  });
});

// ─── Risk 13: workspace loads before LEAD interviewer assignment ──────────────

describe("Risk 13 — second interviewer candidates before LEAD", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns no SECOND candidates instead of throwing when no LEAD is assigned", async () => {
    mockFindUnique.mockResolvedValueOnce({
      subjectsOfInterest: null,
      applicant: { chapterId: "chapter-1" },
      interviewerAssignments: [],
    });

    const { getCandidateInterviewers } = await import("@/lib/instructor-applicant-board-queries");
    await expect(getCandidateInterviewers("app-1", { role: "SECOND" })).resolves.toEqual([]);
  });
});

// ─── Manual instructor interview times ───────────────────────────────────────

describe("manual instructor interview times", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  function futureSlot(offsetHours: number) {
    return {
      scheduledAt: new Date(Date.now() + offsetHours * 60 * 60 * 1000),
      durationMinutes: 60,
      meetingUrl: "https://meet.google.com/ypp-test",
    };
  }

  async function mockLeadSession() {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "lead-1", roles: [], email: "lead@test.com" },
    } as never);

    const { getHiringActor, isAdmin } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "lead-1",
      chapterId: "chapter-1",
      roles: [],
    } as never);
    vi.mocked(isAdmin).mockReturnValue(false);
  }

  function mockMoveToInterviewApplication() {
    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      status: "UNDER_REVIEW",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      reviewerNotes: null,
      interviewRound: 1,
      interviewScheduledAt: null,
      applicant: { name: "Applicant One", email: "applicant@test.com", chapterId: "chapter-1" },
      interviewerAssignments: [
        { interviewerId: "lead-1", role: "LEAD", round: 1, removedAt: null },
      ],
      applicationReviews: [
        { nextStep: "MOVE_TO_INTERVIEW", summary: "Worth interviewing." },
      ],
    });
  }

  it("requires at least 3 and at most 5 proposed times", async () => {
    await mockLeadSession();
    mockMoveToInterviewApplication();

    const { offerInterviewSlots } = await import("@/lib/instructor-application-actions");
    const result = await offerInterviewSlots("app-1", [futureSlot(24), futureSlot(48)]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("3 to 5");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("lets the assigned lead send 3 times and advances the application when slots are sent", async () => {
    await mockLeadSession();
    mockMoveToInterviewApplication();
    mockSendPickYourTimeEmail.mockResolvedValue({ success: true });

    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        offeredInterviewSlot: {
          deleteMany: mockOfferedSlotDeleteMany,
          createMany: mockOfferedSlotCreateMany,
        },
        instructorApplication: { update: mockUpdate },
        instructorApplicationTimelineEvent: { create: mockCreate },
      };
      return fn(tx);
    });

    const { offerInterviewSlots } = await import("@/lib/instructor-application-actions");
    const result = await offerInterviewSlots("app-1", [
      futureSlot(24),
      futureSlot(48),
      futureSlot(72),
    ]);

    expect(result.success).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1" },
        data: expect.objectContaining({ status: "INTERVIEW_SCHEDULED" }),
      })
    );
    expect(mockOfferedSlotCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ offeredByUserId: "lead-1", durationMinutes: 60 }),
          expect.objectContaining({ meetingUrl: "https://meet.google.com/ypp-test" }),
        ]),
      })
    );
    expect(mockSendPickYourTimeEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "applicant@test.com",
        statusUrl: "https://portal.test/application-status",
      })
    );
  });

  it("does not send times before the lead review chooses Move to Interview", async () => {
    await mockLeadSession();
    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      status: "UNDER_REVIEW",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      reviewerNotes: null,
      interviewRound: 1,
      interviewScheduledAt: null,
      applicant: { name: "Applicant One", email: "applicant@test.com", chapterId: "chapter-1" },
      interviewerAssignments: [
        { interviewerId: "lead-1", role: "LEAD", round: 1, removedAt: null },
      ],
      applicationReviews: [{ nextStep: "HOLD", summary: "Wait." }],
    });

    const { offerInterviewSlots } = await import("@/lib/instructor-application-actions");
    const result = await offerInterviewSlots("app-1", [
      futureSlot(24),
      futureSlot(48),
      futureSlot(72),
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Move to Interview");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("clears pending offers and notifies the lead when the applicant says none work", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "applicant-1", roles: ["APPLICANT"], email: "applicant@test.com" },
    } as never);

    mockSendInterviewTimesDeclinedEmail.mockResolvedValue({ success: true });
    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      status: "INTERVIEW_SCHEDULED",
      interviewRound: 1,
      interviewScheduledAt: null,
      applicant: { name: "Applicant One" },
      offeredSlots: [
        {
          id: "slot-1",
          scheduledAt: futureSlot(24).scheduledAt,
          offeredBy: { id: "lead-1", name: "Lead One", email: "lead@test.com" },
        },
      ],
      interviewerAssignments: [
        {
          role: "LEAD",
          round: 1,
          interviewer: { id: "lead-1", name: "Lead One", email: "lead@test.com" },
        },
      ],
    });
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        offeredInterviewSlot: { deleteMany: mockOfferedSlotDeleteMany },
        instructorApplicationTimelineEvent: { create: mockCreate },
      };
      return fn(tx);
    });

    const { requestNewInterviewTimes } = await import("@/lib/instructor-application-actions");
    const result = await requestNewInterviewTimes("app-1");

    expect(result.success).toBe(true);
    expect(mockOfferedSlotDeleteMany).toHaveBeenCalledWith({
      where: { instructorApplicationId: "app-1", confirmedAt: null },
    });
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: "INTERVIEW_TIMES_DECLINED" }),
      })
    );
    expect(mockSendInterviewTimesDeclinedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "lead@test.com",
        workspaceUrl: "https://portal.test/applications/instructor/app-1#section-scheduling",
      })
    );
  });
});

// ─── WS6: offerInterviewSlots concurrent / race tests ───────────────────────

describe("offerInterviewSlots — race condition / unique constraint", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  function futureSlot(offsetHours: number) {
    return {
      scheduledAt: new Date(Date.now() + offsetHours * 60 * 60 * 1000),
      durationMinutes: 60,
      meetingUrl: "https://meet.google.com/ypp-test",
    };
  }

  async function mockLeadSession() {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "lead-1", roles: [], email: "lead@test.com" },
    } as never);

    const { getHiringActor, isAdmin } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "lead-1",
      chapterId: "chapter-1",
      roles: [],
    } as never);
    vi.mocked(isAdmin).mockReturnValue(false);
  }

  function mockInterviewScheduledApplication() {
    mockFindUnique.mockResolvedValue({
      id: "app-1",
      status: "INTERVIEW_SCHEDULED",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      reviewerNotes: null,
      interviewRound: 1,
      interviewScheduledAt: null,
      applicant: { name: "Applicant One", email: "applicant@test.com", chapterId: "chapter-1" },
      interviewerAssignments: [
        { interviewerId: "lead-1", role: "LEAD", round: 1, removedAt: null },
      ],
      applicationReviews: [],
    });
  }

  function makeTx() {
    return {
      offeredInterviewSlot: {
        deleteMany: mockOfferedSlotDeleteMany,
        createMany: mockOfferedSlotCreateMany,
      },
      instructorApplication: { update: mockUpdate },
      instructorApplicationTimelineEvent: { create: mockCreate },
    };
  }

  it("normal single-call insert succeeds", async () => {
    await mockLeadSession();
    mockInterviewScheduledApplication();
    mockSendPickYourTimeEmail.mockResolvedValue({ success: true });

    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx())
    );

    const { offerInterviewSlots } = await import("@/lib/instructor-application-actions");
    const result = await offerInterviewSlots("app-1", [
      futureSlot(24),
      futureSlot(48),
      futureSlot(72),
    ]);

    expect(result.success).toBe(true);
    expect(mockOfferedSlotCreateMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true })
    );
  });

  it("returns conflict error when transaction throws a P2002 unique-constraint violation", async () => {
    await mockLeadSession();
    mockInterviewScheduledApplication();

    // Simulate a concurrent writer having already inserted the same slots —
    // the DB raises a unique-constraint violation that Prisma surfaces as P2002.
    const uniqueConstraintError = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["instructorApplicationId", "scheduledAt"] },
    });
    mockTransaction.mockRejectedValueOnce(uniqueConstraintError);

    const { offerInterviewSlots } = await import("@/lib/instructor-application-actions");
    const result = await offerInterviewSlots("app-1", [
      futureSlot(24),
      futureSlot(48),
      futureSlot(72),
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "Another reviewer posted conflicting slots. Refresh and try again."
    );
  });

  it("two callers with non-overlapping slots both succeed independently", async () => {
    mockSendPickYourTimeEmail.mockResolvedValue({ success: true });

    // First caller: lead-1
    await mockLeadSession();
    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      status: "INTERVIEW_SCHEDULED",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      reviewerNotes: null,
      interviewRound: 1,
      interviewScheduledAt: null,
      applicant: { name: "Applicant One", email: "applicant@test.com", chapterId: "chapter-1" },
      interviewerAssignments: [
        { interviewerId: "lead-1", role: "LEAD", round: 1, removedAt: null },
      ],
      applicationReviews: [],
    });
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx())
    );

    const { offerInterviewSlots } = await import("@/lib/instructor-application-actions");
    const result1 = await offerInterviewSlots("app-1", [
      futureSlot(24),
      futureSlot(48),
      futureSlot(72),
    ]);

    // Reset so the second call gets fresh mocks
    vi.resetAllMocks();

    // Second caller (admin) with completely different times
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"], email: "admin@test.com" },
    } as never);
    const { getHiringActor, isAdmin } = await import("@/lib/chapter-hiring-permissions");
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "admin-1",
      chapterId: "chapter-1",
      roles: ["ADMIN"],
    } as never);
    vi.mocked(isAdmin).mockReturnValue(true);
    mockSendPickYourTimeEmail.mockResolvedValue({ success: true });

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      status: "INTERVIEW_SCHEDULED",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      reviewerNotes: null,
      interviewRound: 1,
      interviewScheduledAt: null,
      applicant: { name: "Applicant One", email: "applicant@test.com", chapterId: "chapter-1" },
      interviewerAssignments: [
        { interviewerId: "lead-1", role: "LEAD", round: 1, removedAt: null },
      ],
      applicationReviews: [],
    });
    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(makeTx())
    );

    const result2 = await offerInterviewSlots("app-1", [
      futureSlot(100),
      futureSlot(124),
      futureSlot(148),
    ]);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
  });

  it("passes isolationLevel Serializable to prisma.$transaction", async () => {
    await mockLeadSession();
    mockInterviewScheduledApplication();
    mockSendPickYourTimeEmail.mockResolvedValue({ success: true });

    mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>, _opts: unknown) =>
      fn(makeTx())
    );

    const { offerInterviewSlots } = await import("@/lib/instructor-application-actions");
    await offerInterviewSlots("app-1", [futureSlot(24), futureSlot(48), futureSlot(72)]);

    expect(mockTransaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: "Serializable" })
    );
  });
});
