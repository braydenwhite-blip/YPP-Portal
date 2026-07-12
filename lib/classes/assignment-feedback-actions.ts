"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";
import { canTeachOffering } from "@/lib/classes/instructor-access";

const InstructorAssignmentFeedbackSchema = z.object({
  offeringId: z.string().trim().min(1),
  assignmentId: z.string().trim().min(1),
  submissionId: z.string().trim().min(1),
  feedback: z.string().trim().min(3).max(8000),
});

/**
 * Focused, assignment-scoped feedback mutation for Instructor Students. It
 * closes the authorization gap in the older generic action by proving both the
 * instructor→offering and submission→assignment→offering relationships.
 */
export async function submitInstructorAssignmentFeedback(input: unknown) {
  const parsed = InstructorAssignmentFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Add useful feedback" };
  }
  const data = parsed.data;

  let viewer;
  try {
    viewer = await requireSessionUser();
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }
  if (!(await canTeachOffering(viewer.id, data.offeringId))) {
    return { ok: false as const, error: "You do not teach this class" };
  }

  const submission = await prisma.classAssignmentSubmission.findFirst({
    where: {
      id: data.submissionId,
      assignmentId: data.assignmentId,
      submittedAt: { not: null },
      assignment: { offeringId: data.offeringId, isPublished: true },
    },
    select: { id: true },
  });
  if (!submission) {
    return { ok: false as const, error: "That submitted work is not connected to this class" };
  }

  try {
    await prisma.classAssignmentSubmission.update({
      where: { id: submission.id },
      data: {
        instructorFeedback: data.feedback,
        feedbackGivenAt: new Date(),
        status: "FEEDBACK_GIVEN",
      },
    });
  } catch {
    return { ok: false as const, error: "Could not save student feedback" };
  }

  revalidatePath("/");
  revalidatePath("/instructor/students");
  revalidatePath("/instructor/classes");
  revalidatePath(`/instructor/classes/${data.offeringId}`);
  return { ok: true as const };
}

