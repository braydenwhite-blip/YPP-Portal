import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ success: true })),
}));

vi.mock("@/lib/email", () => ({
  sendAccountSetupEmail: vi.fn(),
}));

vi.mock("@/lib/portal-auth-utils", () => ({
  ensureSupabaseAuthUser: vi.fn(),
  generateSupabaseRecoveryLink: vi.fn(),
}));

import { sendAccountSetupEmail } from "@/lib/email";
import { signUpFamily } from "@/lib/family-signup-actions";
import { ensureSupabaseAuthUser, generateSupabaseRecoveryLink } from "@/lib/portal-auth-utils";
import { prisma } from "@/lib/prisma";

function buildFamilyFormData() {
  const formData = new FormData();
  formData.set("parentName", "Pat Parent");
  formData.set("parentEmail", "parent@example.com");
  formData.set("parentPhone", "555-111-2222");
  formData.set("studentName", "Jordan Student");
  formData.set("studentEmail", "student@example.com");
  formData.set("studentDateOfBirth", "2010-04-01");
  formData.set("studentGrade", "9");
  formData.set("studentSchool", "Lincoln High School");
  formData.set("chapterId", "chapter-1");
  formData.set("city", "Phoenix");
  formData.set("stateProvince", "Arizona");
  formData.set("studentUsesParentPhone", "on");
  return formData;
}

describe("signUpFamily", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (prisma as any).chapter.findUnique = vi.fn().mockResolvedValue({ id: "chapter-1" });
    (prisma as any).user.findUnique = vi.fn();
    (prisma as any).user.create = vi.fn();
    (prisma as any).user.update = vi.fn();
    (prisma as any).userRole.upsert = vi.fn().mockResolvedValue({});
    (prisma as any).userProfile.upsert = vi.fn().mockResolvedValue({});
    (prisma as any).parentStudent.upsert = vi.fn().mockResolvedValue({});

    vi.mocked(ensureSupabaseAuthUser)
      .mockResolvedValueOnce("auth-parent")
      .mockResolvedValueOnce("auth-student");
    vi.mocked(generateSupabaseRecoveryLink)
      .mockResolvedValueOnce("https://setup.parent")
      .mockResolvedValueOnce("https://setup.student");
    vi.mocked(sendAccountSetupEmail).mockResolvedValue({ success: true } as any);
  });

  it("creates both family accounts, links them immediately, and uses the parent phone for the student when requested", async () => {
    (prisma as any).user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    (prisma as any).user.create
      .mockResolvedValueOnce({
        id: "parent-1",
        name: "Pat Parent",
        email: "parent@example.com",
        phone: "555-111-2222",
        primaryRole: "PARENT",
        chapterId: "chapter-1",
        supabaseAuthId: "auth-parent",
        roles: [{ role: "PARENT" }],
        profile: null,
      })
      .mockResolvedValueOnce({
        id: "student-1",
        name: "Jordan Student",
        email: "student@example.com",
        phone: "555-111-2222",
        primaryRole: "STUDENT",
        chapterId: "chapter-1",
        supabaseAuthId: "auth-student",
        roles: [{ role: "STUDENT" }],
        profile: null,
      });

    const result = await signUpFamily(initialState(), buildFamilyFormData());

    expect(result).toEqual({
      status: "success",
      message: "FAMILY_SETUP_SENT",
    });
    expect((prisma as any).user.create).toHaveBeenCalledTimes(2);
    expect((prisma as any).user.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          email: "student@example.com",
          phone: "555-111-2222",
          chapterId: "chapter-1",
        }),
      })
    );
    expect((prisma as any).userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          school: "Lincoln High School",
          dateOfBirth: "2010-04-01",
          city: "Phoenix",
          stateProvince: "Arizona",
          usesParentPhone: true,
        }),
      })
    );
    expect((prisma as any).parentStudent.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          parentId: "parent-1",
          studentId: "student-1",
          approvalStatus: "APPROVED",
        }),
      })
    );
    expect(vi.mocked(sendAccountSetupEmail)).toHaveBeenCalledTimes(2);
  });

  it("reuses safe existing parent and student accounts instead of creating duplicates", async () => {
    (prisma as any).user.findUnique
      .mockResolvedValueOnce({
        id: "parent-1",
        name: "Pat Parent",
        email: "parent@example.com",
        phone: "555-111-2222",
        primaryRole: "PARENT",
        chapterId: "chapter-1",
        supabaseAuthId: "auth-parent",
        archivedAt: null,
        roles: [{ role: "PARENT" }],
        profile: null,
      })
      .mockResolvedValueOnce({
        id: "student-1",
        name: "Jordan Student",
        email: "student@example.com",
        phone: "555-333-4444",
        primaryRole: "STUDENT",
        chapterId: "chapter-1",
        supabaseAuthId: "auth-student",
        archivedAt: null,
        roles: [{ role: "STUDENT" }],
        profile: { id: "profile-1" },
      });

    (prisma as any).user.update
      .mockResolvedValueOnce({
        id: "parent-1",
        roles: [{ role: "PARENT" }],
        profile: null,
      })
      .mockResolvedValueOnce({
        id: "student-1",
        roles: [{ role: "STUDENT" }],
        profile: { id: "profile-1" },
      });

    const result = await signUpFamily(initialState(), buildFamilyFormData());

    expect(result.status).toBe("success");
    expect((prisma as any).user.create).not.toHaveBeenCalled();
    expect((prisma as any).user.update).toHaveBeenCalledTimes(2);
  });

  it("rejects when the same email is used for the parent and the student", async () => {
    const formData = buildFamilyFormData();
    formData.set("studentEmail", "parent@example.com");

    const result = await signUpFamily(initialState(), formData);

    expect(result).toEqual({
      status: "error",
      message: "Parent and student need different email addresses so each person can get their own setup link.",
    });
  });

  it("rejects when the student email already belongs to a non-student account", async () => {
    (prisma as any).user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "mentor-1",
        archivedAt: null,
        roles: [{ role: "MENTOR" }],
      });

    const result = await signUpFamily(initialState(), buildFamilyFormData());

    expect(result).toEqual({
      status: "error",
      message: "That student email already belongs to a non-student account. Please use a different student email address.",
    });
  });

  it("requires the student school during family signup", async () => {
    const formData = buildFamilyFormData();
    formData.delete("studentSchool");

    const result = await signUpFamily(initialState(), formData);

    expect(result).toEqual({
      status: "error",
      message: "Please enter the student's school.",
    });
  });

  it("rejects names that do not look real", async () => {
    const formData = buildFamilyFormData();
    formData.set("studentName", "12345");

    const result = await signUpFamily(initialState(), formData);

    expect(result).toEqual({
      status: "error",
      message: "Student full name should look like a real name.",
    });
  });
});

function initialState() {
  return {
    status: "idle" as const,
    message: "",
  };
}
