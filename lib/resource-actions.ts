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
// RESOURCE MANAGEMENT (Admin)
// ============================================

export async function createTrainingResource(formData: FormData) {
  await requireAdmin();

  const moduleId = getString(formData, "moduleId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const resourceUrl = getString(formData, "resourceUrl");
  const resourceType = getString(formData, "resourceType");
  const sortOrder = Number(formData.get("sortOrder") ?? "1");

  const module = await prisma.trainingModule.findUnique({
    where: { id: moduleId },
    select: { id: true },
  });

  if (!module) {
    throw new Error("Training module not found");
  }

  await prisma.trainingResource.create({
    data: {
      moduleId,
      title,
      description: description || null,
      resourceUrl,
      resourceType,
      sortOrder: Math.max(1, sortOrder),
    },
  });

  revalidatePath(`/training/${moduleId}`);
  revalidatePath("/instructor-training");
  revalidatePath("/admin/training");
}

export async function updateTrainingResource(formData: FormData) {
  await requireAdmin();

  const resourceId = getString(formData, "resourceId");
  const title = getString(formData, "title");
  const description = getString(formData, "description", false);
  const resourceUrl = getString(formData, "resourceUrl");
  const resourceType = getString(formData, "resourceType");
  const sortOrder = Number(formData.get("sortOrder") ?? "1");

  const resource = await prisma.trainingResource.findUnique({
    where: { id: resourceId },
    select: { moduleId: true },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  await prisma.trainingResource.update({
    where: { id: resourceId },
    data: {
      title,
      description: description || null,
      resourceUrl,
      resourceType,
      sortOrder: Math.max(1, sortOrder),
    },
  });

  revalidatePath(`/training/${resource.moduleId}`);
  revalidatePath("/instructor-training");
  revalidatePath("/admin/training");
}

export async function deleteTrainingResource(formData: FormData) {
  await requireAdmin();

  const resourceId = getString(formData, "resourceId");

  const resource = await prisma.trainingResource.findUnique({
    where: { id: resourceId },
    select: { moduleId: true },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  await prisma.trainingResource.delete({
    where: { id: resourceId },
  });

  revalidatePath(`/training/${resource.moduleId}`);
  revalidatePath("/instructor-training");
  revalidatePath("/admin/training");
}

// ============================================
// RESOURCE DOWNLOAD TRACKING
// ============================================

export async function trackResourceDownload(formData: FormData) {
  await requireAuth();

  const resourceId = getString(formData, "resourceId");

  const resource = await prisma.trainingResource.findUnique({
    where: { id: resourceId },
    select: { id: true, moduleId: true, resourceUrl: true },
  });

  if (!resource) {
    throw new Error("Resource not found");
  }

  await prisma.trainingResource.update({
    where: { id: resourceId },
    data: {
      downloads: { increment: 1 },
    },
  });

  return { resourceUrl: resource.resourceUrl };
}

// ============================================
// RESOURCE RETRIEVAL
// ============================================

export async function getModuleResources(moduleId: string) {
  await requireAuth();

  return prisma.trainingResource.findMany({
    where: { moduleId },
    orderBy: { sortOrder: "asc" },
  });
}

export async function getAllModuleResources() {
  await requireAuth();

  return prisma.trainingResource.findMany({
    include: {
      module: {
        select: {
          id: true,
          title: true,
          sortOrder: true,
        },
      },
    },
    orderBy: [
      { module: { sortOrder: "asc" } },
      { sortOrder: "asc" },
    ],
  });
}
