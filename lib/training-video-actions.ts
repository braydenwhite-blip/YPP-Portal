"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import { VideoProvider } from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
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

export async function createTrainingVideo(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const videoUrl = getString(formData, "videoUrl");
  const videoProvider = getString(formData, "videoProvider") as VideoProvider;
  const videoDuration = Number(formData.get("videoDuration") ?? "0");
  const sortOrder = Number(formData.get("sortOrder") ?? "1");
  const isSupplementary = formData.get("isSupplementary") === "on";

  if (!Object.values(VideoProvider).includes(videoProvider)) {
    throw new Error("Invalid video provider");
  }

  await prisma.trainingVideo.create({
    data: {
      moduleId,
      title,
      description: description || null,
      videoUrl,
      videoProvider,
      videoDuration: Math.max(0, videoDuration),
      sortOrder: Math.max(1, sortOrder),
      isSupplementary,
    },
  });

  revalidatePath("/admin/training");
  revalidatePath(`/training/${moduleId}`);
  revalidatePath("/instructor-training");
}

export async function updateTrainingVideo(formData: FormData) {
  await requireAdmin();

  const videoId = getString(formData, "videoId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const videoUrl = getString(formData, "videoUrl");
  const videoProvider = getString(formData, "videoProvider") as VideoProvider;
  const videoDuration = Number(formData.get("videoDuration") ?? "0");
  const sortOrder = Number(formData.get("sortOrder") ?? "1");
  const isSupplementary = formData.get("isSupplementary") === "on";

  if (!Object.values(VideoProvider).includes(videoProvider)) {
    throw new Error("Invalid video provider");
  }

  const existing = await prisma.trainingVideo.findUnique({
    where: { id: videoId },
    select: { moduleId: true },
  });

  if (!existing) {
    throw new Error("Video not found");
  }

  await prisma.trainingVideo.update({
    where: { id: videoId },
    data: {
      title,
      description: description || null,
      videoUrl,
      videoProvider,
      videoDuration: Math.max(0, videoDuration),
      sortOrder: Math.max(1, sortOrder),
      isSupplementary,
    },
  });

  revalidatePath("/admin/training");
  revalidatePath(`/training/${existing.moduleId}`);
  revalidatePath("/instructor-training");
}

export async function deleteTrainingVideo(formData: FormData) {
  await requireAdmin();

  const videoId = getString(formData, "videoId");

  const existing = await prisma.trainingVideo.findUnique({
    where: { id: videoId },
    select: { moduleId: true },
  });

  if (!existing) {
    throw new Error("Video not found");
  }

  await prisma.trainingVideo.delete({
    where: { id: videoId },
  });

  revalidatePath("/admin/training");
  revalidatePath(`/training/${existing.moduleId}`);
  revalidatePath("/instructor-training");
}
