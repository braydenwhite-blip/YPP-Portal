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
  return session as typeof session & { user: { id: string; roles: string[] } };
}

async function requireAdminOrInstructor() {
  const session = await requireAuth();
  const roles: string[] = (session.user as any).roles ?? [];
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

// ─── Student submits work for feedback ───

export async function createFeedbackCycle(formData: FormData) {
  const session = await requireAuth();
  const projectId = getString(formData, "projectId");
  const studentReflection = getString(formData, "studentReflection");
  const workSamplesRaw = getString(formData, "workSamples", false);
  const workSamples = workSamplesRaw
    ? workSamplesRaw.split("\n").map((u) => u.trim()).filter(Boolean)
    : [];

  // Get next cycle number for this project
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

// ─── Instructor/Mentor gives feedback ───

export async function giveFeedback(formData: FormData) {
  const session = await requireAuth();
  const roles: string[] = (session.user as any).roles ?? [];

  // Determine reviewer type from roles
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

  // Verify cycle exists
  const cycle = await prisma.projectFeedbackCycle.findUnique({
    where: { id: cycleId },
  });
  if (!cycle) {
    throw new Error("Feedback cycle not found");
  }

  await prisma.projectFeedback.create({
    data: {
      cycleId,
      reviewerId: session.user.id,
      reviewerType,
      strengths,
      improvements,
      suggestions: suggestions || null,
      encouragement,
    },
  });

  // Update cycle status to IN_PROGRESS if it was awaiting feedback
  if (cycle.status === "AWAITING_FEEDBACK") {
    await prisma.projectFeedbackCycle.update({
      where: { id: cycleId },
      data: { status: "IN_PROGRESS" },
    });
  }

  revalidatePath("/projects/feedback");
  revalidatePath("/admin/feedback");
}

// ─── Admin/Instructor updates cycle status ───

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
