"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { TrainingModuleType, TrainingStatus, VideoProvider } from "@prisma/client";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireAdmin() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN")) {
    throw new Error("Unauthorized - Admin access required");
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

// ============================================
// TRAINING MODULE MANAGEMENT (Admin)
// ============================================

export async function createTrainingModuleWithVideo(formData: FormData) {
  await requireAdmin();

  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const materialUrl = getString(formData, "materialUrl", false);
  const materialNotes = getString(formData, "materialNotes", false);
  const type = getString(formData, "type") as TrainingModuleType;
  const required = formData.get("required") === "on";
  const sortOrder = Number(getString(formData, "sortOrder"));

  // Video fields
  const videoUrl = getString(formData, "videoUrl", false);
  const videoProvider = getString(formData, "videoProvider", false) as VideoProvider | undefined;
  const videoDuration = getString(formData, "videoDuration", false);
  const videoThumbnail = getString(formData, "videoThumbnail", false);

  await prisma.trainingModule.create({
    data: {
      title,
      description,
      materialUrl: materialUrl || null,
      materialNotes: materialNotes || null,
      type,
      required,
      sortOrder,
      videoUrl: videoUrl || null,
      videoProvider: videoProvider || null,
      videoDuration: videoDuration ? Number(videoDuration) : null,
      videoThumbnail: videoThumbnail || null
    }
  });

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
}

export async function updateTrainingModule(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
  const title = getString(formData, "title");
  const description = getString(formData, "description");
  const materialUrl = getString(formData, "materialUrl", false);
  const materialNotes = getString(formData, "materialNotes", false);
  const type = getString(formData, "type") as TrainingModuleType;
  const required = formData.get("required") === "on";
  const sortOrder = Number(getString(formData, "sortOrder"));

  // Video fields
  const videoUrl = getString(formData, "videoUrl", false);
  const videoProvider = getString(formData, "videoProvider", false) as VideoProvider | undefined;
  const videoDuration = getString(formData, "videoDuration", false);
  const videoThumbnail = getString(formData, "videoThumbnail", false);

  await prisma.trainingModule.update({
    where: { id: moduleId },
    data: {
      title,
      description,
      materialUrl: materialUrl || null,
      materialNotes: materialNotes || null,
      type,
      required,
      sortOrder,
      videoUrl: videoUrl || null,
      videoProvider: videoProvider || null,
      videoDuration: videoDuration ? Number(videoDuration) : null,
      videoThumbnail: videoThumbnail || null
    }
  });

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
}

// ============================================
// VIDEO PROGRESS TRACKING
// ============================================

export async function updateVideoProgress(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;

  const moduleId = getString(formData, "moduleId");
  const watchedSeconds = Number(getString(formData, "watchedSeconds"));
  const lastPosition = Number(getString(formData, "lastPosition"));
  const completed = formData.get("completed") === "true";

  await prisma.videoProgress.upsert({
    where: {
      userId_moduleId: { userId, moduleId }
    },
    create: {
      userId,
      moduleId,
      watchedSeconds,
      lastPosition,
      completed,
      completedAt: completed ? new Date() : null
    },
    update: {
      watchedSeconds,
      lastPosition,
      completed,
      completedAt: completed ? new Date() : undefined
    }
  });

  // If video is completed, check if training assignment should be updated
  if (completed) {
    const assignment = await prisma.trainingAssignment.findFirst({
      where: { userId, moduleId }
    });

    if (assignment && assignment.status !== "COMPLETE") {
      // Check if all videos in module are watched
      const module = await prisma.trainingModule.findUnique({
        where: { id: moduleId }
      });

      if (module?.videoUrl) {
        // For modules with video, completing video marks assignment as in progress or complete
        await prisma.trainingAssignment.update({
          where: { id: assignment.id },
          data: {
            status: "IN_PROGRESS"
          }
        });
      }
    }
  }

  revalidatePath("/instructor-training");
}

export async function getVideoProgress(moduleId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.videoProgress.findUnique({
    where: {
      userId_moduleId: {
        userId: session.user.id,
        moduleId
      }
    }
  });
}

// ============================================
// TRAINING ASSIGNMENT MANAGEMENT
// ============================================

export async function assignTrainingToUser(formData: FormData) {
  await requireAdmin();

  const userId = getString(formData, "userId");
  const moduleId = getString(formData, "moduleId");

  // Check if already assigned
  const existing = await prisma.trainingAssignment.findFirst({
    where: { userId, moduleId }
  });

  if (existing) {
    throw new Error("User already has this training module assigned");
  }

  await prisma.trainingAssignment.create({
    data: {
      userId,
      moduleId,
      status: "NOT_STARTED"
    }
  });

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
}

export async function assignAllTrainingToUser(formData: FormData) {
  await requireAdmin();

  const userId = getString(formData, "userId");

  // Get all required modules
  const modules = await prisma.trainingModule.findMany({
    where: { required: true },
    select: { id: true }
  });

  // Get existing assignments
  const existingAssignments = await prisma.trainingAssignment.findMany({
    where: { userId },
    select: { moduleId: true }
  });
  const existingModuleIds = new Set(existingAssignments.map(a => a.moduleId));

  // Create missing assignments
  const newAssignments = modules
    .filter(m => !existingModuleIds.has(m.id))
    .map(m => ({
      userId,
      moduleId: m.id,
      status: "NOT_STARTED" as TrainingStatus
    }));

  if (newAssignments.length > 0) {
    await prisma.trainingAssignment.createMany({
      data: newAssignments
    });
  }

  revalidatePath("/admin");
  revalidatePath("/instructor-training");
}

export async function updateTrainingStatus(formData: FormData) {
  const session = await requireAuth();
  const userId = session.user.id;
  const roles = session.user.roles ?? [];

  const assignmentId = getString(formData, "assignmentId");
  const status = getString(formData, "status") as TrainingStatus;

  const assignment = await prisma.trainingAssignment.findUnique({
    where: { id: assignmentId }
  });

  if (!assignment) {
    throw new Error("Assignment not found");
  }

  // Users can update their own, admins can update any
  if (assignment.userId !== userId && !roles.includes("ADMIN")) {
    throw new Error("Unauthorized");
  }

  await prisma.trainingAssignment.update({
    where: { id: assignmentId },
    data: {
      status,
      completedAt: status === "COMPLETE" ? new Date() : null
    }
  });

  revalidatePath("/instructor-training");
}

// ============================================
// CURRICULUM FEEDBACK
// ============================================

export async function submitCurriculumFeedback(formData: FormData) {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];

  if (!roles.includes("ADMIN") && !roles.includes("MENTOR") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Only admins, mentors, and chapter leads can submit curriculum feedback");
  }

  const instructorId = getString(formData, "instructorId");
  const rating = getString(formData, "rating", false);
  const comments = getString(formData, "comments");

  await prisma.feedback.create({
    data: {
      source: "PEER",
      rating: rating ? Number(rating) : null,
      comments,
      instructorId,
      authorId: session.user.id
    }
  });

  revalidatePath("/instructor-training");
  revalidatePath(`/profile/${instructorId}`);
}
