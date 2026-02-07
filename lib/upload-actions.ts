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

export async function getUserUploads(category?: string) {
  const session = await requireAuth();

  const where: Record<string, unknown> = { userId: session.user.id };
  if (category) where.category = category;

  return prisma.fileUpload.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function deleteUpload(formData: FormData) {
  const session = await requireAuth();
  const uploadId = formData.get("uploadId") as string;

  if (!uploadId) {
    throw new Error("Missing upload ID");
  }

  // Verify ownership
  const upload = await prisma.fileUpload.findUnique({
    where: { id: uploadId },
  });

  if (!upload || upload.userId !== session.user.id) {
    throw new Error("Unauthorized");
  }

  await prisma.fileUpload.delete({
    where: { id: uploadId },
  });

  revalidatePath("/profile");
}

export async function submitTrainingEvidence(formData: FormData) {
  const session = await requireAuth();
  const moduleId = formData.get("moduleId") as string;
  const fileUrl = formData.get("uploadedFileUrl") as string;
  const notes = formData.get("notes") as string;

  if (!moduleId) {
    throw new Error("Missing module ID");
  }

  // Update training assignment status if evidence is uploaded
  if (fileUrl) {
    const existing = await prisma.trainingAssignment.findFirst({
      where: {
        userId: session.user.id,
        moduleId,
      },
    });

    if (existing) {
      await prisma.trainingAssignment.update({
        where: { id: existing.id },
        data: {
          status: "IN_PROGRESS",
        },
      });
    }
  }

  // Create a feedback entry to track the submission
  if (notes) {
    await prisma.feedback.create({
      data: {
        source: "PEER",
        comments: `Training evidence submitted for module ${moduleId}: ${notes}`,
        instructorId: session.user.id,
        authorId: session.user.id,
      },
    });
  }

  revalidatePath("/instructor-training");
}

export async function submitAssignment(formData: FormData) {
  const session = await requireAuth();
  const courseId = formData.get("courseId") as string;
  const fileUrl = formData.get("uploadedFileUrl") as string;
  const notes = formData.get("notes") as string;

  if (!courseId || !fileUrl) {
    throw new Error("Missing required fields");
  }

  // Create a feedback entry to track the submission
  await prisma.feedback.create({
    data: {
      source: "STUDENT",
      comments: `Assignment submitted: ${notes || "No notes"}. File: ${fileUrl}`,
      courseId,
      authorId: session.user.id,
    },
  });

  revalidatePath("/my-courses");
  revalidatePath(`/my-courses/${courseId}`);
}
