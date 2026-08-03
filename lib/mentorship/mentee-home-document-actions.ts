"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSessionUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

const ItemSchema = z.object({
  /** Composite table id: review-… | gr-… | reflection-… */
  id: z.string().min(1),
});

const DeleteSchema = z.object({
  menteeId: z.string().min(1),
  items: z.array(ItemSchema).min(1).max(40),
});

async function assertCanManageMenteeDocs(menteeId: string, viewerId: string, roles: string[]) {
  const isAdmin = roles.includes("ADMIN");
  if (isAdmin) return;
  const mentorship = await prisma.mentorship.findFirst({
    where: { menteeId, mentorId: viewerId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!mentorship) {
    throw new Error("Only the assigned mentor or an admin can delete documents.");
  }
}

async function deletePerformanceReview(reviewId: string) {
  const review = await prisma.mentorGoalReview.findUnique({
    where: { id: reviewId },
    select: { id: true, selfReflectionId: true, menteeId: true },
  });
  if (!review) return;

  await prisma.$transaction(async (tx) => {
    await tx.goalReviewRating.deleteMany({ where: { reviewId } });
    await tx.menteeReviewAck.deleteMany({ where: { reviewId } });
    await tx.achievementPointLog.deleteMany({ where: { reviewId } });
    await tx.gRDocumentGoal.updateMany({
      where: { sourceReviewId: reviewId },
      data: { sourceReviewId: null },
    });
    await tx.mentorGoalReview.delete({ where: { id: reviewId } });
    // Stub / linked reflection is 1:1 with the review — remove it too.
    await tx.monthlySelfReflection.delete({
      where: { id: review.selfReflectionId },
    }).catch(() => {
      // Already gone or shared unexpectedly — ignore.
    });
  });
}

async function deleteOpenReflection(reflectionId: string) {
  const row = await prisma.monthlySelfReflection.findUnique({
    where: { id: reflectionId },
    select: { id: true, goalReview: { select: { id: true } } },
  });
  if (!row) return;
  if (row.goalReview) {
    await deletePerformanceReview(row.goalReview.id);
    return;
  }
  await prisma.monthlySelfReflection.delete({ where: { id: reflectionId } });
}

async function deleteGrDocument(documentId: string) {
  const doc = await prisma.gRDocument.findUnique({
    where: { id: documentId },
    select: { id: true },
  });
  if (!doc) return;

  await prisma.$transaction(async (tx) => {
    const goals = await tx.gRDocumentGoal.findMany({
      where: { documentId },
      select: { id: true },
    });
    const goalIds = goals.map((g) => g.id);
    if (goalIds.length > 0) {
      // Ratings don't cascade off the goal — clear the link first.
      await tx.goalReviewRating.updateMany({
        where: { grDocumentGoalId: { in: goalIds } },
        data: { grDocumentGoalId: null },
      });
    }
    await tx.gRDocument.delete({ where: { id: documentId } });
  });
}

/**
 * Delete selected Reviews & Documents rows (performance reviews, open
 * reflections, and/or G&R docs). Mentor of the mentee, or admin only.
 */
export async function deleteMenteeHomeDocuments(input: unknown) {
  const viewer = await requireSessionUser();
  const data = DeleteSchema.parse(input);
  await assertCanManageMenteeDocs(data.menteeId, viewer.id, viewer.roles ?? []);

  let deleted = 0;
  const errors: string[] = [];

  for (const item of data.items) {
    try {
      if (item.id.startsWith("review-")) {
        const reviewId = item.id.slice("review-".length);
        const review = await prisma.mentorGoalReview.findUnique({
          where: { id: reviewId },
          select: { menteeId: true },
        });
        if (!review || review.menteeId !== data.menteeId) {
          throw new Error("Review not found for this person.");
        }
        await deletePerformanceReview(reviewId);
        deleted += 1;
      } else if (item.id.startsWith("reflection-")) {
        const reflectionId = item.id.slice("reflection-".length);
        const reflection = await prisma.monthlySelfReflection.findUnique({
          where: { id: reflectionId },
          select: { menteeId: true },
        });
        if (!reflection || reflection.menteeId !== data.menteeId) {
          throw new Error("Reflection not found for this person.");
        }
        await deleteOpenReflection(reflectionId);
        deleted += 1;
      } else if (item.id.startsWith("gr-")) {
        const documentId = item.id.slice("gr-".length);
        const doc = await prisma.gRDocument.findUnique({
          where: { id: documentId },
          select: { userId: true },
        });
        if (!doc || doc.userId !== data.menteeId) {
          throw new Error("G&R document not found for this person.");
        }
        await deleteGrDocument(documentId);
        deleted += 1;
      } else {
        throw new Error("Unknown document type.");
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "Could not delete a document.");
    }
  }

  revalidatePath(`/mentorship/people/${data.menteeId}`);
  revalidatePath(`/people/${data.menteeId}`);

  if (deleted === 0 && errors.length > 0) {
    throw new Error(errors[0] ?? "Could not delete documents.");
  }

  return {
    ok: true as const,
    deleted,
    failed: errors.length,
    errors,
  };
}
