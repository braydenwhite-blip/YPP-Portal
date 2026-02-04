"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
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

// ============================================
// PARENT-STUDENT LINKING (Admin)
// ============================================

export async function linkParentToStudent(formData: FormData) {
  await requireAdmin();

  const parentId = getString(formData, "parentId");
  const studentId = getString(formData, "studentId");
  const relationship = getString(formData, "relationship", false) || "Parent";
  const isPrimary = formData.get("isPrimary") === "on";

  // Verify parent has PARENT role
  const parent = await prisma.user.findUnique({
    where: { id: parentId },
    include: { roles: true }
  });

  if (!parent?.roles.some(r => r.role === "PARENT")) {
    throw new Error("User must have PARENT role");
  }

  // Verify student has STUDENT role
  const student = await prisma.user.findUnique({
    where: { id: studentId },
    include: { roles: true }
  });

  if (!student?.roles.some(r => r.role === "STUDENT")) {
    throw new Error("User must have STUDENT role");
  }

  await prisma.parentStudent.upsert({
    where: {
      parentId_studentId: { parentId, studentId }
    },
    create: {
      parentId,
      studentId,
      relationship,
      isPrimary
    },
    update: {
      relationship,
      isPrimary
    }
  });

  revalidatePath("/admin/parents");
  revalidatePath("/parent");
}

export async function unlinkParentFromStudent(formData: FormData) {
  await requireAdmin();

  const parentId = getString(formData, "parentId");
  const studentId = getString(formData, "studentId");

  await prisma.parentStudent.delete({
    where: {
      parentId_studentId: { parentId, studentId }
    }
  });

  revalidatePath("/admin/parents");
  revalidatePath("/parent");
}

// ============================================
// PARENT PORTAL VIEWS
// ============================================

export async function getParentDashboardData() {
  const session = await requireParent();
  const parentId = session.user.id;

  const parentLinks = await prisma.parentStudent.findMany({
    where: { parentId },
    include: {
      student: {
        include: {
          enrollments: {
            include: {
              course: {
                include: { leadInstructor: { select: { name: true, email: true } } }
              }
            }
          },
          chapter: true,
          profile: true,
          goals: {
            include: {
              template: true,
              progress: {
                orderBy: { createdAt: "desc" },
                take: 1
              }
            }
          }
        }
      }
    }
  });

  // Get recent feedback from parents about their children's courses
  const studentIds = parentLinks.map(p => p.studentId);
  const enrolledCourseIds = parentLinks.flatMap(p =>
    p.student.enrollments.map(e => e.courseId)
  );

  const recentFeedback = await prisma.feedback.findMany({
    where: {
      authorId: parentId,
      courseId: { in: enrolledCourseIds }
    },
    include: { course: true },
    orderBy: { createdAt: "desc" },
    take: 5
  });

  // Get upcoming events for children's chapters
  const chapterIds = parentLinks
    .map(p => p.student.chapterId)
    .filter(Boolean) as string[];

  const upcomingEvents = await prisma.event.findMany({
    where: {
      startDate: { gte: new Date() },
      OR: [
        { chapterId: null },
        { chapterId: { in: chapterIds } }
      ],
      isAlumniOnly: false
    },
    orderBy: { startDate: "asc" },
    take: 5
  });

  return {
    children: parentLinks.map(p => ({
      ...p.student,
      relationship: p.relationship,
      isPrimary: p.isPrimary
    })),
    recentFeedback,
    upcomingEvents
  };
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
          enrollments: { where: { courseId } }
        }
      }
    }
  });

  const hasChildInCourse = parentLinks.some(
    p => p.student.enrollments.length > 0
  );

  if (!hasChildInCourse) {
    throw new Error("You can only provide feedback for courses your child is enrolled in");
  }

  await prisma.feedback.create({
    data: {
      source: "PARENT",
      rating: rating ? Number(rating) : null,
      comments,
      courseId,
      authorId: parentId
    }
  });

  revalidatePath("/parent");
  revalidatePath(`/courses/${courseId}`);
}

// ============================================
// ADMIN PARENT MANAGEMENT
// ============================================

export async function getAllParents() {
  await requireAdmin();

  return prisma.user.findMany({
    where: {
      roles: { some: { role: "PARENT" } }
    },
    include: {
      parentLinks: {
        include: {
          student: { select: { id: true, name: true, email: true } }
        }
      }
    },
    orderBy: { name: "asc" }
  });
}

export async function createParentAccount(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const email = getString(formData, "email");
  const phone = getString(formData, "phone", false);
  const password = getString(formData, "password");

  const bcrypt = require("bcryptjs");
  const passwordHash = await bcrypt.hash(password, 10);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("User with this email already exists");
  }

  await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null,
      passwordHash,
      primaryRole: "PARENT",
      roles: {
        create: [{ role: "PARENT" }]
      }
    }
  });

  revalidatePath("/admin/parents");
}
