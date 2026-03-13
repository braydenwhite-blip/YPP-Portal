import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  requireOwnershipOrRole,
  requireAdmin,
  requireCourseInstructor,
  requireCanMessage,
  requireAttendanceAccess,
} from "@/lib/authorization-helpers";
import * as authorization from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

// Mock authorization module
vi.mock("@/lib/authorization", () => ({
  requireSessionUser: vi.fn(),
  requireAnyRole: vi.fn(),
}));

describe("Authorization Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireOwnershipOrRole", () => {
    it("should allow user to access their own resource", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "user-123",
        roles: ["STUDENT"],
        primaryRole: "STUDENT",
      });

      const result = await requireOwnershipOrRole("user-123");

      expect(result.id).toBe("user-123");
    });

    it("should allow admin to access any resource", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "admin-123",
        roles: ["ADMIN"],
        primaryRole: "ADMIN",
      });

      const result = await requireOwnershipOrRole("other-user-456");

      expect(result.id).toBe("admin-123");
    });

    it("should throw error when non-owner, non-admin tries to access", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "user-123",
        roles: ["STUDENT"],
        primaryRole: "STUDENT",
      });

      await expect(requireOwnershipOrRole("other-user-456")).rejects.toThrow(
        "You can only access your own resources"
      );
    });

    it("should allow staff to access any resource", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "staff-123",
        roles: ["STAFF"],
        primaryRole: "STAFF",
      });

      const result = await requireOwnershipOrRole("other-user-456");

      expect(result.id).toBe("staff-123");
    });
  });

  describe("requireAdmin", () => {
    it("should allow admin users", async () => {
      vi.mocked(authorization.requireAnyRole).mockResolvedValue({
        id: "admin-123",
        roles: ["ADMIN"],
        primaryRole: "ADMIN",
      });

      const result = await requireAdmin();

      expect(result.roles).toContain("ADMIN");
      expect(authorization.requireAnyRole).toHaveBeenCalledWith(["ADMIN"]);
    });

    it("should reject non-admin users", async () => {
      vi.mocked(authorization.requireAnyRole).mockRejectedValue(new Error("Unauthorized"));

      await expect(requireAdmin()).rejects.toThrow("Unauthorized");
    });
  });

  describe("requireCourseInstructor", () => {
    it("should allow admin to access any course", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "admin-123",
        roles: ["ADMIN"],
        primaryRole: "ADMIN",
      });

      const result = await requireCourseInstructor("course-123");

      expect(result.roles).toContain("ADMIN");
    });

    it("should allow course instructor to access their course", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "instructor-123",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      });

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: "course-123",
        leadInstructorId: "instructor-123",
      } as any);

      const result = await requireCourseInstructor("course-123");

      expect(result.id).toBe("instructor-123");
    });

    it("should reject instructor trying to access another instructor's course", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "instructor-123",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      });

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: "course-123",
        leadInstructorId: "other-instructor-456",
      } as any);

      await expect(requireCourseInstructor("course-123")).rejects.toThrow(
        "You are not the instructor of this course"
      );
    });

    it("should throw error when course not found", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "instructor-123",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      });

      vi.mocked(prisma.course.findUnique).mockResolvedValue(null);

      await expect(requireCourseInstructor("nonexistent-course")).rejects.toThrow(
        "Course not found"
      );
    });
  });

  describe("requireCanMessage", () => {
    const setupUser = (id: string, roles: string[], primaryRole: string) => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({ id, roles, primaryRole } as any);
    };

    it("should prevent messaging yourself", async () => {
      setupUser("user-123", ["STUDENT"], "STUDENT");

      await expect(requireCanMessage("user-123")).rejects.toThrow(
        "Cannot message yourself"
      );
    });

    it("should allow admins to message anyone", async () => {
      setupUser("admin-123", ["ADMIN"], "ADMIN");

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "recipient-456",
        roles: [{ role: "STUDENT" }],
      } as any);

      const result = await requireCanMessage("recipient-456");

      expect(result.roles).toContain("ADMIN");
    });

    it("should allow students to message instructors", async () => {
      setupUser("student-123", ["STUDENT"], "STUDENT");

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "instructor-456",
        roles: [{ role: "INSTRUCTOR" }],
      } as any);

      const result = await requireCanMessage("instructor-456");

      expect(result.primaryRole).toBe("STUDENT");
    });

    it("should prevent students from messaging other students", async () => {
      setupUser("student-123", ["STUDENT"], "STUDENT");

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "student-456",
        roles: [{ role: "STUDENT" }],
      } as any);

      await expect(requireCanMessage("student-456")).rejects.toThrow(
        "Students can only message instructors, mentors, staff, and chapter leads"
      );
    });

    it("should allow instructors to message students", async () => {
      setupUser("instructor-123", ["INSTRUCTOR"], "INSTRUCTOR");

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "student-456",
        roles: [{ role: "STUDENT" }],
      } as any);

      const result = await requireCanMessage("student-456");

      expect(result.primaryRole).toBe("INSTRUCTOR");
    });

    it("should allow mentors to message mentees", async () => {
      setupUser("mentor-123", ["MENTOR"], "MENTOR");

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "student-456",
        roles: [{ role: "STUDENT" }],
      } as any);

      const result = await requireCanMessage("student-456");

      expect(result.primaryRole).toBe("MENTOR");
    });

    it("should allow parents to message staff", async () => {
      setupUser("parent-123", ["PARENT"], "PARENT");

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "staff-456",
        roles: [{ role: "STAFF" }],
      } as any);

      const result = await requireCanMessage("staff-456");

      expect(result.primaryRole).toBe("PARENT");
    });

    it("should prevent parents from messaging students", async () => {
      setupUser("parent-123", ["PARENT"], "PARENT");

      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "student-456",
        roles: [{ role: "STUDENT" }],
      } as any);

      await expect(requireCanMessage("student-456")).rejects.toThrow(
        "Parents can only message staff, chapter leads, and instructors"
      );
    });

    it("should throw error when recipient not found", async () => {
      setupUser("user-123", ["STUDENT"], "STUDENT");

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(requireCanMessage("nonexistent-user")).rejects.toThrow(
        "Recipient not found"
      );
    });
  });

  describe("requireAttendanceAccess", () => {
    it("should allow admin to access any attendance", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "admin-123",
        roles: ["ADMIN"],
        primaryRole: "ADMIN",
      });

      const result = await requireAttendanceAccess();

      expect(result.roles).toContain("ADMIN");
    });

    it("should allow instructor to access their course attendance", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "instructor-123",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      });

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: "course-123",
        leadInstructorId: "instructor-123",
      } as any);

      const result = await requireAttendanceAccess(undefined, "course-123");

      expect(result.id).toBe("instructor-123");
    });

    it("should reject instructor trying to access another course attendance", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "instructor-123",
        roles: ["INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      });

      vi.mocked(prisma.course.findUnique).mockResolvedValue({
        id: "course-123",
        leadInstructorId: "other-instructor-456",
      } as any);

      await expect(requireAttendanceAccess(undefined, "course-123")).rejects.toThrow(
        "You cannot access these attendance records"
      );
    });

    it("should allow chapter leads to access attendance", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "lead-123",
        roles: ["CHAPTER_LEAD"],
        primaryRole: "CHAPTER_LEAD",
      });

      const result = await requireAttendanceAccess();

      expect(result.roles).toContain("CHAPTER_LEAD");
    });
  });

  describe("Edge Cases", () => {
    it("should handle null/undefined user IDs gracefully", async () => {
      vi.mocked(authorization.requireSessionUser).mockRejectedValue(new Error("Unauthorized"));

      await expect(requireOwnershipOrRole("some-user")).rejects.toThrow("Unauthorized");
    });

    it("should allow alternate roles when they are explicitly permitted", async () => {
      vi.mocked(authorization.requireSessionUser).mockResolvedValue({
        id: "multi-role-user",
        roles: ["STUDENT", "INSTRUCTOR"],
        primaryRole: "INSTRUCTOR",
      });

      const result = await requireOwnershipOrRole("other-user", ["INSTRUCTOR"]);

      expect(result.id).toBe("multi-role-user");
    });
  });
});
