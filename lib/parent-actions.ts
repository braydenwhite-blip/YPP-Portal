"use server";

import { RoleType } from "@prisma/client";
import { redirect } from "next/navigation";

import { ensureSupabaseAuthUser, updateSupabasePortalUser } from "@/lib/portal-auth-utils";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  parseOptionalPhone,
  parseRequiredDateOfBirth,
  parseRequiredEmail,
  parseRequiredHumanName,
  parseRequiredSchool,
  parseRequiredStudentGrade,
} from "@/lib/student-profile";

export type ManagedStudentFormState = {
  status: "idle" | "error" | "success";
  message: string;
};

// ============================================
// AUTH HELPERS
// ============================================

async function requireAuth() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireParent() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT") && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Parent access required");
  }
  return session;
}

function getString(formData: FormData, key: string, required = true) {
  const value = formData.get(key);
  if (required && (!value || String(value).trim() === "")) {
    throw new Error(`Missing ${key}`);
  }
  return value ? String(value).trim() : "";
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function getApprovedManagedStudentLink(parentId: string, studentId: string) {
  return prisma.parentStudent.findFirst({
    where: {
      parentId,
      studentId,
      approvalStatus: "APPROVED",
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
    include: {
      parent: {
        include: {
          roles: true,
        },
      },
      student: {
        include: {
          roles: true,
          profile: true,
          chapter: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });
}

// ============================================
// GET LINKED STUDENTS
// ============================================

export async function getLinkedStudents() {
  const session = await requireParent();
  const parentId = session.user.id;

  const links = await prisma.parentStudent.findMany({
    where: {
      parentId,
      // Only show APPROVED links to parents
      // Parents can request links, but can't access data until approved
      approvalStatus: "APPROVED",
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          chapter: { select: { id: true, name: true } },
          profile: {
            select: { grade: true, school: true, avatarUrl: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return links.map((link) => ({
    id: link.id,
    studentId: link.student.id,
    name: link.student.name,
    email: link.student.email,
    relationship: link.relationship,
    isPrimary: link.isPrimary,
    chapter: link.student.chapter,
    grade: link.student.profile?.grade ?? null,
    school: link.student.profile?.school ?? null,
    avatarUrl: link.student.profile?.avatarUrl ?? null,
    linkedAt: link.createdAt,
  }));
}

// ============================================
// GET STUDENT PROGRESS
// ============================================

export async function getStudentProgress(studentId: string) {
  const session = await requireParent();
  const parentId = session.user.id;

  // Verify the parent has an APPROVED link to this student
  // Parents cannot access student data for PENDING or REJECTED links
  const link = await prisma.parentStudent.findFirst({
    where: {
      parentId,
      studentId,
      approvalStatus: "APPROVED",
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
  });

  if (!link) {
    throw new Error("You do not have access to this student's progress");
  }

  // Fetch the student with all progress-related data
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      archivedAt: null,
    },
    include: {
      chapter: true,
      enrollments: {
        include: {
          course: {
            select: {
              id: true,
              title: true,
              description: true,
              format: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      trainings: {
        select: {
          id: true,
          status: true,
          completedAt: true,
        },
      },
      certificates: {
        select: {
          id: true,
          title: true,
          issuedAt: true,
        },
        orderBy: { issuedAt: "desc" },
      },
      goals: {
        include: {
          template: {
            select: {
              id: true,
              title: true,
              description: true,
            },
          },
          progress: {
            orderBy: { createdAt: "desc" },
            take: 6,
          },
        },
      },
      attendanceRecords: {
        include: {
          session: {
            select: {
              id: true,
              title: true,
              date: true,
            },
          },
        },
      },
      profile: true,
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  const [challengeParticipations, incubatorProjects, latestIncubatorUpdate, studentInterests] = await Promise.all([
    prisma.challengeParticipant.findMany({
      where: { studentId },
      select: {
        status: true,
        currentStreak: true,
        longestStreak: true,
        lastCheckIn: true,
        challenge: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            endDate: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    }).catch(() => []),
    prisma.incubatorProject.findMany({
      where: { studentId },
      select: {
        id: true,
        title: true,
        currentPhase: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    }).catch(() => []),
    prisma.incubatorUpdate.findFirst({
      where: {
        project: { studentId },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
        projectId: true,
      },
    }).catch(() => null),
    prisma.studentInterest.findMany({
      where: { studentId },
      include: {
        passion: {
          select: { name: true, category: true, color: true, icon: true },
        },
      },
      orderBy: { xpPoints: "desc" },
    }).catch(() => []),
  ]);

  // Compute training summary
  const totalTrainings = student.trainings.length;
  const completedTrainings = student.trainings.filter(
    (t) => t.status === "COMPLETE"
  ).length;

  // Compute attendance summary
  const totalSessions = student.attendanceRecords.length;
  const presentCount = student.attendanceRecords.filter(
    (r) => r.status === "PRESENT"
  ).length;
  const absentCount = student.attendanceRecords.filter(
    (r) => r.status === "ABSENT"
  ).length;
  const lateCount = student.attendanceRecords.filter(
    (r) => r.status === "LATE"
  ).length;
  const excusedCount = student.attendanceRecords.filter(
    (r) => r.status === "EXCUSED"
  ).length;

  // Map goals with latest progress status + history
  const goals = student.goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    description: goal.template.description,
    latestStatus: goal.progress[0]?.status ?? null,
    latestComments: goal.progress[0]?.comments ?? null,
    lastUpdatedAt: goal.progress[0]?.createdAt ?? null,
    history: goal.progress.map((p) => ({
      status: p.status,
      createdAt: p.createdAt,
    })),
  }));

  // Build 8-week attendance trend
  const now = new Date();
  const attendanceTrend: Array<{ week: string; present: number; total: number }> = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - i * 7 - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const weekRecords = student.attendanceRecords.filter((r) => {
      const d = r.session?.date ? new Date(r.session.date) : null;
      return d && d >= weekStart && d < weekEnd;
    });
    const present = weekRecords.filter(
      (r) => r.status === "PRESENT" || r.status === "LATE"
    ).length;
    attendanceTrend.push({
      week: weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      present,
      total: weekRecords.length,
    });
  }

  // Map passion/skill areas
  const passions = studentInterests.map((si) => ({
    name: si.passion.name,
    category: String(si.passion.category),
    color: si.passion.color ?? null,
    icon: si.passion.icon ?? null,
    xpPoints: si.xpPoints,
    level: si.currentLevel,
    isPrimary: si.isPrimary,
  }));

  const activeChallenges = challengeParticipations.filter(
    (entry) =>
      entry.status === "ACTIVE" &&
      entry.challenge.status === "ACTIVE" &&
      entry.challenge.endDate >= new Date()
  );
  const completedChallenges = challengeParticipations.filter(
    (entry) => entry.status === "COMPLETED"
  );
  const bestChallengeStreak = challengeParticipations.reduce(
    (max, entry) => Math.max(max, entry.longestStreak),
    0
  );
  const lastChallengeCheckInAt = challengeParticipations
    .map((entry) => entry.lastCheckIn)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const latestIncubatorProject = incubatorProjects[0] ?? null;

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      primaryRole: student.primaryRole,
      chapter: student.chapter,
      profile: {
        grade: student.profile?.grade ?? null,
        school: student.profile?.school ?? null,
        parentEmail: student.profile?.parentEmail ?? null,
        parentPhone: student.profile?.parentPhone ?? null,
        dateOfBirth: student.profile?.dateOfBirth ?? null,
        city: student.profile?.city ?? null,
        stateProvince: student.profile?.stateProvince ?? null,
        usesParentPhone: student.profile?.usesParentPhone ?? false,
      },
    },
    enrollments: student.enrollments.map((e) => ({
      id: e.id,
      status: e.status,
      course: e.course,
      enrolledAt: e.createdAt,
    })),
    training: {
      total: totalTrainings,
      completed: completedTrainings,
    },
    certificates: student.certificates,
    goals,
    attendance: {
      totalSessions,
      presentCount,
      absentCount,
      lateCount,
      excusedCount,
    },
    attendanceTrend,
    passions,
    challenge: {
      activeCount: activeChallenges.length,
      completedCount: completedChallenges.length,
      bestStreak: bestChallengeStreak,
      lastCheckInAt: lastChallengeCheckInAt,
      activeChallenges: activeChallenges.map((entry) => ({
        id: entry.challenge.id,
        title: entry.challenge.title,
        type: entry.challenge.type,
        currentStreak: entry.currentStreak,
      })),
    },
    incubator: {
      activeProjectCount: incubatorProjects.length,
      latestProject: latestIncubatorProject
        ? {
            id: latestIncubatorProject.id,
            title: latestIncubatorProject.title,
            currentPhase: latestIncubatorProject.currentPhase,
            updatedAt: latestIncubatorProject.updatedAt,
          }
        : null,
      latestUpdate: latestIncubatorUpdate,
    },
  };
}

// ============================================
// LINK STUDENT
// ============================================

export async function linkStudent(formData: FormData) {
  const session = await requireParent();
  const parentId = session.user.id;

  const email = getString(formData, "email");
  const relationship = getString(formData, "relationship", false) || "Parent";

  // Find the student user by email
  const student = await prisma.user.findFirst({
    where: {
      email,
      archivedAt: null,
    },
    include: { roles: true },
  });

  if (!student) {
    throw new Error("No user found with that email address");
  }

  // Verify the user has the STUDENT role
  if (!student.roles.some((r) => r.role === "STUDENT")) {
    throw new Error("The specified user is not a student");
  }

  // Check if a link already exists between this parent and student
  const existing = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: { parentId, studentId: student.id },
    },
  });

  if (existing) {
    if (existing.archivedAt) {
      await prisma.parentStudent.update({
        where: { id: existing.id },
        data: {
          relationship,
          isPrimary: false,
          approvalStatus: "PENDING",
          archivedAt: null,
          reviewedAt: null,
          reviewedById: null,
        },
      });
      revalidatePath("/parent");
      revalidatePath("/parent/connect");
      return;
    }

    throw new Error("You are already linked to this student");
  }

  // Create link in pending state — requires admin approval before parent can view data
  await prisma.parentStudent.create({
    data: {
      parentId,
      studentId: student.id,
      relationship,
      isPrimary: false, // Set to true after admin approval
      approvalStatus: "PENDING",
    },
  });

  revalidatePath("/parent");
}

// ============================================
// ADMIN: APPROVE PARENT-STUDENT LINK
// ============================================

export async function approveParentLink(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
  }

  const id = getString(formData, "id");

  const link = await prisma.parentStudent.findUnique({ where: { id } });
  if (!link) {
    throw new Error("Link not found");
  }

  await prisma.parentStudent.update({
    where: { id },
    data: {
      isPrimary: true,
      approvalStatus: "APPROVED",
      archivedAt: null,
      reviewedAt: new Date(),
      reviewedById: session.user.id,
    },
  });

  revalidatePath("/parent");
  revalidatePath("/admin/students");
  revalidatePath("/admin/parent-approvals");
}

// ============================================
// UNLINK STUDENT
// ============================================

export async function unlinkStudent(formData: FormData) {
  const session = await requireParent();
  const parentId = session.user.id;

  const id = getString(formData, "id");

  // Verify the link exists and belongs to the current parent
  const link = await prisma.parentStudent.findUnique({
    where: { id },
  });

  if (!link) {
    throw new Error("Link not found");
  }

  if (link.parentId !== parentId) {
    throw new Error("Unauthorized - This link does not belong to you");
  }

  await prisma.parentStudent.delete({
    where: { id },
  });

  revalidatePath("/parent");
}

// ============================================
// UPDATE MANAGED STUDENT PROFILE
// ============================================

export async function updateManagedStudentProfile(
  _prevState: ManagedStudentFormState,
  formData: FormData
): Promise<ManagedStudentFormState> {
  try {
    const session = await requireParent();
    const parentId = session.user.id;
    const parentEmail = session.user.email?.toLowerCase() ?? "";

    const studentId = getString(formData, "studentId");
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

    const managedLink = await getApprovedManagedStudentLink(parentId, studentId);
    if (!managedLink) {
      throw new Error("You do not have permission to update this student.");
    }

    if (studentEmail === parentEmail) {
      throw new Error("Parent and student need different email addresses.");
    }

    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true },
    });

    if (!chapter) {
      throw new Error("Please choose a valid chapter.");
    }

    const existingByEmail = await prisma.user.findUnique({
      where: { email: studentEmail },
      select: { id: true },
    });

    if (existingByEmail && existingByEmail.id !== studentId) {
      throw new Error("That email address is already in use by another account.");
    }

    const studentPhone = studentUsesParentPhone
      ? managedLink.parent.phone
      : parseOptionalPhone(studentPhoneInput, "student phone");

    const supabaseAuthId = await ensureSupabaseAuthUser({
      email: studentEmail,
      name: studentName,
      existingSupabaseAuthId: managedLink.student.supabaseAuthId,
      primaryRole: managedLink.student.primaryRole,
      chapterId,
      prismaUserId: managedLink.student.id,
      roles: managedLink.student.roles.map((role) => role.role),
      portalArchived: false,
    });

    await prisma.user.update({
      where: { id: studentId },
      data: {
        name: studentName,
        email: studentEmail,
        phone: studentPhone,
        chapterId,
        supabaseAuthId,
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: studentId },
      update: {
        grade: studentGrade,
        school: studentSchool,
        parentEmail: managedLink.parent.email,
        parentPhone: managedLink.parent.phone,
        dateOfBirth: studentDateOfBirth,
        city,
        stateProvince,
        usesParentPhone: studentUsesParentPhone,
      },
      create: {
        userId: studentId,
        interests: [],
        grade: studentGrade,
        school: studentSchool,
        parentEmail: managedLink.parent.email,
        parentPhone: managedLink.parent.phone,
        dateOfBirth: studentDateOfBirth,
        city,
        stateProvince,
        usesParentPhone: studentUsesParentPhone,
      },
    });

    await updateSupabasePortalUser({
      supabaseAuthId,
      email: studentEmail,
      name: studentName,
      primaryRole: managedLink.student.primaryRole,
      chapterId,
      prismaUserId: managedLink.student.id,
      roles: managedLink.student.roles.map((role) => role.role),
      portalArchived: false,
    });

    revalidatePath("/parent");
    revalidatePath(`/parent/${studentId}`);
    revalidatePath("/parent/connect");

    return {
      status: "success",
      message: "Student info updated.",
    };
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Could not update the student info."),
    };
  }
}

// ============================================
// ARCHIVE MANAGED STUDENT ACCOUNT
// ============================================

export async function archiveManagedStudentAccount(
  _prevState: ManagedStudentFormState,
  formData: FormData
): Promise<ManagedStudentFormState> {
  try {
    const session = await requireParent();
    const parentId = session.user.id;
    const studentId = getString(formData, "studentId");
    const confirmEmail = getString(formData, "confirmStudentEmail").toLowerCase();

    const managedLink = await getApprovedManagedStudentLink(parentId, studentId);
    if (!managedLink) {
      throw new Error("You do not have permission to archive this student.");
    }

    if (confirmEmail !== managedLink.student.email.toLowerCase()) {
      throw new Error("Enter the student's email address exactly to confirm archiving.");
    }

    const archivedAt = new Date();

    await prisma.parentStudent.updateMany({
      where: {
        studentId,
        archivedAt: null,
      },
      data: {
        archivedAt,
      },
    });

    await prisma.user.update({
      where: { id: managedLink.student.id },
      data: {
        archivedAt,
      },
    });

    if (managedLink.student.supabaseAuthId) {
      await updateSupabasePortalUser({
        supabaseAuthId: managedLink.student.supabaseAuthId,
        email: managedLink.student.email,
        name: managedLink.student.name,
        primaryRole: managedLink.student.primaryRole,
        chapterId: managedLink.student.chapterId,
        prismaUserId: managedLink.student.id,
        roles: managedLink.student.roles.map((role) => role.role),
        portalArchived: true,
      });
    }

    const remainingActiveChildren = await prisma.parentStudent.count({
      where: {
        parentId,
        approvalStatus: "APPROVED",
        archivedAt: null,
        student: {
          archivedAt: null,
        },
      },
    });

    const shouldArchiveParent =
      remainingActiveChildren === 0 &&
      managedLink.parent.roles.every((role) => role.role === RoleType.PARENT);

    if (shouldArchiveParent) {
      await prisma.user.update({
        where: { id: managedLink.parent.id },
        data: {
          archivedAt,
        },
      });

      if (managedLink.parent.supabaseAuthId) {
        await updateSupabasePortalUser({
          supabaseAuthId: managedLink.parent.supabaseAuthId,
          email: managedLink.parent.email,
          name: managedLink.parent.name,
          primaryRole: managedLink.parent.primaryRole,
          chapterId: managedLink.parent.chapterId,
          prismaUserId: managedLink.parent.id,
          roles: managedLink.parent.roles.map((role) => role.role),
          portalArchived: true,
        });
      }
    }

    revalidatePath("/parent");
    revalidatePath(`/parent/${studentId}`);
    revalidatePath("/parent/connect");

    if (shouldArchiveParent) {
      redirect("/login?error=account_archived");
    }

    redirect("/parent");
  } catch (error) {
    return {
      status: "error",
      message: getErrorMessage(error, "Could not archive the student account."),
    };
  }
}

// ============================================
// ENROLL CHILD IN COURSE
// ============================================

export async function enrollChildInCourse(formData: FormData) {
  const session = await requireParent();
  const parentId = session.user.id;

  const studentId = getString(formData, "studentId");
  const courseId = getString(formData, "courseId");

  // Verify the parent has an approved link to this student
  const activeLink = await prisma.parentStudent.findFirst({
    where: {
      parentId,
      studentId,
      approvalStatus: "APPROVED",
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
  });

  if (!activeLink) {
    throw new Error("You do not have access to enroll this student");
  }

  // Check if already enrolled
  const existing = await prisma.enrollment.findFirst({
    where: { userId: studentId, courseId },
  });

  if (existing) {
    throw new Error("Student is already enrolled in this course");
  }

  await prisma.enrollment.create({
    data: {
      userId: studentId,
      courseId,
      status: "ENROLLED",
    },
  });

  revalidatePath("/parent");
  revalidatePath(`/parent/${studentId}`);
}

// ============================================
// GET AVAILABLE CLASS OFFERINGS FOR ENROLLMENT
// ============================================

export async function getAvailableClassOfferings(studentId: string) {
  const session = await requireParent();
  const parentId = session.user.id;

  // Verify approved link
  const link = await prisma.parentStudent.findFirst({
    where: {
      parentId,
      studentId,
      approvalStatus: "APPROVED",
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
  });
  if (!link) {
    throw new Error("Access denied");
  }

  // Get student's existing class enrollments
  const existingEnrollments = await prisma.classEnrollment.findMany({
    where: { studentId, status: { not: "DROPPED" } },
    select: { offeringId: true },
  });
  const enrolledOfferingIds = new Set(existingEnrollments.map((e) => e.offeringId));

  const offerings = await prisma.classOffering.findMany({
    where: {
      enrollmentOpen: true,
      startDate: { gt: new Date() },
      status: { in: ["PUBLISHED", "ENROLLING_OPEN"] as any[] },
    },
    select: {
      id: true,
      title: true,
      startDate: true,
      endDate: true,
      meetingDays: true,
      meetingTime: true,
      timezone: true,
      deliveryMode: true,
      locationName: true,
      capacity: true,
      semester: true,
      instructor: { select: { id: true, name: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { startDate: "asc" },
    take: 50,
  });

  return offerings
    .filter((o) => !enrolledOfferingIds.has(o.id))
    .map((o) => ({
      id: o.id,
      title: o.title,
      startDate: o.startDate,
      endDate: o.endDate,
      meetingDays: o.meetingDays,
      meetingTime: o.meetingTime,
      timezone: o.timezone,
      deliveryMode: String(o.deliveryMode),
      locationName: o.locationName ?? null,
      capacity: o.capacity,
      semester: o.semester ?? null,
      instructorName: o.instructor?.name ?? "TBD",
      seatsRemaining: Math.max(0, o.capacity - o._count.enrollments),
    }));
}

// ============================================
// ENROLL CHILD IN CLASS OFFERING
// ============================================

export async function enrollChildInClassOffering(formData: FormData) {
  const session = await requireParent();
  const parentId = session.user.id;

  const studentId = String(formData.get("studentId") ?? "").trim();
  const offeringId = String(formData.get("offeringId") ?? "").trim();

  if (!studentId || !offeringId) throw new Error("Missing required fields");

  // Verify approved link
  const link = await prisma.parentStudent.findFirst({
    where: {
      parentId,
      studentId,
      approvalStatus: "APPROVED",
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
  });
  if (!link) {
    throw new Error("You do not have access to enroll this student");
  }

  // Verify offering is open and has capacity
  const offering = await prisma.classOffering.findUnique({
    where: { id: offeringId },
    include: { _count: { select: { enrollments: true } } },
  });

  if (!offering) throw new Error("Class not found");
  if (!offering.enrollmentOpen) throw new Error("Enrollment is not open for this class");
  if (offering._count.enrollments >= offering.capacity) {
    throw new Error("This class is full");
  }

  // Check if already enrolled
  const existing = await prisma.classEnrollment.findFirst({
    where: { studentId, offeringId },
  });
  if (existing) throw new Error("Student is already enrolled in this class");

  await prisma.classEnrollment.create({
    data: {
      studentId,
      offeringId,
      status: "ENROLLED",
    },
  });

  revalidatePath("/parent");
  revalidatePath(`/parent/${studentId}`);
}

// ============================================
// PARENT FEEDBACK SUBMISSION
// ============================================

export async function submitParentFeedback(formData: FormData) {
  const session = await requireParent();
  const parentId = session.user.id;

  const courseId = getString(formData, "courseId");
  const rating = getString(formData, "rating", false);
  const comments = getString(formData, "comments");

  // Verify parent has a child enrolled in this course
  const parentLinks = await prisma.parentStudent.findMany({
    where: {
      parentId,
      approvalStatus: "APPROVED",
      archivedAt: null,
      student: {
        archivedAt: null,
      },
    },
    include: {
      student: {
        include: {
          enrollments: { where: { courseId } },
        },
      },
    },
  });

  const hasChildInCourse = parentLinks.some(
    (p) => p.student.enrollments.length > 0
  );

  if (!hasChildInCourse) {
    throw new Error(
      "You can only provide feedback for courses your child is enrolled in"
    );
  }

  await prisma.feedback.create({
    data: {
      source: "PARENT",
      rating: rating ? Number(rating) : null,
      comments,
      courseId,
      authorId: parentId,
    },
  });

  revalidatePath("/parent");
  revalidatePath(`/courses/${courseId}`);
}
