"use server";

import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { TrainingStatus } from "@prisma/client";

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

async function requireAdminOrChapterLead() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (!roles.includes("ADMIN") && !roles.includes("CHAPTER_LEAD")) {
    throw new Error("Unauthorized - Admin or Chapter Lead access required");
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
// COHORT MANAGEMENT (Admin)
// ============================================

export async function createTrainingCohort(formData: FormData) {
  await requireAdmin();

  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const startDateRaw = getString(formData, "startDate");
  const endDateRaw = getString(formData, "endDate", false);
  const facilitatorId = getString(formData, "facilitatorId", false);

  const startDate = new Date(startDateRaw);
  if (isNaN(startDate.getTime())) {
    throw new Error("Invalid start date");
  }

  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  if (endDate && isNaN(endDate.getTime())) {
    throw new Error("Invalid end date");
  }

  await prisma.trainingCohort.create({
    data: {
      name,
      description: description || null,
      startDate,
      endDate,
      facilitatorId: facilitatorId || null,
      isActive: true,
    },
  });

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
}

export async function updateTrainingCohort(formData: FormData) {
  await requireAdmin();

  const cohortId = getString(formData, "cohortId");
  const name = getString(formData, "name");
  const description = getString(formData, "description", false);
  const startDateRaw = getString(formData, "startDate");
  const endDateRaw = getString(formData, "endDate", false);
  const facilitatorId = getString(formData, "facilitatorId", false);
  const isActive = formData.get("isActive") === "on";

  const startDate = new Date(startDateRaw);
  if (isNaN(startDate.getTime())) {
    throw new Error("Invalid start date");
  }

  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  if (endDate && isNaN(endDate.getTime())) {
    throw new Error("Invalid end date");
  }

  await prisma.trainingCohort.update({
    where: { id: cohortId },
    data: {
      name,
      description: description || null,
      startDate,
      endDate,
      facilitatorId: facilitatorId || null,
      isActive,
    },
  });

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
}

export async function assignInstructorToCohort(formData: FormData) {
  await requireAdminOrChapterLead();

  const cohortId = getString(formData, "cohortId");
  const userId = getString(formData, "userId");
  const moduleId = getString(formData, "moduleId", false);

  const cohort = await prisma.trainingCohort.findUnique({
    where: { id: cohortId },
    select: { id: true },
  });

  if (!cohort) {
    throw new Error("Cohort not found");
  }

  if (moduleId) {
    // Assign to specific module within cohort
    await prisma.trainingAssignment.upsert({
      where: {
        userId_moduleId: { userId, moduleId },
      },
      create: {
        userId,
        moduleId,
        cohortId,
        status: TrainingStatus.NOT_STARTED,
      },
      update: {
        cohortId,
      },
    });
  } else {
    // Assign to all required modules within cohort
    const requiredModules = await prisma.trainingModule.findMany({
      where: { required: true },
      select: { id: true },
    });

    await Promise.all(
      requiredModules.map((module) =>
        prisma.trainingAssignment.upsert({
          where: {
            userId_moduleId: { userId, moduleId: module.id },
          },
          create: {
            userId,
            moduleId: module.id,
            cohortId,
            status: TrainingStatus.NOT_STARTED,
          },
          update: {
            cohortId,
          },
        })
      )
    );
  }

  revalidatePath("/admin/training");
  revalidatePath("/instructor-training");
}

// ============================================
// COHORT RETRIEVAL
// ============================================

export async function getActiveCohorts() {
  await requireAuth();

  return prisma.trainingCohort.findMany({
    where: { isActive: true },
    include: {
      facilitator: {
        select: { id: true, name: true, email: true },
      },
      _count: {
        select: { assignments: true },
      },
    },
    orderBy: { startDate: "asc" },
  });
}

export async function getCohortById(cohortId: string) {
  await requireAuth();

  return prisma.trainingCohort.findUnique({
    where: { id: cohortId },
    include: {
      facilitator: {
        select: { id: true, name: true, email: true },
      },
      assignments: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          module: {
            select: { id: true, title: true, sortOrder: true },
          },
        },
        orderBy: [
          { module: { sortOrder: "asc" } },
        ],
      },
    },
  });
}

export async function getUserCohorts(userId?: string) {
  const session = await requireAuth();
  const targetUserId = userId || session.user.id;

  const assignments = await prisma.trainingAssignment.findMany({
    where: {
      userId: targetUserId,
      cohortId: { not: null },
    },
    select: {
      cohort: {
        select: {
          id: true,
          name: true,
          description: true,
          startDate: true,
          endDate: true,
          isActive: true,
          facilitator: {
            select: { id: true, name: true },
          },
        },
      },
    },
    distinct: ["cohortId"],
  });

  return assignments
    .map((a) => a.cohort)
    .filter((cohort): cohort is NonNullable<typeof cohort> => cohort !== null);
}

// ============================================
// COHORT ANALYTICS
// ============================================

export async function getCohortProgressSummary(cohortId: string) {
  await requireAdminOrChapterLead();

  const cohort = await prisma.trainingCohort.findUnique({
    where: { id: cohortId },
    include: {
      assignments: {
        include: {
          user: {
            select: { id: true, name: true },
          },
          module: {
            select: { id: true, title: true, required: true },
          },
        },
      },
    },
  });

  if (!cohort) {
    throw new Error("Cohort not found");
  }

  // Group by user to get per-user progress
  const userProgress = new Map<
    string,
    {
      userId: string;
      userName: string;
      totalModules: number;
      completedModules: number;
      requiredModulesComplete: number;
      totalRequired: number;
    }
  >();

  for (const assignment of cohort.assignments) {
    const existing = userProgress.get(assignment.userId) ?? {
      userId: assignment.userId,
      userName: assignment.user.name,
      totalModules: 0,
      completedModules: 0,
      requiredModulesComplete: 0,
      totalRequired: 0,
    };

    existing.totalModules += 1;
    if (assignment.status === "COMPLETE") {
      existing.completedModules += 1;
    }
    if (assignment.module.required) {
      existing.totalRequired += 1;
      if (assignment.status === "COMPLETE") {
        existing.requiredModulesComplete += 1;
      }
    }

    userProgress.set(assignment.userId, existing);
  }

  return {
    cohort: {
      id: cohort.id,
      name: cohort.name,
      startDate: cohort.startDate,
      endDate: cohort.endDate,
    },
    participantCount: userProgress.size,
    userProgress: Array.from(userProgress.values()),
  };
}
