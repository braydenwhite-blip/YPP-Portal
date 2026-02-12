"use server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdminOrInstructor() {
  const session = await requireAuth();
  const roles: string[] = (session.user as { roles?: string[] }).roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("INSTRUCTOR")) {
    throw new Error("Unauthorized");
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

// ---------------------------------------------------------------------------
// Project feedback cycles (existing main functionality)
// ---------------------------------------------------------------------------

export async function createFeedbackCycle(formData: FormData) {
  await requireAuth();
  const projectId = getString(formData, "projectId");
  const studentReflection = getString(formData, "studentReflection");
  const workSamplesRaw = getString(formData, "workSamples", false);
  const workSamples = workSamplesRaw
    ? workSamplesRaw.split("\n").map((u) => u.trim()).filter(Boolean)
    : [];

  const lastCycle = await prisma.projectFeedbackCycle.findFirst({
    where: { projectId },
    orderBy: { cycleNumber: "desc" },
    select: { cycleNumber: true },
  });

  await prisma.projectFeedbackCycle.create({
    data: {
      projectId,
      cycleNumber: (lastCycle?.cycleNumber ?? 0) + 1,
      studentReflection,
      workSamples,
      status: "AWAITING_FEEDBACK",
    },
  });

  revalidatePath("/projects/feedback");
  revalidatePath("/admin/feedback");
}

export async function giveFeedback(formData: FormData) {
  const session = await requireAuth();
  const roles: string[] = (session.user as { roles?: string[] }).roles ?? [];

  let reviewerType = "PEER";
  if (roles.includes("ADMIN") || roles.includes("INSTRUCTOR")) {
    reviewerType = "INSTRUCTOR";
  } else if (roles.includes("MENTOR")) {
    reviewerType = "MENTOR";
  }

  const cycleId = getString(formData, "cycleId");
  const strengths = getString(formData, "strengths");
  const improvements = getString(formData, "improvements");
  const suggestions = getString(formData, "suggestions", false);
  const encouragement = getString(formData, "encouragement");

  const cycle = await prisma.projectFeedbackCycle.findUnique({
    where: { id: cycleId },
  });
  if (!cycle) {
    throw new Error("Feedback cycle not found");
  }

  await prisma.projectFeedback.create({
    data: {
      cycleId,
      reviewerId: session.user.id as string,
      reviewerType,
      strengths,
      improvements,
      suggestions: suggestions || null,
      encouragement,
    },
  });

  if (cycle.status === "AWAITING_FEEDBACK") {
    await prisma.projectFeedbackCycle.update({
      where: { id: cycleId },
      data: { status: "IN_PROGRESS" },
    });
  }

  revalidatePath("/projects/feedback");
  revalidatePath("/admin/feedback");
}

export async function updateCycleStatus(formData: FormData) {
  await requireAdminOrInstructor();
  const id = getString(formData, "id");
  const status = getString(formData, "status");

  if (!["AWAITING_FEEDBACK", "IN_PROGRESS", "COMPLETED"].includes(status)) {
    throw new Error("Invalid status");
  }

  await prisma.projectFeedbackCycle.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/projects/feedback");
  revalidatePath("/admin/feedback");
}

// ---------------------------------------------------------------------------
// Mentor feedback requests (this PR functionality)
// ---------------------------------------------------------------------------

export async function getMyFeedbackRequests() {
  const session = await requireAuth();
  const userId = session.user.id as string;
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const isMentor =
    roles.includes("MENTOR") ||
    roles.includes("INSTRUCTOR") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("ADMIN");

  if (isMentor) {
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

export async function createFeedbackRequest(formData: FormData) {
  const session = await requireAuth();
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

export async function respondToFeedback(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id as string;

  const requestId = formData.get("requestId") as string;
  const feedback = formData.get("feedback") as string;
  const resourceUrl = formData.get("resourceUrl") as string | null;

  if (!requestId || !feedback) {
    throw new Error("Request ID and feedback are required");
  }

  await prisma.mentorResponse.create({
    data: {
      requestId,
      mentorId: userId,
      feedback,
      resources: resourceUrl ? [resourceUrl] : [],
    },
  });

  await prisma.mentorFeedbackRequest.update({
    where: { id: requestId },
    data: { status: "ANSWERED" },
  });

  revalidatePath("/mentor/feedback");
}

export async function markResponseHelpful(responseId: string) {
  await requireAuth();

  await prisma.mentorResponse.update({
    where: { id: responseId },
    data: { isHelpful: true },
  });

  revalidatePath("/mentor/feedback");
}
