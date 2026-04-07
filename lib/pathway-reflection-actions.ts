"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { getMentorshipRoleFlags } from "@/lib/mentorship-hub";
import { hasMentorshipMenteeAccess } from "@/lib/mentorship-access";

interface SaveReflectionInput {
  pathwayId: string;
  stepOrder: number;
  content: string;
  visibleToMentor: boolean;
}

export async function savePathwayReflection(input: SaveReflectionInput) {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };

  const content = input.content.trim();
  if (!content) {
    return { error: "Reflection content is required" };
  }

  const step = await prisma.pathwayStep.findFirst({
    where: { pathwayId: input.pathwayId, stepOrder: input.stepOrder },
    select: { id: true, courseId: true },
  });
  if (!step) {
    return { error: "Pathway step not found" };
  }
  if (!step.courseId) {
    return { error: "Reflections are only supported for course-based pathway steps." };
  }

  const completedEnrollment = await prisma.enrollment.findFirst({
    where: {
      userId: session.user.id,
      courseId: step.courseId,
      status: "COMPLETED",
    },
  });
  if (!completedEnrollment) {
    return { error: "Complete this step before saving a reflection." };
  }

  const existingReflection = await prisma.pathwayReflection.findFirst({
    where: {
      userId: session.user.id,
      pathwayId: input.pathwayId,
      stepOrder: input.stepOrder,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingReflection) {
    await prisma.pathwayReflection.update({
      where: { id: existingReflection.id },
      data: {
        content,
        visibleToMentor: input.visibleToMentor,
      },
    });
  } else {
    await prisma.pathwayReflection.create({
      data: {
        userId: session.user.id,
        pathwayId: input.pathwayId,
        stepOrder: input.stepOrder,
        content,
        visibleToMentor: input.visibleToMentor,
      },
    });
  }

  return { success: true };
}

export async function getPathwayReflectionsForMentee(menteeId: string, pathwayId: string) {
  const session = await getSession();
  if (!session?.user?.id) return [];

  const roles = session.user.roles ?? [];
  const flags = getMentorshipRoleFlags(roles);
  const isSelf = session.user.id === menteeId;

  if (!isSelf) {
    if (!flags.canSupport) return [];
    if (!(await hasMentorshipMenteeAccess(session.user.id, roles, menteeId))) {
      return [];
    }
  }

  return prisma.pathwayReflection.findMany({
    where: {
      userId: menteeId,
      pathwayId,
      ...(isSelf ? {} : { visibleToMentor: true }),
    },
    orderBy: { createdAt: "asc" },
  });
}
