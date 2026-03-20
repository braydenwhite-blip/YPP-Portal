"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSessionUser } from "@/lib/authorization";

export async function requestPathwayFallback(input: {
  pathwayId: string;
  pathwayStepId: string;
  targetOfferingId: string;
  note?: string;
}) {
  const sessionUser = await requireSessionUser();

  const [student, offering, step] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        chapterId: true,
      },
    }),
    prisma.classOffering.findUnique({
      where: { id: input.targetOfferingId },
      select: {
        id: true,
        chapterId: true,
        pathwayStepId: true,
        templateId: true,
        status: true,
      },
    }),
    prisma.pathwayStep.findUnique({
      where: { id: input.pathwayStepId },
      select: {
        id: true,
        pathwayId: true,
        classTemplateId: true,
      },
    }),
  ]);

  if (!student) {
    throw new Error("Student not found.");
  }
  if (!offering || (offering.status !== "PUBLISHED" && offering.status !== "IN_PROGRESS")) {
    throw new Error("That partner-chapter offering is not open right now.");
  }
  if (!step || step.pathwayId !== input.pathwayId) {
    throw new Error("The selected pathway step does not match the requested pathway.");
  }
  if (!offering.chapterId || offering.chapterId === student.chapterId) {
    throw new Error("Fallback requests are only for partner-chapter offerings.");
  }
  if (offering.pathwayStepId && offering.pathwayStepId !== step.id) {
    throw new Error("That offering does not serve the selected pathway step.");
  }
  if (!offering.pathwayStepId && step.classTemplateId && offering.templateId !== step.classTemplateId) {
    throw new Error("That offering does not match the selected pathway step.");
  }

  const existing = await prisma.pathwayFallbackRequest.findFirst({
    where: {
      studentId: sessionUser.id,
      pathwayId: input.pathwayId,
      pathwayStepId: input.pathwayStepId,
      targetOfferingId: input.targetOfferingId,
      status: { in: ["PENDING", "APPROVED"] },
    },
    select: { id: true },
  });

  if (existing) {
    return { success: true, alreadyExists: true };
  }

  await prisma.pathwayFallbackRequest.create({
    data: {
      studentId: sessionUser.id,
      pathwayId: input.pathwayId,
      pathwayStepId: input.pathwayStepId,
      fromChapterId: student.chapterId ?? null,
      toChapterId: offering.chapterId,
      targetOfferingId: input.targetOfferingId,
      note: input.note?.trim() || null,
    },
  });

  revalidatePath("/my-chapter");
  revalidatePath("/chapter/pathway-fallbacks");
  return { success: true };
}

export async function reviewPathwayFallbackRequest(input: {
  requestId: string;
  status: "APPROVED" | "REJECTED";
}) {
  const sessionUser = await requireSessionUser();
  const roles = new Set(sessionUser.roles);
  if (!roles.has("ADMIN") && !roles.has("STAFF") && !roles.has("CHAPTER_LEAD")) {
    throw new Error("Unauthorized");
  }

  const [reviewer, request] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        chapterId: true,
      },
    }),
    prisma.pathwayFallbackRequest.findUnique({
      where: { id: input.requestId },
      include: {
        student: {
          select: {
            name: true,
          },
        },
        pathway: {
          select: {
            name: true,
          },
        },
        pathwayStep: {
          select: {
            stepOrder: true,
            title: true,
            classTemplate: {
              select: {
                title: true,
              },
            },
          },
        },
        targetOffering: {
          select: {
            title: true,
          },
        },
      },
    }),
  ]);

  if (!request) {
    throw new Error("Fallback request not found.");
  }

  if (
    roles.has("CHAPTER_LEAD") &&
    !roles.has("ADMIN") &&
    !roles.has("STAFF") &&
    reviewer?.chapterId !== request.fromChapterId &&
    reviewer?.chapterId !== request.toChapterId
  ) {
    throw new Error("You can only review fallback requests tied to your chapter.");
  }

  await prisma.pathwayFallbackRequest.update({
    where: { id: input.requestId },
    data: {
      status: input.status,
      reviewedAt: new Date(),
      reviewedById: sessionUser.id,
    },
  });

  revalidatePath("/my-chapter");
  revalidatePath("/chapter/pathway-fallbacks");
  return {
    success: true,
    message:
      input.status === "APPROVED"
        ? `${request.student.name} can now enroll in ${request.targetOffering?.title ?? request.pathway.name}.`
        : `${request.student.name}'s fallback request was declined.`,
  };
}
