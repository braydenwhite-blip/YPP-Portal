"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";
import {
  ApplicationCohortType,
  PositionType,
  InstructorApplicationStatus,
  ChapterPresidentApplicationStatus,
} from "@prisma/client";

async function requireAdmin() {
  const session = await getSession();
  const roles = session?.user?.roles ?? [];
  if (!session || !roles.includes("ADMIN")) {
    throw new Error("Unauthorized: Admin access required");
  }
  return session;
}

export async function getApplicationCohorts(
  type?: string,
  roleType?: string
) {
  await requireAdmin();

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (roleType) where.roleType = roleType;

  const cohorts = await prisma.applicationCohort.findMany({
    where,
    include: {
      _count: {
        select: {
          instructorApplications: true,
          chapterPresidentApplications: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return cohorts;
}

export async function createApplicationCohort(formData: FormData) {
  const session = await requireAdmin();

  const name = formData.get("name") as string;
  const type = formData.get("type") as ApplicationCohortType;
  const roleType = formData.get("roleType") as PositionType;

  if (!name || !type || !roleType) {
    throw new Error("Name, type, and role type are required");
  }

  await prisma.applicationCohort.create({
    data: {
      name,
      type,
      roleType,
      createdById: session.user.id,
    },
  });

  revalidatePath("/admin/application-cohorts");
}

export async function addApplicationsToCohort(
  cohortId: string,
  applicationIds: string[],
  applicationType: "instructor" | "chapter_president"
) {
  await requireAdmin();

  if (applicationType === "instructor") {
    await prisma.instructorApplication.updateMany({
      where: { id: { in: applicationIds } },
      data: { cohortId },
    });
  } else {
    await prisma.chapterPresidentApplication.updateMany({
      where: { id: { in: applicationIds } },
      data: { cohortId },
    });
  }

  revalidatePath("/admin/application-cohorts");
}

export async function removeApplicationFromCohort(
  applicationId: string,
  applicationType: "instructor" | "chapter_president"
) {
  await requireAdmin();

  if (applicationType === "instructor") {
    await prisma.instructorApplication.update({
      where: { id: applicationId },
      data: { cohortId: null },
    });
  } else {
    await prisma.chapterPresidentApplication.update({
      where: { id: applicationId },
      data: { cohortId: null },
    });
  }

  revalidatePath("/admin/application-cohorts");
}

export async function batchUpdateStatus(
  cohortId: string,
  newStatus: string,
  applicationType: "instructor" | "chapter_president"
) {
  await requireAdmin();

  if (applicationType === "instructor") {
    await prisma.instructorApplication.updateMany({
      where: { cohortId },
      data: { status: newStatus as InstructorApplicationStatus },
    });
  } else {
    await prisma.chapterPresidentApplication.updateMany({
      where: { cohortId },
      data: { status: newStatus as ChapterPresidentApplicationStatus },
    });
  }

  revalidatePath("/admin/application-cohorts");
}
