/**
 * Unit tests for batchUpdateStatus in lib/application-cohort-actions.ts
 *
 * Risks covered:
 *   - Invalid status string → ok:false, no DB writes
 *   - Valid APPROVED transition → updates, creates timeline event, sends approval email
 *   - Mix of valid + invalid-transition apps → only valid ones updated, skipped reported
 *   - Email failure does not abort the rest of the batch
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
const mockTimelineCreate = vi.fn();
const mockTransaction = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    instructorApplication: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
    chapterPresidentApplication: {
      findMany: mockFindMany,
      update: mockUpdate,
    },
    instructorApplicationTimelineEvent: {
      create: mockTimelineCreate,
    },
    $transaction: mockTransaction,
  },
}));

vi.mock("@/lib/auth-supabase", () => ({
  getSession: vi.fn(async () => ({
    user: { id: "admin-1", roles: ["ADMIN"] },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockSendApproved = vi.fn();
const mockSendRejected = vi.fn();
const mockSendPreApproved = vi.fn();
const mockSendInfoRequest = vi.fn();
const mockSendInterviewScheduled = vi.fn();

vi.mock("@/lib/email", () => ({
  sendApplicationApprovedEmail: (...args: unknown[]) => mockSendApproved(...args),
  sendApplicationRejectedEmail: (...args: unknown[]) => mockSendRejected(...args),
  sendInstructorPreApprovedEmail: (...args: unknown[]) => mockSendPreApproved(...args),
  sendInfoRequestEmail: (...args: unknown[]) => mockSendInfoRequest(...args),
  sendInterviewScheduledEmail: (...args: unknown[]) => mockSendInterviewScheduled(...args),
}));

vi.mock("@/lib/public-app-url", () => ({
  getPublicAppUrl: vi.fn(() => "https://portal.test"),
}));

vi.mock("@/lib/portal-auth-utils", () => ({
  getBaseUrl: vi.fn(async () => "https://portal.test"),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeApp(id: string, status: string) {
  return {
    id,
    status,
    applicant: { id: `user-${id}`, email: `${id}@test.com`, name: `User ${id}` },
  };
}

/** Wire mockTransaction to actually run the callback with a fake tx client. */
function setupTransaction() {
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
    const fakeTx = {
      instructorApplication: { update: mockUpdate },
      instructorApplicationTimelineEvent: { create: mockTimelineCreate },
    };
    return fn(fakeTx);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("batchUpdateStatus — instructor applications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupTransaction();
  });

  it("returns ok:false for an invalid status string without touching the DB", async () => {
    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");

    const result = await batchUpdateStatus("cohort-1", "NOT_A_REAL_STATUS", "instructor");

    expect(result).toEqual({ ok: false, error: "Invalid status" });
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("updates, creates a timeline event, and emails on a valid APPROVED transition", async () => {
    // INTERVIEW_COMPLETED → APPROVED is the valid path for the "approve" action.
    mockFindMany.mockResolvedValueOnce([makeApp("app-1", "INTERVIEW_COMPLETED")]);
    mockSendApproved.mockResolvedValue({ success: true });

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "APPROVED", "instructor");

    expect(result).toMatchObject({ ok: true, total: 1, updated: 1, emailed: 1, emailFailures: 0 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toHaveLength(0);

    // Transaction must have run
    expect(mockTransaction).toHaveBeenCalledTimes(1);

    // Timeline event created with correct kind and payload
    expect(mockTimelineCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: "STATUS_CHANGE_BATCH",
          actorId: "admin-1",
          payload: expect.objectContaining({
            fromStatus: "INTERVIEW_COMPLETED",
            toStatus: "APPROVED",
            batchAction: true,
          }),
        }),
      })
    );

    // Approval email sent
    expect(mockSendApproved).toHaveBeenCalledWith(
      expect.objectContaining({ to: "app-1@test.com", applicantName: "User app-1" })
    );
  });

  it("skips apps whose transition is invalid and only updates the valid ones", async () => {
    // app-good: INTERVIEW_COMPLETED → APPROVED (valid)
    // app-bad:  SUBMITTED → APPROVED (invalid — must complete interview first)
    mockFindMany.mockResolvedValueOnce([
      makeApp("app-good", "INTERVIEW_COMPLETED"),
      makeApp("app-bad", "SUBMITTED"),
    ]);
    mockSendApproved.mockResolvedValue({ success: true });

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "APPROVED", "instructor");

    expect(result).toMatchObject({ ok: true, total: 2, updated: 1, emailed: 1, emailFailures: 0 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id).toBe("app-bad");
    expect(result.skipped[0].reason).toMatch(/interview/i);

    // Transaction only ran for app-good
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockSendApproved).toHaveBeenCalledTimes(1);
  });

  it("also skips apps that are already in a final status (REJECTED → APPROVED)", async () => {
    mockFindMany.mockResolvedValueOnce([makeApp("app-final", "REJECTED")]);

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "APPROVED", "instructor");

    expect(result).toMatchObject({ ok: true, total: 1, updated: 0, emailed: 0 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id).toBe("app-final");
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("counts an email failure without aborting the batch", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeApp("app-1", "INTERVIEW_COMPLETED"),
      makeApp("app-2", "INTERVIEW_COMPLETED"),
    ]);
    // First email succeeds, second throws.
    mockSendApproved
      .mockResolvedValueOnce({ success: true })
      .mockRejectedValueOnce(new Error("SMTP timeout"));

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "APPROVED", "instructor");

    expect(result).toMatchObject({ ok: true, total: 2, updated: 2, emailed: 1, emailFailures: 1 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toHaveLength(0);
    // Both transactions committed
    expect(mockTransaction).toHaveBeenCalledTimes(2);
  });

  it("sends the correct email for REJECTED status", async () => {
    mockFindMany.mockResolvedValueOnce([makeApp("app-1", "SUBMITTED")]);
    mockSendRejected.mockResolvedValue({ success: true });

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "REJECTED", "instructor");

    expect(result).toMatchObject({ ok: true, total: 1, updated: 1, emailed: 1, emailFailures: 0 });
    expect(mockSendRejected).toHaveBeenCalledWith(
      expect.objectContaining({ to: "app-1@test.com" })
    );
    expect(mockSendApproved).not.toHaveBeenCalled();
  });

  it("sends no email for intermediate statuses like UNDER_REVIEW", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeApp("app-1", "SUBMITTED"),
      makeApp("app-2", "ON_HOLD"),
    ]);

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "UNDER_REVIEW", "instructor");

    expect(result).toMatchObject({ ok: true, total: 2, updated: 2, emailed: 0, emailFailures: 0 });
    expect(mockSendApproved).not.toHaveBeenCalled();
    expect(mockSendRejected).not.toHaveBeenCalled();
  });
});

describe("batchUpdateStatus — chapter_president applications", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // CP branch does not use $transaction — it calls update directly.
    mockUpdate.mockResolvedValue({});
  });

  it("returns ok:false for an invalid status string", async () => {
    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "GARBAGE", "chapter_president");
    expect(result).toEqual({ ok: false, error: "Invalid status" });
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it("updates and emails on a valid APPROVED transition", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeApp("cp-1", "INTERVIEW_COMPLETED"),
    ]);
    mockSendApproved.mockResolvedValue({ success: true });

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "APPROVED", "chapter_president");

    expect(result).toMatchObject({ ok: true, total: 1, updated: 1, emailed: 1, emailFailures: 0 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toHaveLength(0);
    expect(mockSendApproved).toHaveBeenCalledWith(
      expect.objectContaining({ to: "cp-1@test.com" })
    );
    // No timeline table for CP — $transaction should NOT have been called.
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("skips invalid transitions and reports them", async () => {
    mockFindMany.mockResolvedValueOnce([
      makeApp("cp-good", "RECOMMENDATION_SUBMITTED"),
      makeApp("cp-bad", "SUBMITTED"),
    ]);
    mockSendApproved.mockResolvedValue({ success: true });

    const { batchUpdateStatus } = await import("@/lib/application-cohort-actions");
    const result = await batchUpdateStatus("cohort-1", "APPROVED", "chapter_president");

    expect(result).toMatchObject({ ok: true, total: 2, updated: 1 });
    if (!result.ok) throw new Error("expected ok");
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].id).toBe("cp-bad");
  });
});
