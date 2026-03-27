import { beforeEach, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/notification-actions", () => ({
  createBulkSystemNotifications: vi.fn(),
  createSystemNotification: vi.fn(),
}));

vi.mock("@/lib/email-verification-actions", () => ({
  sendVerificationEmail: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { approveStudentIntakeCase } from "@/lib/student-intake-actions";
import { createSystemNotification } from "@/lib/notification-actions";
import { sendVerificationEmail } from "@/lib/email-verification-actions";

describe("student-intake-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServerSession).mockResolvedValue({
      user: {
        id: "lead-1",
        roles: ["CHAPTER_PRESIDENT"],
      },
    } as any);

    (prisma as any).user.findUnique = vi.fn();
    (prisma as any).user.create = vi.fn();
    (prisma as any).userProfile = {
      create: vi.fn(),
      update: vi.fn(),
    };
    (prisma as any).parentStudent = {
      upsert: vi.fn(),
    };
    (prisma as any).studentIntakeCase = {
      findUnique: vi.fn(),
      update: vi.fn(),
    };
    (prisma as any).studentIntakeMilestone = {
      create: vi.fn(),
    };
    (prisma as any).mentorshipActionItem = {
      findMany: vi.fn(),
      createMany: vi.fn(),
    };
  });

  it("creates a new student, approves the link, and launches the mentor plan", async () => {
    (prisma as any).user.findUnique
      .mockResolvedValueOnce({
        id: "lead-1",
        chapterId: "chapter-1",
        chapter: { id: "chapter-1", name: "Austin" },
        roles: [{ role: "CHAPTER_PRESIDENT" }],
      })
      .mockResolvedValueOnce(null);

    (prisma as any).studentIntakeCase.findUnique
      .mockResolvedValueOnce({
        id: "case-1",
        parentId: "parent-1",
        studentUserId: null,
        chapterId: "chapter-1",
        status: "SUBMITTED",
        studentName: "Jordan Patel",
        studentEmail: "jordan@example.com",
        studentGrade: 9,
        studentSchool: "Austin High",
        relationship: "Parent",
        interests: ["Coding", "Design"],
        goals: ["Join a class"],
        supportNeeds: "Needs encouragement",
        parentNotes: "Excited but nervous",
        reviewerNote: null,
        blockerNote: null,
        nextAction: null,
        reviewOwnerId: null,
        reviewedById: null,
        submittedAt: new Date("2026-03-27T10:00:00.000Z"),
        reviewedAt: null,
        mentorPlanLaunchedAt: null,
        createdAt: new Date("2026-03-27T09:00:00.000Z"),
        parent: {
          id: "parent-1",
          name: "Pat Patel",
          email: "parent@example.com",
          phone: "555-111-2222",
        },
        chapter: {
          id: "chapter-1",
          name: "Austin",
        },
        studentUser: null,
      })
      .mockResolvedValueOnce({
        id: "case-1",
        parentId: "parent-1",
        studentUserId: "student-1",
        studentName: "Jordan Patel",
        reviewOwnerId: "lead-1",
        mentorPlanLaunchedAt: null,
        status: "APPROVED",
      });

    (prisma as any).user.create.mockResolvedValue({
      id: "student-1",
    });
    (prisma as any).mentorshipActionItem.findMany.mockResolvedValue([]);

    const formData = new FormData();
    formData.set("id", "case-1");

    await approveStudentIntakeCase(formData);

    expect((prisma as any).user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Jordan Patel",
          email: "jordan@example.com",
          primaryRole: "STUDENT",
          chapterId: "chapter-1",
        }),
      })
    );
    expect((prisma as any).parentStudent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId_studentId: {
            parentId: "parent-1",
            studentId: "student-1",
          },
        },
      })
    );
    expect((prisma as any).mentorshipActionItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          mentorshipId: null,
          menteeId: "student-1",
          createdById: "lead-1",
        }),
      ]),
    });
    expect(vi.mocked(sendVerificationEmail)).toHaveBeenCalledWith("student-1");
    expect(vi.mocked(createSystemNotification)).toHaveBeenCalled();
  });

  it("links to an existing student instead of creating a duplicate account", async () => {
    (prisma as any).user.findUnique
      .mockResolvedValueOnce({
        id: "lead-1",
        chapterId: "chapter-1",
        chapter: { id: "chapter-1", name: "Austin" },
        roles: [{ role: "CHAPTER_PRESIDENT" }],
      })
      .mockResolvedValueOnce({
        id: "student-existing",
        email: "jordan@example.com",
        roles: [{ role: "STUDENT" }],
        profile: {
          grade: 10,
          school: "Austin High",
          interests: ["Robotics"],
          parentEmail: null,
          parentPhone: null,
        },
      });

    (prisma as any).studentIntakeCase.findUnique
      .mockResolvedValueOnce({
        id: "case-1",
        parentId: "parent-1",
        studentUserId: null,
        chapterId: "chapter-1",
        status: "UNDER_REVIEW",
        studentName: "Jordan Patel",
        studentEmail: "jordan@example.com",
        studentGrade: 9,
        studentSchool: "Austin High",
        relationship: "Parent",
        interests: ["Coding"],
        goals: ["Join a class"],
        supportNeeds: null,
        parentNotes: null,
        reviewerNote: null,
        blockerNote: null,
        nextAction: "Review complete",
        reviewOwnerId: "lead-1",
        reviewedById: null,
        submittedAt: new Date("2026-03-27T10:00:00.000Z"),
        reviewedAt: null,
        mentorPlanLaunchedAt: null,
        createdAt: new Date("2026-03-27T09:00:00.000Z"),
        parent: {
          id: "parent-1",
          name: "Pat Patel",
          email: "parent@example.com",
          phone: "555-111-2222",
        },
        chapter: {
          id: "chapter-1",
          name: "Austin",
        },
        studentUser: null,
      })
      .mockResolvedValueOnce({
        id: "case-1",
        parentId: "parent-1",
        studentUserId: "student-existing",
        studentName: "Jordan Patel",
        reviewOwnerId: "lead-1",
        mentorPlanLaunchedAt: null,
        status: "APPROVED",
      });

    (prisma as any).mentorshipActionItem.findMany.mockResolvedValue([{ id: "item-1" }]);

    const formData = new FormData();
    formData.set("id", "case-1");

    await approveStudentIntakeCase(formData);

    expect((prisma as any).user.create).not.toHaveBeenCalled();
    expect((prisma as any).parentStudent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId_studentId: {
            parentId: "parent-1",
            studentId: "student-existing",
          },
        },
      })
    );
    expect(vi.mocked(sendVerificationEmail)).not.toHaveBeenCalled();
  });
});
