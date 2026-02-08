"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================
// AUTH HELPERS
// ============================================

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireParent() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("PARENT")) {
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

// ============================================
// GET LINKED STUDENTS
// ============================================

export async function getLinkedStudents() {
  const session = await requireParent();
  const parentId = session.user.id;

  const links = await prisma.parentStudent.findMany({
    where: { parentId },
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

  // Verify the parent has an active link to this student
  const link = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: { parentId, studentId },
    },
  });

  if (!link || link.approvalStatus !== "APPROVED") {
    throw new Error("You do not have access to this student's progress");
  }

  // Fetch the student with all progress-related data
  const student = await prisma.user.findUnique({
    where: { id: studentId },
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
            take: 1,
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
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

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

  // Map goals with latest progress status
  const goals = student.goals.map((goal) => ({
    id: goal.id,
    title: goal.template.title,
    description: goal.template.description,
    latestStatus: goal.progress[0]?.status ?? null,
    latestComments: goal.progress[0]?.comments ?? null,
    lastUpdatedAt: goal.progress[0]?.createdAt ?? null,
  }));

  return {
    student: {
      id: student.id,
      name: student.name,
      email: student.email,
      primaryRole: student.primaryRole,
      chapter: student.chapter,
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
  const student = await prisma.user.findUnique({
    where: { email },
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
// ENROLL CHILD IN COURSE
// ============================================

export async function enrollChildInCourse(formData: FormData) {
  const session = await requireParent();
  const parentId = session.user.id;

  const studentId = getString(formData, "studentId");
  const courseId = getString(formData, "courseId");

  // Verify the parent has an approved link to this student
  const link = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: { parentId, studentId },
    },
  });

  if (!link || link.approvalStatus !== "APPROVED") {
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
    where: { parentId },
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
