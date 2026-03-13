"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasInstructorPathwaySpecTable } from "@/lib/instructor-pathway-spec-compat";

export async function toggleInstructorPathwaySpec(pathwayId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const roles = session.user.roles ?? [];
  const canAccess =
    roles.includes("INSTRUCTOR") || roles.includes("ADMIN") || roles.includes("CHAPTER_LEAD");
  if (!canAccess) throw new Error("Forbidden");
  if (!(await hasInstructorPathwaySpecTable())) {
    throw new Error("Teaching specialties will be available after the latest pathway database migration is applied.");
  }

  const existing = await prisma.instructorPathwaySpec.findUnique({
    where: { userId_pathwayId: { userId: session.user.id, pathwayId } },
  });

  if (existing) {
    await prisma.instructorPathwaySpec.delete({
      where: { userId_pathwayId: { userId: session.user.id, pathwayId } },
    });
  } else {
    await prisma.instructorPathwaySpec.create({
      data: { userId: session.user.id, pathwayId },
    });
  }

  revalidatePath("/instructor/workspace");
}
