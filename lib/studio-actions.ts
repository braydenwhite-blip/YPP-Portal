"use server";

/**
 * Studio Actions — lesson plan create/update for the Lesson Design Studio.
 * Identical logic to lesson-plan-actions.ts but also allows APPLICANT role,
 * so instructor applicants can build and save lesson plans during training.
 */

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ActivityType } from "@prisma/client";

async function requireStudioAccess() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");
  const roles = session.user.roles ?? [];
  const allowed =
    roles.includes("INSTRUCTOR") ||
    roles.includes("ADMIN") ||
    roles.includes("CHAPTER_LEAD") ||
    roles.includes("APPLICANT");
  if (!allowed) throw new Error("Studio access requires Instructor or Applicant role");
  return session;
}

function revalidateStudioSurfaces() {
  revalidatePath("/lesson-plans");
  revalidatePath("/instructor/workspace");
  revalidatePath("/instructor/curriculum-builder");
  revalidatePath("/instructor/lesson-design-studio");
}

export async function studioCreateLessonPlan(formData: FormData) {
  const session = await requireStudioAccess();

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const classTemplateIdRaw = (formData.get("classTemplateId") as string)?.trim() || null;
  const isTemplate = formData.get("isTemplate") === "true";
  const activitiesJson = formData.get("activities") as string;

  if (!title) throw new Error("Title is required");

  const activities: Array<{
    title: string;
    description?: string;
    type: ActivityType;
    durationMin: number;
    sortOrder: number;
    resources?: string;
    notes?: string;
  }> = activitiesJson ? JSON.parse(activitiesJson) : [];

  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMin, 0);

  // Validate the classTemplateId exists — applicants can only link to published templates
  const roles = session.user.roles ?? [];
  let classTemplateId: string | null = null;
  if (classTemplateIdRaw) {
    const template = await prisma.classTemplate.findFirst({
      where: roles.includes("ADMIN")
        ? { id: classTemplateIdRaw }
        : { id: classTemplateIdRaw, OR: [{ createdById: session.user.id }, { isPublished: true }] },
      select: { id: true },
    });
    if (template) classTemplateId = template.id;
  }

  const plan = await prisma.lessonPlan.create({
    data: {
      title,
      description,
      courseId: null,
      classTemplateId,
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
    select: { id: true },
  });

  revalidateStudioSurfaces();
  return { id: plan.id };
}

export async function studioUpdateLessonPlan(formData: FormData) {
  const session = await requireStudioAccess();

  const planId = formData.get("planId") as string;
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const isTemplate = formData.get("isTemplate") === "true";
  const activitiesJson = formData.get("activities") as string;

  if (!planId || !title) throw new Error("Plan ID and title are required");

  const existing = await prisma.lessonPlan.findUnique({ where: { id: planId } });
  const roles = session.user.roles ?? [];
  if (!existing || (existing.authorId !== session.user.id && !roles.includes("ADMIN"))) {
    throw new Error("Lesson plan not found or unauthorized");
  }

  const activities: Array<{
    title: string;
    description?: string;
    type: ActivityType;
    durationMin: number;
    sortOrder: number;
    resources?: string;
    notes?: string;
  }> = activitiesJson ? JSON.parse(activitiesJson) : [];

  const totalMinutes = activities.reduce((sum, a) => sum + a.durationMin, 0);

  await prisma.$transaction([
    prisma.lessonActivity.deleteMany({ where: { lessonPlanId: planId } }),
    prisma.lessonPlan.update({
      where: { id: planId },
      data: {
        title,
        description,
        totalMinutes,
        isTemplate,
        updatedAt: new Date(),
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
    }),
  ]);

  revalidateStudioSurfaces();
  return { id: planId };
}
