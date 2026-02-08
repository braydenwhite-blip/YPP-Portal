"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActivityType } from "@prisma/client";

async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function requireInstructor() {
  const session = await requireAuth();
  const roles = session.user.roles ?? [];
  if (
    !roles.includes("INSTRUCTOR") &&
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_LEAD")
  ) {
    throw new Error("Unauthorized - Instructor access required");
  }
  return session;
}

export async function createLessonPlan(formData: FormData) {
  const session = await requireInstructor();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string)?.trim() || null;
  const isTemplate = formData.get("isTemplate") === "true";
  const activitiesJson = formData.get("activities") as string;

  if (!title) throw new Error("Title is required");

  let activities: Array<{
    title: string;
    description?: string;
    type: ActivityType;
    durationMin: number;
    sortOrder: number;
    resources?: string;
    notes?: string;
  }> = [];

  if (activitiesJson) {
    activities = JSON.parse(activitiesJson);
  }

  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMin, 0);

  await prisma.lessonPlan.create({
    data: {
      title,
      description,
      courseId,
      totalMinutes,
      authorId: session.user.id,
      isTemplate,
      activities: {
        create: activities.map((a, idx) => ({
          title: a.title,
          description: a.description || null,
          type: a.type,
          durationMin: a.durationMin,
          sortOrder: a.sortOrder ?? idx,
          resources: a.resources || null,
          notes: a.notes || null,
        })),
      },
    },
  });

  revalidatePath("/lesson-plans");
}

export async function updateLessonPlan(formData: FormData) {
  const session = await requireInstructor();

  const planId = formData.get("planId") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const courseId = (formData.get("courseId") as string)?.trim() || null;
  const isTemplate = formData.get("isTemplate") === "true";
  const activitiesJson = formData.get("activities") as string;

  if (!planId || !title) throw new Error("Plan ID and title are required");

  // Verify ownership
  const existing = await prisma.lessonPlan.findUnique({
    where: { id: planId },
  });
  const roles = session.user.roles ?? [];
  if (
    !existing ||
    (existing.authorId !== session.user.id && !roles.includes("ADMIN"))
  ) {
    throw new Error("Lesson plan not found or unauthorized");
  }

  let activities: Array<{
    title: string;
    description?: string;
    type: ActivityType;
    durationMin: number;
    sortOrder: number;
    resources?: string;
    notes?: string;
  }> = [];

  if (activitiesJson) {
    activities = JSON.parse(activitiesJson);
  }

  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMin, 0);

  // Delete old activities and recreate
  await prisma.lessonActivity.deleteMany({ where: { lessonPlanId: planId } });

  await prisma.lessonPlan.update({
    where: { id: planId },
    data: {
      title,
      description,
      courseId,
      totalMinutes,
      isTemplate,
      activities: {
        create: activities.map((a, idx) => ({
          title: a.title,
          description: a.description || null,
          type: a.type,
          durationMin: a.durationMin,
          sortOrder: a.sortOrder ?? idx,
          resources: a.resources || null,
          notes: a.notes || null,
        })),
      },
    },
  });

  revalidatePath("/lesson-plans");
}

export async function deleteLessonPlan(formData: FormData) {
  const session = await requireInstructor();

  const planId = formData.get("planId") as string;
  if (!planId) throw new Error("Plan ID is required");

  const existing = await prisma.lessonPlan.findUnique({
    where: { id: planId },
  });
  const roles = session.user.roles ?? [];
  if (
    !existing ||
    (existing.authorId !== session.user.id && !roles.includes("ADMIN"))
  ) {
    throw new Error("Lesson plan not found or unauthorized");
  }

  // Activities cascade-delete due to onDelete: Cascade
  await prisma.lessonPlan.delete({ where: { id: planId } });

  revalidatePath("/lesson-plans");
}

export async function duplicateLessonPlan(formData: FormData) {
  const session = await requireInstructor();

  const planId = formData.get("planId") as string;
  if (!planId) throw new Error("Plan ID is required");

  const existing = await prisma.lessonPlan.findUnique({
    where: { id: planId },
    include: { activities: { orderBy: { sortOrder: "asc" } } },
  });

  if (!existing) throw new Error("Lesson plan not found");

  await prisma.lessonPlan.create({
    data: {
      title: `${existing.title} (Copy)`,
      description: existing.description,
      courseId: existing.courseId,
      totalMinutes: existing.totalMinutes,
      authorId: session.user.id,
      isTemplate: false,
      activities: {
        create: existing.activities.map((a) => ({
          title: a.title,
          description: a.description,
          type: a.type,
          durationMin: a.durationMin,
          sortOrder: a.sortOrder,
          resources: a.resources,
          notes: a.notes,
        })),
      },
    },
  });

  revalidatePath("/lesson-plans");
}
