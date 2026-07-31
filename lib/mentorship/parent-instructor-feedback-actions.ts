"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";
import { syncInstructorGrowthSignalsForInstructor } from "@/lib/instructor-growth-service";

const SubmitSchema = z.object({
  instructorId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comments: z.string().trim().min(1).max(4000),
  wouldRecommend: z.boolean(),
  isAnonymous: z.boolean().default(false),
  studentId: z.string().min(1).optional().nullable(),
});

/**
 * Parent submits instructor feedback from /parent/instructor-feedback/[id].
 * Lands in ParentChapterFeedback and auto-surfaces on mentorship Feedback.
 */
export async function submitInstructorParentFeedback(input: unknown) {
  const session = await requireSessionUser();
  if (!session.roles.includes("PARENT") && !session.roles.includes("ADMIN")) {
    throw new Error("Only parents can submit this feedback.");
  }

  const data = SubmitSchema.parse(input);

  const instructor = await prisma.user.findUnique({
    where: { id: data.instructorId },
    select: { id: true, name: true, chapterId: true },
  });
  if (!instructor) throw new Error("Instructor not found.");

  const parentLinks = await prisma.parentStudent.findMany({
    where: {
      parentId: session.id,
      approvalStatus: "APPROVED",
      archivedAt: null,
    },
    select: { studentId: true },
  });
  const myStudentIds = parentLinks.map((l) => l.studentId);
  if (myStudentIds.length === 0 && !session.roles.includes("ADMIN")) {
    throw new Error("No linked students found on your parent account.");
  }

  const [inClass, inCourse] = await Promise.all([
    prisma.classEnrollment.findFirst({
      where: {
        studentId: { in: myStudentIds },
        status: { in: ["ENROLLED", "COMPLETED"] },
        offering: {
          instructorId: data.instructorId,
          status: { in: ["PUBLISHED", "IN_PROGRESS", "COMPLETED"] },
        },
      },
      select: {
        studentId: true,
        offering: { select: { chapterId: true } },
      },
    }),
    prisma.enrollment.findFirst({
      where: {
        userId: { in: myStudentIds },
        status: { in: ["ENROLLED", "COMPLETED"] },
        course: { leadInstructorId: data.instructorId },
      },
      select: {
        userId: true,
        course: { select: { chapterId: true } },
      },
    }),
  ]);

  if (!inClass && !inCourse && !session.roles.includes("ADMIN")) {
    throw new Error(
      "You can only rate instructors who teach one of your linked students."
    );
  }

  const chapterId =
    inClass?.offering.chapterId ||
    inCourse?.course.chapterId ||
    instructor.chapterId;
  if (!chapterId) {
    throw new Error("Could not determine chapter for this feedback.");
  }

  const studentId =
    data.studentId && myStudentIds.includes(data.studentId)
      ? data.studentId
      : inClass?.studentId || inCourse?.userId || null;

  await prisma.parentChapterFeedback.create({
    data: {
      parentId: session.id,
      chapterId,
      type: "INSTRUCTOR_FEEDBACK",
      targetUserId: data.instructorId,
      studentId,
      rating: data.rating,
      comments: data.comments,
      wouldRecommend: data.wouldRecommend,
      isAnonymous: data.isAnonymous,
    },
  });

  await syncInstructorGrowthSignalsForInstructor(data.instructorId).catch(
    () => null
  );

  revalidatePath(`/parent/instructor-feedback/${data.instructorId}`);
  revalidatePath(`/mentorship/people/${data.instructorId}`);
  revalidatePath(`/instructor/parent-feedback`);
  revalidatePath(`/admin/parent-feedback`);
  return { ok: true as const };
}
