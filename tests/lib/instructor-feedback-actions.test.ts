import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/authorization", () => ({
  requireSessionUser: vi.fn().mockResolvedValue({
    id: "admin-1",
    roles: ["ADMIN"],
    primaryRole: "ADMIN",
  }),
  hasRole: vi.fn((roles: string[], role: string) => roles.includes(role)),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import {
  createInstructorReceivedFeedback,
  createMentorshipNote,
  loadInstructorReviewContext,
  reorderInstructorReviewQuestions,
} from "@/lib/instructor-feedback-actions";

describe("instructor-feedback-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma as any).user = {
      findUnique: vi.fn().mockResolvedValue({ id: "instructor-1" }),
    };
    (prisma as any).mentorship = {
      findFirst: vi.fn().mockResolvedValue({ id: "ms-1" }),
    };
    (prisma as any).instructorReceivedFeedback = {
      create: vi.fn().mockResolvedValue({ id: "fb-1" }),
      findMany: vi.fn().mockResolvedValue([]),
    };
    (prisma as any).mentorGoalReview = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    (prisma as any).instructorReviewQuestion = {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({ id: "q-1" }),
    };
    (prisma as any).monthlySelfReflection = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    (prisma as any).mentorshipCheckIn = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    (prisma as any).mentorshipNote = {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "note-1" }),
    };
    (prisma as any).instructorReviewAnswer = {
      findMany: vi.fn().mockResolvedValue([]),
    };
    (prisma as any).$transaction = vi.fn(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops);
      if (typeof ops === "function") return (ops as (tx: typeof prisma) => Promise<unknown>)(prisma);
      return ops;
    });
  });

  it("creates received feedback with OFFICER source", async () => {
    await createInstructorReceivedFeedback({
      instructorId: "instructor-1",
      source: "OFFICER",
      feedbackDate: "2026-07-01",
      category: "Communication",
      rating: 4,
      comment: "Clear updates to families.",
    });

    expect((prisma as any).instructorReceivedFeedback.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          instructorId: "instructor-1",
          source: "OFFICER",
          category: "Communication",
          rating: 4,
          createdById: "admin-1",
        }),
      })
    );
  });

  it("creates a mentorship note", async () => {
    await createMentorshipNote({
      menteeId: "instructor-1",
      body: "Follow up on classroom management next month.",
    });
    expect((prisma as any).mentorshipNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          menteeId: "instructor-1",
          authorId: "admin-1",
          body: "Follow up on classroom management next month.",
        }),
      })
    );
  });

  it("loads inline review context with a chronological timeline", async () => {
    (prisma as any).instructorReceivedFeedback.findMany = vi.fn().mockResolvedValue([
      {
        id: "fb-1",
        source: "PARENT",
        feedbackDate: new Date("2026-06-01"),
        category: "Teaching",
        rating: 5,
        comment: "Loved class",
        createdBy: { name: "Admin" },
        createdAt: new Date(),
      },
    ]);
    (prisma as any).mentorGoalReview.findMany = vi.fn().mockResolvedValue([
      {
        id: "rev-1",
        cycleMonth: new Date("2026-05-01"),
        overallRating: "ACHIEVED",
        overallComments: "Solid month",
        planOfAction: "Keep going",
        status: "APPROVED",
        mentor: { name: "Mentor One" },
      },
    ]);

    const ctx = await loadInstructorReviewContext("instructor-1");
    expect(ctx.received).toHaveLength(1);
    expect(ctx.priorMentorReviews[0]?.planOfAction).toBe("Keep going");
    expect(ctx.timeline.length).toBeGreaterThanOrEqual(2);
    expect(ctx.timeline[0]?.date >= ctx.timeline[1]?.date).toBe(true);
    expect(ctx.canLogReceivedFeedback).toBe(true);
  });

  it("reorders review questions", async () => {
    await reorderInstructorReviewQuestions({
      orderedIds: ["q-a", "q-b"],
    });

    expect((prisma as any).$transaction).toHaveBeenCalled();
    expect((prisma as any).instructorReviewQuestion.update).toHaveBeenCalledTimes(2);
  });
});
