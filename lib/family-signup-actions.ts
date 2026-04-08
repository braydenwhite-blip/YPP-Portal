"use server";

import { Prisma, RoleType } from "@prisma/client";

import { sendAccountSetupEmail } from "@/lib/email";
import { ensureSupabaseAuthUser, generateSupabaseRecoveryLink } from "@/lib/portal-auth-utils";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  parseOptionalPhone,
  parseRequiredDateOfBirth,
  parseRequiredEmail,
  parseRequiredHumanName,
  parseRequiredPhone,
  parseRequiredSchool,
  parseRequiredStudentGrade,
} from "@/lib/student-profile";

type FormState = {
  status: "idle" | "error" | "success";
  message: string;
};

type PortalUser = Prisma.UserGetPayload<{
  include: {
    profile: true;
    roles: true;
  };
}> | null;

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function hasRole(user: PortalUser, role: RoleType) {
  return Boolean(user?.roles.some((entry) => entry.role === role));
}

function isStudentOnlyAccount(user: PortalUser) {
  return Boolean(
    user &&
      user.roles.length === 1 &&
      user.roles[0]?.role === RoleType.STUDENT
  );
}

function buildRoles(user: PortalUser, roleToEnsure: RoleType) {
  return Array.from(
    new Set([...(user?.roles.map((entry) => entry.role) ?? []), roleToEnsure])
  );
}

async function upsertPortalRole(userId: string, role: RoleType) {
  await prisma.userRole.upsert({
    where: {
      userId_role: {
        userId,
        role,
      },
    },
    update: {},
    create: {
      userId,
      role,
    },
  });
}

async function syncParentUser(params: {
  chapterId: string;
  email: string;
  existingUser: PortalUser;
  name: string;
  phone: string;
  supabaseAuthId: string;
}) {
  const roles = buildRoles(params.existingUser, RoleType.PARENT);
  const shouldUpdateChapter =
    !params.existingUser?.chapterId ||
    params.existingUser.primaryRole === RoleType.PARENT ||
    hasRole(params.existingUser, RoleType.PARENT);

  if (params.existingUser) {
    const updated = await prisma.user.update({
      where: { id: params.existingUser.id },
      data: {
        name: params.name,
        phone: params.phone,
        emailVerified: new Date(),
        supabaseAuthId: params.supabaseAuthId,
        ...(shouldUpdateChapter ? { chapterId: params.chapterId } : {}),
      },
      include: {
        roles: true,
        profile: true,
      },
    });

    await upsertPortalRole(updated.id, RoleType.PARENT);
    return {
      user: updated,
      roles,
    };
  }

  const created = await prisma.user.create({
    data: {
      name: params.name,
      email: params.email,
      phone: params.phone,
      passwordHash: "",
      primaryRole: RoleType.PARENT,
      chapterId: params.chapterId,
      emailVerified: new Date(),
      supabaseAuthId: params.supabaseAuthId,
      roles: {
        create: [{ role: RoleType.PARENT }],
      },
    },
    include: {
      roles: true,
      profile: true,
    },
  });

  return {
    user: created,
    roles,
  };
}

async function syncStudentUser(params: {
  chapterId: string;
  city: string;
  dateOfBirth: string;
  email: string;
  existingUser: PortalUser;
  grade: number;
  name: string;
  parentEmail: string;
  parentPhone: string;
  phone: string | null;
  school: string;
  stateProvince: string;
  studentUsesParentPhone: boolean;
  supabaseAuthId: string;
}) {
  const roles = buildRoles(params.existingUser, RoleType.STUDENT);

  const user =
    params.existingUser
      ? await prisma.user.update({
          where: { id: params.existingUser.id },
          data: {
            name: params.name,
            phone: params.phone,
            chapterId: params.chapterId,
            emailVerified: new Date(),
            supabaseAuthId: params.supabaseAuthId,
          },
          include: {
            roles: true,
            profile: true,
          },
        })
      : await prisma.user.create({
          data: {
            name: params.name,
            email: params.email,
            phone: params.phone,
            passwordHash: "",
            primaryRole: RoleType.STUDENT,
            chapterId: params.chapterId,
            emailVerified: new Date(),
            supabaseAuthId: params.supabaseAuthId,
            roles: {
              create: [{ role: RoleType.STUDENT }],
            },
          },
          include: {
            roles: true,
            profile: true,
          },
        });

  await upsertPortalRole(user.id, RoleType.STUDENT);

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: {
      grade: params.grade,
      school: params.school,
      parentEmail: params.parentEmail,
      parentPhone: params.parentPhone,
      dateOfBirth: params.dateOfBirth,
      city: params.city,
      stateProvince: params.stateProvince,
      usesParentPhone: params.studentUsesParentPhone,
    },
    create: {
      userId: user.id,
      interests: [],
      grade: params.grade,
      school: params.school,
      parentEmail: params.parentEmail,
      parentPhone: params.parentPhone,
      dateOfBirth: params.dateOfBirth,
      city: params.city,
      stateProvince: params.stateProvince,
      usesParentPhone: params.studentUsesParentPhone,
    },
  });

  return {
    user,
    roles,
  };
}

export async function signUpFamily(
  _prevState: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    const parentName = parseRequiredHumanName(getString(formData, "parentName", false), "Parent full name");
    const parentEmail = parseRequiredEmail(getString(formData, "parentEmail", false), "parent email");
    const parentPhone = parseRequiredPhone(getString(formData, "parentPhone", false), "parent phone");
    const studentName = parseRequiredHumanName(getString(formData, "studentName", false), "Student full name");
    const studentEmail = parseRequiredEmail(getString(formData, "studentEmail", false), "student email");
    const studentDateOfBirth = parseRequiredDateOfBirth(getString(formData, "studentDateOfBirth", false), "student date of birth");
    const studentGrade = parseRequiredStudentGrade(getString(formData, "studentGrade", false));
    const studentSchool = parseRequiredSchool(getString(formData, "studentSchool", false));
    const chapterId = getString(formData, "chapterId");
    const city = getString(formData, "city");
    const stateProvince = getString(formData, "stateProvince");
    const studentUsesParentPhone = formData.get("studentUsesParentPhone") === "on";
    const studentPhoneInput = getString(formData, "studentPhone", false);
    const studentPhone = studentUsesParentPhone
      ? parentPhone
      : parseOptionalPhone(studentPhoneInput, "student phone");

    if (parentEmail === studentEmail) {
      return {
        status: "error",
        message: "Parent and student need different email addresses so each person can get their own setup link.",
      };
    }

    const rl = checkRateLimit(`family-signup:${parentEmail}`, 5, 15 * 60 * 1000);
    if (!rl.success) {
      return { status: "error", message: "Too many attempts. Please try again later." };
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true },
    });

    if (!chapter) {
      return {
        status: "error",
        message: "Please choose a valid chapter.",
      };
    }

    const [existingParent, existingStudent] = await Promise.all([
      prisma.user.findUnique({
        where: { email: parentEmail },
        include: {
          roles: true,
          profile: true,
        },
      }),
      prisma.user.findUnique({
        where: { email: studentEmail },
        include: {
          roles: true,
          profile: true,
        },
      }),
    ]);

    if (existingParent?.archivedAt) {
      return {
        status: "error",
        message: "That parent email belongs to an archived account. Please contact support to restore it.",
      };
    }

    if (existingStudent?.archivedAt) {
      return {
        status: "error",
        message: "That student email belongs to an archived account. Please contact support to restore it.",
      };
    }

    if (existingParent && isStudentOnlyAccount(existingParent)) {
      return {
        status: "error",
        message: "That parent email already belongs to a student-only account. Please use a different parent email address.",
      };
    }

    if (existingStudent && !hasRole(existingStudent, RoleType.STUDENT)) {
      return {
        status: "error",
        message: "That student email already belongs to a non-student account. Please use a different student email address.",
      };
    }

    const parentRoles = buildRoles(existingParent, RoleType.PARENT);
    const parentPrimaryRole =
      existingParent?.primaryRole && existingParent.primaryRole !== RoleType.STUDENT
        ? existingParent.primaryRole
        : RoleType.PARENT;
    const parentSupabaseAuthId = await ensureSupabaseAuthUser({
      email: parentEmail,
      name: parentName,
      existingSupabaseAuthId: existingParent?.supabaseAuthId,
      primaryRole: parentPrimaryRole,
      chapterId:
        existingParent?.primaryRole === RoleType.PARENT || !existingParent?.chapterId
          ? chapterId
          : existingParent.chapterId,
      prismaUserId: existingParent?.id,
      roles: parentRoles,
      portalArchived: false,
    });

    const studentRoles = buildRoles(existingStudent, RoleType.STUDENT);
    const studentPrimaryRole = existingStudent?.primaryRole ?? RoleType.STUDENT;
    const studentSupabaseAuthId = await ensureSupabaseAuthUser({
      email: studentEmail,
      name: studentName,
      existingSupabaseAuthId: existingStudent?.supabaseAuthId,
      primaryRole: studentPrimaryRole,
      chapterId,
      prismaUserId: existingStudent?.id,
      roles: studentRoles,
      portalArchived: false,
    });

    const { user: parentUser } = await syncParentUser({
      existingUser: existingParent,
      name: parentName,
      email: parentEmail,
      phone: parentPhone,
      chapterId,
      supabaseAuthId: parentSupabaseAuthId,
    });

    const { user: studentUser } = await syncStudentUser({
      existingUser: existingStudent,
      name: studentName,
      email: studentEmail,
      phone: studentPhone,
      chapterId,
      supabaseAuthId: studentSupabaseAuthId,
      grade: studentGrade,
      school: studentSchool,
      dateOfBirth: studentDateOfBirth,
      city,
      stateProvince,
      parentEmail,
      parentPhone,
      studentUsesParentPhone,
    });

    await prisma.parentStudent.upsert({
      where: {
        parentId_studentId: {
          parentId: parentUser.id,
          studentId: studentUser.id,
        },
      },
      update: {
        relationship: "Parent",
        isPrimary: true,
        approvalStatus: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: null,
        archivedAt: null,
      },
      create: {
        parentId: parentUser.id,
        studentId: studentUser.id,
        relationship: "Parent",
        isPrimary: true,
        approvalStatus: "APPROVED",
        reviewedAt: new Date(),
      },
    });

    try {
      const [parentSetupUrl, studentSetupUrl] = await Promise.all([
        generateSupabaseRecoveryLink(parentEmail),
        generateSupabaseRecoveryLink(studentEmail),
      ]);

      const [parentEmailResult, studentEmailResult] = await Promise.all([
        sendAccountSetupEmail({
          to: parentEmail,
          name: parentName,
          roleLabel: "Parent",
          setupUrl: parentSetupUrl,
        }),
        sendAccountSetupEmail({
          to: studentEmail,
          name: studentName,
          roleLabel: "Student",
          setupUrl: studentSetupUrl,
        }),
      ]);

      if (!parentEmailResult.success || !studentEmailResult.success) {
        return {
          status: "error",
          message:
            "We created the family accounts, but we could not send one or both setup emails. Please use Forgot password for the parent and student emails to finish setup.",
        };
      }
    } catch (error) {
      console.error("[FamilySignup] Failed to deliver setup emails:", error);
      return {
        status: "error",
        message:
          "We created the family accounts, but we could not send the setup emails. Please use Forgot password for the parent and student emails to finish setup.",
      };
    }

    return {
      status: "success",
      message: "FAMILY_SETUP_SENT",
    };
  } catch (error) {
    if (error instanceof Error && error.message) {
      return {
        status: "error",
        message: error.message,
      };
    }

    console.error("[FamilySignup] Unexpected error:", error);
    return {
      status: "error",
      message: "Something went wrong. Please try again.",
    };
  }
}
