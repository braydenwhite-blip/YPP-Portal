"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// ============================================
// MY COURSES
// ============================================

export async function getMyCourses() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Get all enrollments for the current user
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: session.user.id },
    include: {
      course: {
        include: {
          chapter: true,
          leadInstructor: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { enrollments: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Separate into current and past (based on status or a simple heuristic)
  const current = enrollments.filter((e) => e.status === "ENROLLED");
  const completed = enrollments.filter((e) => e.status === "COMPLETED");
  const dropped = enrollments.filter((e) => e.status === "DROPPED");

  return { current, completed, dropped, all: enrollments };
}

export async function getCourseDetail(courseId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Get enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId,
    },
  });

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      chapter: true,
      leadInstructor: {
        select: { id: true, name: true, email: true, phone: true },
      },
      enrollments: {
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      },
      feedback: {
        where: { authorId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      pathwaySteps: {
        include: {
          pathway: true,
        },
      },
    },
  });

  return { course, enrollment, hasGivenFeedback: (course?.feedback?.length || 0) > 0 };
}

export async function submitCourseFeedback(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const courseId = formData.get("courseId") as string;
  const rating = parseInt(formData.get("rating") as string);
  const comments = formData.get("comments") as string;

  // Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId,
    },
  });

  if (!enrollment) {
    throw new Error("You must be enrolled in this course to submit feedback");
  }

  // Get course to find instructor
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });

  const feedback = await prisma.feedback.create({
    data: {
      source: "STUDENT",
      rating,
      comments,
      courseId,
      instructorId: course?.leadInstructorId,
      chapterId: course?.chapterId,
      authorId: session.user.id,
    },
  });

  revalidatePath(`/my-courses/${courseId}`);
  revalidatePath(`/my-courses/${courseId}/feedback`);
  return feedback;
}

export async function dropCourse(courseId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const enrollment = await prisma.enrollment.updateMany({
    where: {
      userId: session.user.id,
      courseId,
      status: "ENROLLED",
    },
    data: {
      status: "DROPPED",
    },
  });

  revalidatePath("/my-courses");
  return enrollment;
}

// ============================================
// MY MENTOR (Student View)
// ============================================

export async function getMyStudentMentor() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const mentorship = await prisma.mentorship.findFirst({
    where: {
      menteeId: session.user.id,
      type: "STUDENT",
      status: "ACTIVE",
    },
    include: {
      mentor: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: {
            select: { bio: true, avatarUrl: true },
          },
        },
      },
      checkIns: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  return mentorship;
}

// ============================================
// COURSE CATALOG
// ============================================

export async function getCourseCatalog(filters?: {
  chapterId?: string;
  format?: string;
  interestArea?: string;
}) {
  const where: any = {};

  if (filters?.chapterId) {
    where.chapterId = filters.chapterId;
  }

  if (filters?.format) {
    where.format = filters.format;
  }

  if (filters?.interestArea) {
    where.interestArea = filters.interestArea;
  }

  const courses = await prisma.course.findMany({
    where,
    include: {
      chapter: true,
      leadInstructor: {
        select: { id: true, name: true },
      },
      _count: {
        select: { enrollments: true },
      },
    },
    orderBy: { title: "asc" },
  });

  return courses;
}

export async function enrollInCourse(courseId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Check if already enrolled
  const existing = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId,
    },
  });

  if (existing) {
    throw new Error("You are already enrolled in this course");
  }

  const enrollment = await prisma.enrollment.create({
    data: {
      userId: session.user.id,
      courseId,
      status: "ENROLLED",
    },
  });

  revalidatePath("/my-courses");
  revalidatePath("/curriculum");
  return enrollment;
}

// ============================================
// CONTACT INSTRUCTOR
// ============================================

export async function getInstructorContact(courseId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId,
    },
  });

  if (!enrollment) {
    throw new Error("You must be enrolled to view instructor contact");
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    include: {
      leadInstructor: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profile: {
            select: { bio: true },
          },
        },
      },
    },
  });

  return course?.leadInstructor;
}
