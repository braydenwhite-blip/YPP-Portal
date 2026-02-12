"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  return session;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Get feedback requests for the current user (student sees own, mentor sees pending). */
export async function getMyFeedbackRequests() {
  const session = await requireUser();
  const userId = session.user.id as string;
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("ADMIN");

  if (isMentor) {
    // Mentors see all pending requests + their own responses
    return prisma.mentorFeedbackRequest.findMany({
      where: {
        OR: [{ status: "PENDING" }, { responses: { some: { mentorId: userId } } }],
      },
      include: {
        student: { select: { id: true, name: true } },
        responses: {
          include: { mentor: { select: { id: true, name: true } } },
          orderBy: { respondedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
  }

  // Students see their own requests
  return prisma.mentorFeedbackRequest.findMany({
    where: { studentId: userId },
    include: {
      student: { select: { id: true, name: true } },
      responses: {
        include: { mentor: { select: { id: true, name: true } } },
        orderBy: { respondedAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Student creates a feedback request. */
export async function createFeedbackRequest(formData: FormData) {
  const session = await requireUser();
  const userId = session.user.id as string;

  const passionId = formData.get("passionId") as string;
  const question = formData.get("question") as string;
  const mediaUrl = formData.get("mediaUrl") as string | null;

  if (!passionId || !question) {
    throw new Error("Passion area and question are required");
  }

  await prisma.mentorFeedbackRequest.create({
    data: {
      studentId: userId,
      passionId,
      question,
      mediaUrls: mediaUrl ? [mediaUrl] : [],
      status: "PENDING",
    },
  });

  revalidatePath("/mentor/feedback");
}

/** Mentor responds to a feedback request. */
export async function respondToFeedback(formData: FormData) {
  const session = await requireUser();
  const userId = session.user.id as string;

  const requestId = formData.get("requestId") as string;
  const feedback = formData.get("feedback") as string;
  const resourceUrl = formData.get("resourceUrl") as string | null;

  if (!requestId || !feedback) {
    throw new Error("Request ID and feedback are required");
  }

  // Create the response
  await prisma.mentorResponse.create({
    data: {
      requestId,
      mentorId: userId,
      feedback,
      resources: resourceUrl ? [resourceUrl] : [],
    },
  });

  // Mark request as answered
  await prisma.mentorFeedbackRequest.update({
    where: { id: requestId },
    data: { status: "ANSWERED" },
  });

  revalidatePath("/mentor/feedback");
}

/** Student marks a response as helpful. */
export async function markResponseHelpful(responseId: string) {
  const session = await requireUser();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await prisma.mentorResponse.update({
    where: { id: responseId },
    data: { isHelpful: true },
  });

  revalidatePath("/mentor/feedback");
}
