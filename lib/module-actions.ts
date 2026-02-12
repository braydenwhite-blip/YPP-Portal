"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Fetch all published learning modules with optional filters. */
export async function getPublishedModules(filters?: {
  passionId?: string;
  level?: string;
  search?: string;
}) {
  const where: Record<string, unknown> = { isActive: true };

  if (filters?.passionId) {
    where.passionId = filters.passionId;
  }
  if (filters?.level) {
    where.level = filters.level;
  }
  if (filters?.search) {
    where.OR = [
      { title: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
      { tags: { hasSome: [filters.search.toLowerCase()] } },
    ];
  }

  return prisma.learningModule.findMany({
    where,
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
  });
}

/** Fetch a single module by id. */
export async function getModuleById(id: string) {
  return prisma.learningModule.findUnique({ where: { id } });
}

/** Fetch the current user's watch progress for given module ids. */
export async function getMyModuleProgress(moduleIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || moduleIds.length === 0) return [];

  return prisma.moduleWatchProgress.findMany({
    where: {
      studentId: session.user.id,
      moduleId: { in: moduleIds },
    },
  });
}

/** Fetch the current user's progress for a single module. */
export async function getMyProgressForModule(moduleId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  return prisma.moduleWatchProgress.findUnique({
    where: {
      studentId_moduleId: {
        studentId: session.user.id,
        moduleId,
      },
    },
  });
}

/** Get unique passion ids used across active modules (for filter dropdown). */
export async function getModulePassionIds() {
  const modules = await prisma.learningModule.findMany({
    where: { isActive: true },
    select: { passionId: true },
    distinct: ["passionId"],
    orderBy: { passionId: "asc" },
  });
  return modules.map((m) => m.passionId);
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Record or update watch progress for a module. */
export async function updateWatchProgress(
  moduleId: string,
  watchTimeSeconds: number,
) {
  const session = await requireUser();
  const userId = session.user.id as string;

  await prisma.moduleWatchProgress.upsert({
    where: {
      studentId_moduleId: { studentId: userId, moduleId },
    },
    create: {
      studentId: userId,
      moduleId,
      watchTime: watchTimeSeconds,
      lastWatchedAt: new Date(),
    },
    update: {
      watchTime: watchTimeSeconds,
      lastWatchedAt: new Date(),
    },
  });

  revalidatePath("/learn/modules");
  revalidatePath(`/learn/modules/${moduleId}`);
}

/** Mark a module as completed. Optionally include a rating. */
export async function completeModule(moduleId: string, rating?: number) {
  const session = await requireUser();
  const userId = session.user.id as string;

  await prisma.moduleWatchProgress.upsert({
    where: {
      studentId_moduleId: { studentId: userId, moduleId },
    },
    create: {
      studentId: userId,
      moduleId,
      completed: true,
      rating: rating ?? null,
      lastWatchedAt: new Date(),
    },
    update: {
      completed: true,
      rating: rating ?? undefined,
      lastWatchedAt: new Date(),
    },
  });

  // Increment view count on the module itself
  await prisma.learningModule.update({
    where: { id: moduleId },
    data: { viewCount: { increment: 1 } },
  });

  // Award XP if available
  try {
    await prisma.xpTransaction.create({
      data: {
        userId,
        amount: 15,
        reason: "Completed learning module",
        sourceType: "MODULE",
        sourceId: moduleId,
      },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: 15 } },
    });
  } catch {
    // XP columns or table may not exist yet — non-critical
  }

  revalidatePath("/learn/modules");
  revalidatePath(`/learn/modules/${moduleId}`);
}
