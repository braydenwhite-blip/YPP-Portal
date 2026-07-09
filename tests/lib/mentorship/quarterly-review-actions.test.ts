import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSession, getSessionUser } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

// quarterly-review-actions.ts imports requireReviewApprover from
// goal-review-actions.ts, which pulls in this same dependency graph —
// mirror the mocks from tests/lib/goal-review-actions.test.ts so importing
// that file doesn't hit real workflow/notification/milestone side effects.
vi.mock("@/lib/workflow", () => ({
  syncMentorGoalReviewWorkflow: vi.fn(),
}));
vi.mock("@/lib/mentorship-cycle", () => ({
  recomputeMentorshipCycleStage: vi.fn(),
}));
vi.mock("@/lib/mentorship-notifications", () => ({
  emitReviewSubmittedForApproval: vi.fn(),
  emitReviewApprovedAndReleased: vi.fn(),
}));
vi.mock("@/lib/mentorship-gr-binding", () => ({
  ensureReviewGoalRatings: vi.fn(),
}));
vi.mock("@/lib/mentorship-program-actions", () => ({
  createMentorshipNotification: vi.fn(),
}));
vi.mock("@/lib/milestones", () => ({
  insertMilestoneOnce: vi.fn(),
  checkTenureMilestones: vi.fn(),
}));
vi.mock("@/lib/audit-log-actions", () => ({
  logAuditEvent: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  approveQuarterlyReview,
  boardApproveQuarterlyReview,
  requestQuarterlyReviewChanges,
  startQuarterlyReview,
} from "@/lib/mentorship/quarterly-review-actions";

function mentorSession(overrides: Partial<{ id: string; roles: string[]; adminSubtypes: string[] }> = {}) {
  vi.mocked(getSession).mockResolvedValue({
    user: { id: "mentor-1", roles: ["MENTOR"], adminSubtypes: [], ...overrides },
  } as any);
}

describe("startQuarterlyReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentorSession();
    (prisma as any).mentorship = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "ms-1", mentorId: "mentor-1", menteeId: "mentee-1" }),
    };
    (prisma as any).mentorGoalReview = {
      findFirst: vi.fn().mockResolvedValue({ cycleNumber: 3, cycleMonth: new Date("2026-07-01") }),
      findMany: vi.fn().mockResolvedValue([{ id: "review-1" }, { id: "review-2" }, { id: "review-3" }]),
    };
    (prisma as any).mentorshipQuarterlyReview = {
      upsert: vi.fn().mockResolvedValue({ id: "qr-1", status: "DRAFT" }),
    };
    (prisma as any).mentorshipQuarterlyReviewEvidence = {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 3 }),
    };
  });

  it("lets the assigned mentor start a quarterly review on a due cycle", async () => {
    const result = await startQuarterlyReview({ mentorshipId: "ms-1" });
    expect(result.ok).toBe(true);
    expect((prisma as any).mentorshipQuarterlyReview.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mentorshipId_quarter: { mentorshipId: "ms-1", quarter: "2026-Q3" } },
        create: expect.objectContaining({ mentorshipId: "ms-1", menteeId: "mentee-1", cycleNumber: 3 }),
      })
    );
  });

  it("rejects a non-mentor, non-admin caller", async () => {
    mentorSession({ id: "rando-1" });
    await expect(startQuarterlyReview({ mentorshipId: "ms-1" })).rejects.toThrow(
      "Only the assigned mentor (or an admin) can start a quarterly review."
    );
  });

  it("rejects a mentorship that isn't on a quarterly (3rd/6th/9th...) cycle", async () => {
    (prisma as any).mentorGoalReview.findFirst = vi
      .fn()
      .mockResolvedValue({ cycleNumber: 4, cycleMonth: new Date("2026-08-01") });
    await expect(startQuarterlyReview({ mentorshipId: "ms-1" })).rejects.toThrow(
      "This mentorship is not due for a quarterly review right now."
    );
  });
});

describe("approveQuarterlyReview — Role Chair authorization + Board routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets a lane chair approve a CONTINUATION decision directly (no Board needed)", async () => {
    mentorSession({ id: "chair-1", roles: ["CHAPTER_PRESIDENT"] });
    (prisma as any).mentorshipQuarterlyReview = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "qr-1",
        status: "PENDING_CHAIR_APPROVAL",
        decision: "CONTINUATION",
        chairComments: null,
        mentee: { id: "mentee-1", primaryRole: "INSTRUCTOR" },
        menteeId: "mentee-1",
      }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma as any).mentorCommitteeChair = {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    };

    const result = await approveQuarterlyReview({ reviewId: "qr-1" });
    expect(result.requiresBoardApproval).toBe(false);
    expect((prisma as any).mentorshipQuarterlyReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "qr-1" },
        data: expect.objectContaining({ status: "APPROVED", requiresBoardApproval: false }),
      })
    );
  });

  it("routes a PROMOTION decision for a Global Leadership mentee to Board approval instead of finalizing", async () => {
    mentorSession({ id: "chair-1", roles: ["CHAPTER_PRESIDENT"] });
    (prisma as any).mentorshipQuarterlyReview = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "qr-2",
        status: "PENDING_CHAIR_APPROVAL",
        decision: "PROMOTION",
        chairComments: null,
        mentee: { id: "mentee-2", primaryRole: "ADMIN" }, // toMenteeRoleType("ADMIN") -> GLOBAL_LEADERSHIP
        menteeId: "mentee-2",
      }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma as any).mentorCommitteeChair = {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    };

    const result = await approveQuarterlyReview({ reviewId: "qr-2" });
    expect(result.requiresBoardApproval).toBe(true);
    expect((prisma as any).mentorshipQuarterlyReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING_BOARD_APPROVAL", requiresBoardApproval: true }),
      })
    );
  });

  it("rejects a caller who isn't the lane chair or an admin", async () => {
    mentorSession({ id: "rando-1", roles: ["MENTOR"] });
    (prisma as any).mentorshipQuarterlyReview = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "qr-3",
        status: "PENDING_CHAIR_APPROVAL",
        decision: "CONTINUATION",
        mentee: { id: "mentee-3", primaryRole: "INSTRUCTOR" },
        menteeId: "mentee-3",
      }),
      update: vi.fn(),
    };
    (prisma as any).mentorCommitteeChair = {
      findUnique: vi.fn().mockResolvedValue(null),
    };

    await expect(approveQuarterlyReview({ reviewId: "qr-3" })).rejects.toThrow(/Unauthorized/);
    expect((prisma as any).mentorshipQuarterlyReview.update).not.toHaveBeenCalled();
  });

  it("rejects approving a review that isn't waiting on chair approval", async () => {
    mentorSession({ id: "chair-1", roles: ["ADMIN"] });
    (prisma as any).mentorshipQuarterlyReview = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "qr-4",
        status: "DRAFT",
        decision: null,
        mentee: { id: "mentee-4", primaryRole: "INSTRUCTOR" },
        menteeId: "mentee-4",
      }),
      update: vi.fn(),
    };
    await expect(approveQuarterlyReview({ reviewId: "qr-4" })).rejects.toThrow(
      "This quarterly review is not waiting on chair approval."
    );
  });
});

describe("requestQuarterlyReviewChanges", () => {
  it("lets the lane chair send the packet back for revision", async () => {
    mentorSession({ id: "chair-1", roles: ["CHAPTER_PRESIDENT"] });
    (prisma as any).mentorshipQuarterlyReview = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "qr-5",
        status: "PENDING_CHAIR_APPROVAL",
        chairComments: null,
        mentee: { id: "mentee-5", primaryRole: "INSTRUCTOR" },
        menteeId: "mentee-5",
      }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma as any).mentorCommitteeChair = {
      findUnique: vi.fn().mockResolvedValue({ isActive: true }),
    };

    await requestQuarterlyReviewChanges({ reviewId: "qr-5", chairComments: "Needs more evidence." });
    expect((prisma as any).mentorshipQuarterlyReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CHANGES_REQUESTED" }),
      })
    );
  });
});

describe("boardApproveQuarterlyReview", () => {
  // requireBoard() (lib/authorization.ts) resolves its session via
  // getSessionUser() (lib/auth-supabase.ts), NOT getSession() — a different
  // function than the getSession()-based session used by every other action
  // in this file. Mock that one specifically for these two tests.
  it("finalizes a Board-pending review once a Board-level user approves", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "board-1",
      roles: ["ADMIN"],
      primaryRole: "ADMIN",
      adminSubtypes: ["SUPER_ADMIN"],
      internalLevel: null,
      ladder: null,
      canonicalTitle: null,
      title: null,
      email: "board@example.com",
    } as any);
    (prisma as any).mentorshipQuarterlyReview = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "qr-6", status: "PENDING_BOARD_APPROVAL", menteeId: "mentee-6" }),
      update: vi.fn().mockResolvedValue({}),
    };

    await boardApproveQuarterlyReview({ reviewId: "qr-6" });
    expect((prisma as any).mentorshipQuarterlyReview.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED", boardApproverId: "board-1" }),
      })
    );
  });

  it("rejects a non-Board caller", async () => {
    vi.mocked(getSessionUser).mockResolvedValue({
      id: "rando-1",
      roles: ["MENTOR"],
      primaryRole: "MENTOR",
      adminSubtypes: [],
      internalLevel: 1,
      ladder: null,
      canonicalTitle: null,
      title: null,
      email: "rando@example.com",
    } as any);
    (prisma as any).mentorshipQuarterlyReview = {
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    };

    await expect(boardApproveQuarterlyReview({ reviewId: "qr-7" })).rejects.toThrow("Unauthorized");
    expect((prisma as any).mentorshipQuarterlyReview.update).not.toHaveBeenCalled();
  });
});
