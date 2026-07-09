import { beforeEach, describe, expect, it, vi } from "vitest";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

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

import { saveGoalReview, approveGoalReview, requestReviewChanges } from "@/lib/goal-review-actions";

describe("goal-review-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(getSession).mockResolvedValue({
      user: { id: "mentor-1", roles: ["MENTOR"] },
    } as any);

    (prisma as any).monthlySelfReflection = {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "reflection-1",
        mentorshipId: "ms-1",
        cycleMonth: new Date("2026-05-01T00:00:00.000Z"),
        cycleNumber: 5,
        submittedAt: new Date(),
        mentorship: {
          mentorId: "mentor-1",
          menteeId: "mentee-1",
          chairId: null,
          reviewStreak: 1,
          longestReviewStreak: 2,
        },
        mentee: { name: "Mentee One" },
        goalReview: null,
      }),
    };
    (prisma as any).mentorGoalReview = {
      create: vi.fn().mockResolvedValue({ id: "review-1" }),
      update: vi.fn().mockResolvedValue({ id: "review-1" }),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
    };
    (prisma as any).mentorship = {
      findFirstOrThrow: vi.fn().mockResolvedValue({ id: "ms-1" }),
      update: vi.fn().mockResolvedValue({ id: "ms-1" }),
    };
    (prisma as any).mentorshipRequest = {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "request-1" }),
    };
    (prisma as any).user = {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ name: "Mentee One", primaryRole: "INSTRUCTOR" })
        .mockResolvedValueOnce({ name: "Mentor One" }),
    };
    (prisma as any).goalReviewRating = {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    (prisma as any).mentorGoalReviewGoalSnapshot = {
      findMany: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    };
    (prisma as any).gRDocumentGoal = {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma as any).achievementPointSummary = {
      upsert: vi.fn().mockResolvedValue({ id: "summary-1", totalPoints: 0 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "summary-1", totalPoints: 100 }),
      update: vi.fn().mockResolvedValue({}),
    };
    (prisma as any).achievementPointLog = {
      create: vi.fn().mockResolvedValue({}),
    };
  });

  it("never mutates GRDocumentGoal at draft/submit time — only approveGoalReview() (release) may", async () => {
    const formData = new FormData();
    formData.set("reflectionId", "reflection-1");
    formData.set("overallRating", "ACHIEVED");
    formData.set("overallComments", "Solid month overall.");
    formData.set("planOfAction", "Keep building on this momentum.");
    formData.set("submitForApproval", "true");
    formData.append("grGoalIds", "goal-1");
    formData.set("goal_goal-1_rating", "ACHIEVED");
    formData.set("goal_goal-1_progressState", "IN_PROGRESS");
    formData.set("goal_goal-1_lifecycleStatus", "COMPLETED");

    await saveGoalReview(formData);

    // The proposed progress/lifecycle update must be carried on the rating
    // row, never applied to the live goal before the chair approves.
    expect((prisma as any).gRDocumentGoal.update).not.toHaveBeenCalled();
    expect((prisma as any).mentorGoalReview.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          goalRatings: {
            create: [
              expect.objectContaining({
                grDocumentGoalId: "goal-1",
                proposedProgressState: "IN_PROGRESS",
                proposedLifecycleStatus: "COMPLETED",
              }),
            ],
          },
        }),
      })
    );
  });

  it("applies the proposed goal update only on approveGoalReview() (release)", async () => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "chair-1", roles: ["ADMIN"] },
    } as any);

    (prisma as any).mentorGoalReview.findUniqueOrThrow = vi.fn().mockResolvedValue({
      id: "review-1",
      status: "PENDING_CHAIR_APPROVAL",
      overallRating: "ACHIEVED",
      cycleNumber: 5,
      cycleMonth: new Date("2026-05-01T00:00:00.000Z"),
      bonusPoints: 0,
      mentee: { id: "mentee-1", name: "Mentee One", primaryRole: "INSTRUCTOR" },
      mentor: { id: "mentor-1" },
      menteeId: "mentee-1",
      goalRatings: [
        {
          grDocumentGoalId: "goal-1",
          proposedProgressState: "IN_PROGRESS",
          proposedLifecycleStatus: "COMPLETED",
        },
      ],
    });
    (prisma as any).mentorGoalReview.findUnique = vi
      .fn()
      .mockResolvedValue({ mentorshipId: "ms-1" });
    // assertReviewApprovalAuthority resolves each participant's org authority —
    // give the chair a higher authority than the mentor/mentee so the
    // "approver outranks author" rule passes instead of failing open or
    // blocking on identical/self-approval authority.
    (prisma as any).user.findUnique = vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
      if (where.id === "chair-1") {
        return Promise.resolve({
          id: "chair-1",
          name: "Chair One",
          title: null,
          primaryRole: "ADMIN",
          internalLevel: 6,
          ladder: "LEADERSHIP",
          canonicalTitle: "Senior Officer",
          adminSubtypes: [],
        });
      }
      return Promise.resolve({
        id: where.id,
        name: "Some Person",
        title: null,
        primaryRole: "INSTRUCTOR",
        internalLevel: 1,
        ladder: "INSTRUCTION",
        canonicalTitle: "Instructor",
        adminSubtypes: [],
      });
    });

    const formData = new FormData();
    formData.set("reviewId", "review-1");

    await approveGoalReview(formData);

    expect((prisma as any).gRDocumentGoal.update).toHaveBeenCalledWith({
      where: { id: "goal-1" },
      data: expect.objectContaining({
        progressState: "IN_PROGRESS",
        lifecycleStatus: "COMPLETED",
        completedAt: expect.any(Date),
      }),
    });
  });

  it("opens a private admin attention request for submitted red reviews", async () => {
    const formData = new FormData();
    formData.set("reflectionId", "reflection-1");
    formData.set("overallRating", "BEHIND_SCHEDULE");
    formData.set("overallComments", "Needs a reset plan.");
    formData.set("planOfAction", "Schedule a support meeting and narrow the next goal.");
    formData.set("submitForApproval", "true");

    await saveGoalReview(formData);

    expect((prisma as any).mentorshipRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        mentorshipId: "ms-1",
        menteeId: "mentee-1",
        requesterId: "mentor-1",
        kind: "ESCALATION",
        visibility: "PRIVATE",
        status: "OPEN",
        title: "Red monthly review: Mentee One cycle 5",
      }),
    });
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith("/admin/mentorship");
  });

  describe("requestReviewChanges — Role Chair authorization", () => {
    function mockReviewForChairCheck() {
      (prisma as any).mentorGoalReview.findUniqueOrThrow = vi.fn().mockResolvedValue({
        id: "review-1",
        status: "PENDING_CHAIR_APPROVAL",
        mentee: { name: "Mentee One", primaryRole: "INSTRUCTOR" },
        mentor: { id: "mentor-1" },
      });
      (prisma as any).mentorGoalReview.update = vi
        .fn()
        .mockResolvedValue({ mentorshipId: "ms-1" });
    }

    it("lets a non-admin who chairs the mentee's committee lane request changes", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: "chair-1", roles: ["CHAPTER_PRESIDENT"], adminSubtypes: [] },
      } as any);
      mockReviewForChairCheck();
      (prisma as any).mentorCommitteeChair = {
        findUnique: vi.fn().mockResolvedValue({ isActive: true }),
      };

      const formData = new FormData();
      formData.set("reviewId", "review-1");
      formData.set("chairComments", "Please add more detail on goal 2.");

      await expect(requestReviewChanges(formData)).resolves.not.toThrow();
      expect((prisma as any).mentorCommitteeChair.findUnique).toHaveBeenCalledWith({
        where: { userId_roleType: { userId: "chair-1", roleType: "INSTRUCTOR" } },
        select: { isActive: true },
      });
      expect((prisma as any).mentorGoalReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "review-1" },
          data: expect.objectContaining({ status: "CHANGES_REQUESTED", chairReviewerId: "chair-1" }),
        })
      );
    });

    it("rejects a non-admin who does not chair the mentee's committee lane", async () => {
      vi.mocked(getSession).mockResolvedValue({
        user: { id: "rando-1", roles: ["MENTOR"], adminSubtypes: [] },
      } as any);
      mockReviewForChairCheck();
      (prisma as any).mentorCommitteeChair = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      const formData = new FormData();
      formData.set("reviewId", "review-1");
      formData.set("chairComments", "Not my lane.");

      await expect(requestReviewChanges(formData)).rejects.toThrow(/Unauthorized/);
      expect((prisma as any).mentorGoalReview.update).not.toHaveBeenCalled();
    });
  });
});
