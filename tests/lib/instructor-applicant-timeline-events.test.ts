/**
 * Tests verifying that the five missing timeline events are written correctly
 * inside their respective transactions (WS2 — audit trail backfill).
 *
 * Events covered:
 *   REVIEWER_ASSIGNED       — assignReviewer()
 *   INTERVIEWER_REMOVED     — removeInterviewer()
 *   SCORES_UPDATED          — saveScoresAndNotes()
 *   INFO_REQUESTED          — requestMoreInfo()
 *   INFO_RESPONSE_RECEIVED  — submitInfoResponse()
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Shared mock handles ───────────────────────────────────────────────────────

const mockFindUnique = vi.fn();
const mockUserFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockTimelineCreate = vi.fn();
const mockTransaction = vi.fn();
const mockInterviewerFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: { findUnique: mockFindUnique, update: mockUpdate },
    instructorApplicationInterviewer: { findUnique: mockInterviewerFindUnique, update: vi.fn() },
    instructorApplicationTimelineEvent: { create: mockTimelineCreate },
    user: { findUnique: mockUserFindUnique, update: vi.fn() },
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
  sendInfoRequestEmail: vi.fn(),
  sendInterviewScheduledEmail: vi.fn(),
  sendPickYourTimeEmail: vi.fn(),
  sendInterviewTimesDeclinedEmail: vi.fn(),
  sendApplicationApprovedEmail: vi.fn(),
  sendApplicationRejectedEmail: vi.fn(),
  sendChairDecisionEmail: vi.fn(),
  sendInstructorPreApprovedEmail: vi.fn(),
  sendInterviewConfirmedEmail: vi.fn(),
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

vi.mock("@/lib/notification-policy", () => ({
  shouldSendAssignmentNotification: vi.fn(() => false),
  DEBOUNCE_WINDOW_MS: 5 * 60 * 1000,
}));

vi.mock("@/lib/telemetry", () => ({
  trackApplicantEvent: vi.fn(),
}));

// ─── Helper: wire mockTransaction to run the callback ─────────────────────────

function setupTransaction(extraTxMethods: Record<string, unknown> = {}) {
  const txTimelineCreate = vi.fn().mockResolvedValue({});
  const txAppUpdate = vi.fn().mockResolvedValue({});
  const txInterviewerUpdate = vi.fn().mockResolvedValue({});

  mockTransaction.mockImplementationOnce(async (fn: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      instructorApplication: { update: txAppUpdate, findUnique: vi.fn() },
      instructorApplicationInterviewer: { update: txInterviewerUpdate },
      instructorApplicationTimelineEvent: { create: txTimelineCreate },
      ...extraTxMethods,
    };
    return fn(tx);
  });

  return { txTimelineCreate, txAppUpdate, txInterviewerUpdate };
}

// ─── REVIEWER_ASSIGNED ────────────────────────────────────────────────────────

describe("REVIEWER_ASSIGNED timeline event — assignReviewer()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  async function setupAdminSession() {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"], email: "admin@test.com" },
    } as never);

    const { getHiringActor, assertCanManageApplication } = await import(
      "@/lib/chapter-hiring-permissions"
    );
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "admin-1",
      roles: ["ADMIN"],
      chapterId: null,
    } as never);
    vi.mocked(assertCanManageApplication).mockReturnValue(undefined);
  }

  it("creates a REVIEWER_ASSIGNED event inside the transaction with correct payload", async () => {
    await setupAdminSession();

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      status: "SUBMITTED",
      reviewerId: null,
      applicant: { chapterId: "chapter-1" },
    });
    mockUserFindUnique.mockResolvedValueOnce({
      chapterId: "chapter-1",
      roles: [{ role: "ADMIN" }],
    });

    const { txTimelineCreate } = setupTransaction();

    const { assignReviewer } = await import("@/lib/instructor-application-actions");
    const result = await assignReviewer("app-1", "reviewer-99");

    expect(result.success).toBe(true);
    expect(txTimelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: "app-1",
        kind: "REVIEWER_ASSIGNED",
        actorId: "admin-1",
        payload: expect.objectContaining({
          reviewerId: "reviewer-99",
          previousReviewerId: null,
        }),
      }),
    });
  });

  it("records previousReviewerId when a reviewer is being replaced", async () => {
    await setupAdminSession();

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      status: "UNDER_REVIEW",
      reviewerId: "old-reviewer",
      applicant: { chapterId: "chapter-1" },
    });
    mockUserFindUnique.mockResolvedValueOnce({
      chapterId: "chapter-1",
      roles: [{ role: "ADMIN" }],
    });

    const { txTimelineCreate } = setupTransaction();

    const { assignReviewer } = await import("@/lib/instructor-application-actions");
    const result = await assignReviewer("app-1", "new-reviewer");

    expect(result.success).toBe(true);
    expect(txTimelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "REVIEWER_ASSIGNED",
        payload: expect.objectContaining({
          reviewerId: "new-reviewer",
          previousReviewerId: "old-reviewer",
        }),
      }),
    });
  });

  it("rolls back the timeline event when the transaction throws", async () => {
    await setupAdminSession();

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      status: "SUBMITTED",
      reviewerId: null,
      applicant: { chapterId: "chapter-1" },
    });
    mockUserFindUnique.mockResolvedValueOnce({
      chapterId: "chapter-1",
      roles: [{ role: "ADMIN" }],
    });

    mockTransaction.mockImplementationOnce(async () => {
      throw new Error("DB constraint violation");
    });

    const { assignReviewer } = await import("@/lib/instructor-application-actions");
    const result = await assignReviewer("app-1", "reviewer-99");

    expect(result.success).toBe(false);
    expect(mockTimelineCreate).not.toHaveBeenCalled();
  });
});

// ─── INTERVIEWER_REMOVED ──────────────────────────────────────────────────────

describe("INTERVIEWER_REMOVED timeline event — removeInterviewer()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  async function setupAdminSession() {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"], email: "admin@test.com" },
    } as never);

    const { getHiringActor, assertCanManageApplication } = await import(
      "@/lib/chapter-hiring-permissions"
    );
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "admin-1",
      roles: ["ADMIN"],
      chapterId: null,
    } as never);
    vi.mocked(assertCanManageApplication).mockReturnValue(undefined);
  }

  it("creates an INTERVIEWER_REMOVED event with role, round, and reason in payload", async () => {
    await setupAdminSession();

    mockInterviewerFindUnique.mockResolvedValueOnce({
      id: "assign-1",
      applicationId: "app-1",
      interviewerId: "interviewer-1",
      role: "LEAD",
      round: 1,
      removedAt: null,
      application: {
        id: "app-1",
        applicantId: "applicant-1",
        reviewerId: "reviewer-1",
        interviewRound: 1,
        applicant: { chapterId: "chapter-1" },
      },
    });

    const { txTimelineCreate } = setupTransaction();

    const { removeInterviewer } = await import("@/lib/instructor-application-actions");
    const fd = new FormData();
    fd.set("assignmentId", "assign-1");
    fd.set("reason", "Conflict of interest");

    const result = await removeInterviewer(fd);

    expect(result.success).toBe(true);
    expect(txTimelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: "app-1",
        kind: "INTERVIEWER_REMOVED",
        actorId: "admin-1",
        payload: expect.objectContaining({
          interviewerId: "interviewer-1",
          role: "LEAD",
          round: 1,
          reason: "Conflict of interest",
        }),
      }),
    });
  });

  it("sets reason to null when no reason is provided", async () => {
    await setupAdminSession();

    mockInterviewerFindUnique.mockResolvedValueOnce({
      id: "assign-2",
      applicationId: "app-2",
      interviewerId: "interviewer-2",
      role: "SECOND",
      round: 2,
      removedAt: null,
      application: {
        id: "app-2",
        applicantId: "applicant-2",
        reviewerId: "reviewer-1",
        interviewRound: 2,
        applicant: { chapterId: "chapter-1" },
      },
    });

    const { txTimelineCreate } = setupTransaction();

    const { removeInterviewer } = await import("@/lib/instructor-application-actions");
    const fd = new FormData();
    fd.set("assignmentId", "assign-2");

    const result = await removeInterviewer(fd);

    expect(result.success).toBe(true);
    expect(txTimelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        kind: "INTERVIEWER_REMOVED",
        payload: expect.objectContaining({ reason: null }),
      }),
    });
  });

  it("rolls back when the transaction throws", async () => {
    await setupAdminSession();

    mockInterviewerFindUnique.mockResolvedValueOnce({
      id: "assign-3",
      applicationId: "app-3",
      interviewerId: "interviewer-3",
      role: "LEAD",
      round: 1,
      removedAt: null,
      application: {
        id: "app-3",
        applicantId: "applicant-3",
        reviewerId: "reviewer-1",
        interviewRound: 1,
        applicant: { chapterId: "chapter-1" },
      },
    });

    mockTransaction.mockImplementationOnce(async () => {
      throw new Error("DB error");
    });

    const { removeInterviewer } = await import("@/lib/instructor-application-actions");
    const fd = new FormData();
    fd.set("assignmentId", "assign-3");

    const result = await removeInterviewer(fd);

    expect(result.success).toBe(false);
    expect(mockTimelineCreate).not.toHaveBeenCalled();
  });
});

// ─── SCORES_UPDATED ───────────────────────────────────────────────────────────

describe("SCORES_UPDATED timeline event — saveScoresAndNotes()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  async function setupAdminSession() {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "admin-1", roles: ["ADMIN"], email: "admin@test.com" },
    } as never);

    const { getHiringActor, assertCanManageApplication } = await import(
      "@/lib/chapter-hiring-permissions"
    );
    vi.mocked(getHiringActor).mockResolvedValue({
      id: "admin-1",
      roles: ["ADMIN"],
      chapterId: null,
    } as never);
    vi.mocked(assertCanManageApplication).mockReturnValue(undefined);
  }

  it("creates a SCORES_UPDATED event with only changed fields in payload", async () => {
    await setupAdminSession();

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      applicant: { chapterId: "chapter-1" },
      scoreAcademic: null,
      scoreCommunication: null,
      scoreLeadership: null,
      scoreMotivation: null,
      scoreFit: null,
      scoreSubjectKnowledge: null,
      scoreTeachingMethodology: null,
      scoreCurriculumAlignment: null,
      curriculumReviewSummary: null,
      reviewerNotes: null,
    });

    const { txTimelineCreate } = setupTransaction();

    const { saveScoresAndNotes } = await import("@/lib/instructor-application-actions");
    const result = await saveScoresAndNotes("app-1", {
      scoreAcademic: 4,
      scoreCommunication: 3,
    });

    expect(result.success).toBe(true);
    expect(txTimelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: "app-1",
        kind: "SCORES_UPDATED",
        actorId: "admin-1",
        payload: expect.objectContaining({
          changed: expect.objectContaining({
            scoreAcademic: { from: null, to: 4 },
            scoreCommunication: { from: null, to: 3 },
          }),
        }),
      }),
    });

    const callArg = txTimelineCreate.mock.calls[0][0].data.payload;
    expect(Object.keys(callArg.changed)).not.toContain("scoreLeadership");
  });

  it("skips creating the event when no fields changed", async () => {
    await setupAdminSession();

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      applicant: { chapterId: "chapter-1" },
      scoreAcademic: 5,
      scoreCommunication: null,
      scoreLeadership: null,
      scoreMotivation: null,
      scoreFit: null,
      scoreSubjectKnowledge: null,
      scoreTeachingMethodology: null,
      scoreCurriculumAlignment: null,
      curriculumReviewSummary: null,
      reviewerNotes: null,
    });

    const { txTimelineCreate } = setupTransaction();

    const { saveScoresAndNotes } = await import("@/lib/instructor-application-actions");
    // Passing the same value that is already stored
    const result = await saveScoresAndNotes("app-1", { scoreAcademic: 5 });

    expect(result.success).toBe(true);
    expect(txTimelineCreate).not.toHaveBeenCalled();
  });

  it("rolls back the timeline event when the transaction throws", async () => {
    await setupAdminSession();

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      applicant: { chapterId: "chapter-1" },
      scoreAcademic: null,
      scoreCommunication: null,
      scoreLeadership: null,
      scoreMotivation: null,
      scoreFit: null,
      scoreSubjectKnowledge: null,
      scoreTeachingMethodology: null,
      scoreCurriculumAlignment: null,
      curriculumReviewSummary: null,
      reviewerNotes: null,
    });

    mockTransaction.mockImplementationOnce(async () => {
      throw new Error("DB error");
    });

    const { saveScoresAndNotes } = await import("@/lib/instructor-application-actions");
    const result = await saveScoresAndNotes("app-1", { scoreAcademic: 3 });

    expect(result.success).toBe(false);
    expect(mockTimelineCreate).not.toHaveBeenCalled();
  });
});

// ─── INFO_REQUESTED ───────────────────────────────────────────────────────────

describe("INFO_REQUESTED timeline event — requestMoreInfo()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("creates an INFO_REQUESTED event with the truncated message in payload", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      status: "UNDER_REVIEW",
      applicant: { name: "Alice", email: "alice@test.com" },
    });

    const { txTimelineCreate } = setupTransaction();

    const { requestMoreInfo } = await import("@/lib/instructor-application-actions");
    const result = await requestMoreInfo("app-1", "reviewer-1", "Please send transcripts.");

    expect(result).toBeUndefined(); // void function
    expect(txTimelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: "app-1",
        kind: "INFO_REQUESTED",
        actorId: "reviewer-1",
        payload: { message: "Please send transcripts." },
      }),
    });
  });

  it("truncates message payload to 500 characters", async () => {
    const longMessage = "x".repeat(600);

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      status: "UNDER_REVIEW",
      applicant: { name: "Alice", email: "alice@test.com" },
    });

    const { txTimelineCreate } = setupTransaction();

    const { requestMoreInfo } = await import("@/lib/instructor-application-actions");
    await requestMoreInfo("app-1", "reviewer-1", longMessage);

    const payloadMessage = txTimelineCreate.mock.calls[0][0].data.payload.message as string;
    expect(payloadMessage.length).toBe(500);
  });

  it("rolls back when the transaction throws", async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      reviewerId: "reviewer-1",
      status: "UNDER_REVIEW",
      applicant: { name: "Alice", email: "alice@test.com" },
    });

    mockTransaction.mockImplementationOnce(async () => {
      throw new Error("DB error");
    });

    const { requestMoreInfo } = await import("@/lib/instructor-application-actions");
    await expect(requestMoreInfo("app-1", "reviewer-1", "Some message")).rejects.toThrow(
      "DB error"
    );
    expect(mockTimelineCreate).not.toHaveBeenCalled();
  });
});

// ─── INFO_RESPONSE_RECEIVED ───────────────────────────────────────────────────

describe("INFO_RESPONSE_RECEIVED timeline event — submitInfoResponse()", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it("creates an INFO_RESPONSE_RECEIVED event with responseLength in payload", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "applicant-1", roles: [], email: "applicant@test.com" },
    } as never);

    const responseText = "Here are my transcripts.";

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      status: "INFO_REQUESTED",
      infoRequestReturnStatus: "UNDER_REVIEW",
    });

    const { txTimelineCreate } = setupTransaction();

    const { submitInfoResponse } = await import("@/lib/instructor-application-actions");
    const fd = new FormData();
    fd.set("applicantResponse", responseText);

    const result = await submitInfoResponse({ status: "idle", message: "" }, fd);

    expect(result.status).toBe("success");
    expect(txTimelineCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        applicationId: "app-1",
        kind: "INFO_RESPONSE_RECEIVED",
        actorId: "applicant-1",
        payload: { responseLength: responseText.length },
      }),
    });
  });

  it("does not store the full response text in the payload", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "applicant-1", roles: [], email: "applicant@test.com" },
    } as never);

    const responseText = "Private applicant data that must not be stored in the payload.";

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      status: "INFO_REQUESTED",
      infoRequestReturnStatus: "UNDER_REVIEW",
    });

    const { txTimelineCreate } = setupTransaction();

    const { submitInfoResponse } = await import("@/lib/instructor-application-actions");
    const fd = new FormData();
    fd.set("applicantResponse", responseText);

    await submitInfoResponse({ status: "idle", message: "" }, fd);

    const payload = txTimelineCreate.mock.calls[0][0].data.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("response");
    expect(payload).not.toHaveProperty("applicantResponse");
    expect(payload.responseLength).toBe(responseText.length);
  });

  it("rolls back when the transaction throws", async () => {
    const { getSession } = await import("@/lib/auth-supabase");
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "applicant-1", roles: [], email: "applicant@test.com" },
    } as never);

    mockFindUnique.mockResolvedValueOnce({
      id: "app-1",
      applicantId: "applicant-1",
      status: "INFO_REQUESTED",
      infoRequestReturnStatus: "UNDER_REVIEW",
    });

    mockTransaction.mockImplementationOnce(async () => {
      throw new Error("DB error");
    });

    const { submitInfoResponse } = await import("@/lib/instructor-application-actions");
    const fd = new FormData();
    fd.set("applicantResponse", "Some response");

    const result = await submitInfoResponse({ status: "idle", message: "" }, fd);

    expect(result.status).toBe("error");
    expect(mockTimelineCreate).not.toHaveBeenCalled();
  });
});
