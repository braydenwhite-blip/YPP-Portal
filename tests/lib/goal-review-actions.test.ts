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

import { saveGoalReview } from "@/lib/goal-review-actions";

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
});
