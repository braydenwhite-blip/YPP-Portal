import { prisma } from "@/lib/prisma";

const PARENT_FEEDBACK_INCLUDE = {
  parent: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  chapter: {
    select: {
      id: true,
      name: true,
    },
  },
  targetUser: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  student: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  course: {
    select: {
      id: true,
      title: true,
    },
  },
} as const;

export type ParentFeedbackRecord = Awaited<ReturnType<typeof listAllParentFeedback>>[number];

export function summarizeParentFeedback(feedback: ParentFeedbackRecord[]) {
  const total = feedback.length;
  const averageRating =
    total > 0 ? Number((feedback.reduce((sum, item) => sum + item.rating, 0) / total).toFixed(1)) : 0;

  const recommendable = feedback.filter((item) => item.wouldRecommend !== null);
  const recommendRate =
    recommendable.length > 0
      ? Math.round(
          (recommendable.filter((item) => item.wouldRecommend === true).length / recommendable.length) * 100
        )
      : null;

  return {
    total,
    averageRating,
    recommendRate,
  };
}

export async function listAllParentFeedback() {
  return prisma.parentChapterFeedback.findMany({
    include: PARENT_FEEDBACK_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 250,
  });
}

export async function listChapterParentFeedback(chapterId: string) {
  return prisma.parentChapterFeedback.findMany({
    where: { chapterId },
    include: PARENT_FEEDBACK_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 250,
  });
}

export async function listInstructorScopedParentFeedback(userId: string) {
  const [courseIds, courseEnrollments, classOfferingEnrollments] = await Promise.all([
    prisma.course.findMany({
      where: { leadInstructorId: userId },
      select: { id: true },
    }),
    prisma.enrollment.findMany({
      where: {
        course: {
          leadInstructorId: userId,
        },
        status: { in: ["ENROLLED", "COMPLETED"] },
      },
      select: { userId: true },
    }),
    prisma.classEnrollment.findMany({
      where: {
        offering: {
          instructorId: userId,
          status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] },
        },
        status: { in: ["ENROLLED", "COMPLETED"] },
      },
      select: { studentId: true },
    }),
  ]);

  const legacyCourseIds = courseIds.map((course) => course.id);
  const studentIds = Array.from(
    new Set([
      ...courseEnrollments.map((enrollment) => enrollment.userId),
      ...classOfferingEnrollments.map((enrollment) => enrollment.studentId),
    ])
  );

  const filters = [
    { targetUserId: userId },
    legacyCourseIds.length > 0 ? { courseId: { in: legacyCourseIds } } : null,
    studentIds.length > 0 ? { studentId: { in: studentIds } } : null,
  ].filter(Boolean);

  if (filters.length === 0) {
    return [];
  }

  return prisma.parentChapterFeedback.findMany({
    where: {
      OR: filters as NonNullable<(typeof filters)[number]>[],
    },
    include: PARENT_FEEDBACK_INCLUDE,
    orderBy: { createdAt: "desc" },
    take: 250,
  });
}
