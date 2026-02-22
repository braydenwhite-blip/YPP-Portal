"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface SaveReflectionInput {
  pathwayId: string;
  stepOrder: number;
  content: string;
  visibleToMentor: boolean;
}

export async function savePathwayReflection(input: SaveReflectionInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };

  await prisma.pathwayReflection.create({
    data: {
      userId: session.user.id,
      pathwayId: input.pathwayId,
      stepOrder: input.stepOrder,
      content: input.content,
      visibleToMentor: input.visibleToMentor,
    },
  });

  return { success: true };
}

export async function getPathwayReflectionsForMentee(menteeId: string, pathwayId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return [];

  // Only instructors/mentors can view mentee reflections
  const isMentorOrAdmin = ["INSTRUCTOR", "ADMIN", "MENTOR"].includes(session.user.primaryRole ?? "");
  if (!isMentorOrAdmin) return [];

  return prisma.pathwayReflection.findMany({
    where: { userId: menteeId, pathwayId, visibleToMentor: true },
    orderBy: { createdAt: "asc" },
  });
}
