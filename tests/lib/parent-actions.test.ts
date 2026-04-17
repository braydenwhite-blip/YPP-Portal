import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/portal-auth-utils", () => ({
  ensureSupabaseAuthUser: vi.fn(),
  updateSupabasePortalUser: vi.fn(),
}));

import { getSession } from "@/lib/auth-supabase";
import {
  archiveManagedStudentAccount,
  updateManagedStudentProfile,
  type ManagedStudentFormState,
} from "@/lib/parent-actions";
import { ensureSupabaseAuthUser, updateSupabasePortalUser } from "@/lib/portal-auth-utils";
import { prisma } from "@/lib/prisma";

const initialState: ManagedStudentFormState = {
  status: "idle",
  message: "",
};

function buildUpdateFormData() {
  const formData = new FormData();
  formData.set("studentId", "student-1");
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

function buildManagedLink() {
  return {
    id: "link-1",
    parentId: "parent-1",
    studentId: "student-1",
    approvalStatus: "APPROVED",
    archivedAt: null,
    parent: {
      id: "parent-1",
      name: "Pat Parent",
      email: "parent@example.com",
      phone: "555-111-2222",
      primaryRole: "PARENT",
      chapterId: "chapter-1",
      supabaseAuthId: "auth-parent",
      roles: [{ role: "PARENT" }],
    },
    student: {
      id: "student-1",
      name: "Jordan Student",
      email: "student@example.com",
      phone: "555-111-2222",
      primaryRole: "STUDENT",
      chapterId: "chapter-1",
      supabaseAuthId: "auth-student",
      roles: [{ role: "STUDENT" }],
      profile: {
        id: "profile-1",
        usesParentPhone: true,
      },
      chapter: { id: "chapter-1", name: "Phoenix" },
    },
  };
}

describe("parent managed student actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue({
      user: {
        id: "parent-1",
        email: "parent@example.com",
        roles: ["PARENT"],
      },
    } as any);

    (prisma as any).parentStudent.findFirst = vi.fn();
    (prisma as any).chapter.findUnique = vi.fn().mockResolvedValue({ id: "chapter-1" });
    (prisma as any).user.findUnique = vi.fn().mockResolvedValue({ id: "student-1" });
    (prisma as any).user.update = vi.fn().mockResolvedValue({});
    (prisma as any).userProfile.upsert = vi.fn().mockResolvedValue({});
    (prisma as any).parentStudent.updateMany = vi.fn().mockResolvedValue({});
    (prisma as any).parentStudent.count = vi.fn().mockResolvedValue(0);

    vi.mocked(ensureSupabaseAuthUser).mockResolvedValue("auth-student");
    vi.mocked(updateSupabasePortalUser).mockResolvedValue(undefined);
  });

  it("updates the student profile and syncs the auth account", async () => {
    (prisma as any).parentStudent.findFirst.mockResolvedValue(buildManagedLink());

    const result = await updateManagedStudentProfile(initialState, buildUpdateFormData());

    expect(result).toEqual({
      status: "success",
      message: "Student info updated.",
    });
    expect(vi.mocked(ensureSupabaseAuthUser)).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "student@example.com",
        name: "Jordan Student",
        chapterId: "chapter-1",
      })
    );
    expect((prisma as any).user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "student-1" },
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
  });

  it("returns an error when the parent is not allowed to update the student", async () => {
    (prisma as any).parentStudent.findFirst.mockResolvedValue(null);

    const result = await updateManagedStudentProfile(initialState, buildUpdateFormData());

    expect(result).toEqual({
      status: "error",
      message: "You do not have permission to update this student.",
    });
  });

  it("rejects out-of-range grades for managed students", async () => {
    (prisma as any).parentStudent.findFirst.mockResolvedValue(buildManagedLink());

    const formData = buildUpdateFormData();
    formData.set("studentGrade", "13");

    const result = await updateManagedStudentProfile(initialState, formData);

    expect(result).toEqual({
      status: "error",
      message: "Please choose a grade between 1 and 12.",
    });
  });

  it("archives the student account and archives the parent account when it is the only active family link", async () => {
    (prisma as any).parentStudent.findFirst.mockResolvedValue(buildManagedLink());

    const formData = new FormData();
    formData.set("studentId", "student-1");
    formData.set("confirmStudentEmail", "student@example.com");

    await archiveManagedStudentAccount(initialState, formData);

    expect((prisma as any).parentStudent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          studentId: "student-1",
        }),
      })
    );
    expect((prisma as any).user.update).toHaveBeenCalledTimes(2);
    expect(vi.mocked(updateSupabasePortalUser)).toHaveBeenCalledTimes(2);
  });
});
