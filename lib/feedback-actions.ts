"use server";

import { getSession } from "@/lib/auth-supabase";
import {
  createMentorshipRequest,
  markMentorshipResponseHelpful,
  respondToMentorshipRequest,
} from "@/lib/mentorship-hub-actions";
import { getPrivateMentorshipRequests } from "@/lib/mentorship-hub";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function requireAuth() {
  const session = await getSession();
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
  const roles = (session.user as { roles?: string[] }).roles ?? [];
  const requests = await getPrivateMentorshipRequests({
    userId: session.user.id as string,
    roles,
  });

  return requests.map((request) => ({
    id: request.id,
    status: request.status === "OPEN" ? "PENDING" : request.status,
    passionId: request.passionId ?? "general",
    question: request.details,
    mediaUrls: request.resources
      .map((resource) => resource.url)
      .filter((url): url is string => Boolean(url)),
    createdAt: request.requestedAt,
    student: {
      id: request.mentee.id,
      name: request.mentee.name,
    },
    responses: request.responses.map((response) => ({
      id: response.id,
      feedback: response.body,
      respondedAt: response.createdAt,
      isHelpful: response.isHelpful,
      mentor: {
        id: response.responder.id,
        name: response.responder.name,
      },
      resources: response.resourceLinks,
    })),
  }));
}

export async function createFeedbackRequest(formData: FormData) {
  const requestFormData = new FormData();
  requestFormData.set("kind", "PROJECT_FEEDBACK");
  requestFormData.set("visibility", "PRIVATE");
  requestFormData.set("question", getString(formData, "question"));

  const passionId = getString(formData, "passionId", false);
  const mediaUrl = getString(formData, "mediaUrl", false);

  if (passionId) {
    requestFormData.set("passionId", passionId);
  }

  const createdRequest = await createMentorshipRequest(requestFormData);

  if (mediaUrl) {
    const session = await requireAuth();
    if (createdRequest) {
      await prisma.mentorshipResource.create({
        data: {
          requestId: createdRequest.id,
          menteeId: createdRequest.menteeId,
          createdById: session.user.id as string,
          type: "LINK",
          title: "Attached work sample",
          description: "Added when the feedback request was created.",
          url: mediaUrl,
          passionId: passionId || null,
          isPublished: false,
        },
      });
    }
  }

  revalidatePath("/mentor/feedback");
  revalidatePath("/mentorship");
}

export async function respondToFeedback(formData: FormData) {
  const requestFormData = new FormData();
  requestFormData.set("requestId", getString(formData, "requestId"));
  requestFormData.set("feedback", getString(formData, "feedback"));
  const resourceUrl = getString(formData, "resourceUrl", false);
  if (resourceUrl) {
    requestFormData.set("resourceUrl", resourceUrl);
  }
  await respondToMentorshipRequest(requestFormData);
}

export async function markResponseHelpful(responseId: string) {
  await markMentorshipResponseHelpful(responseId);
}
