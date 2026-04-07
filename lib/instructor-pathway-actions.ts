"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";
import { hasInstructorPathwaySpecTable } from "@/lib/instructor-pathway-spec-compat";

export async function toggleInstructorPathwaySpec(pathwayId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const roles = session.user.roles ?? [];
  if (!roles.includes("INSTRUCTOR")) {
    throw new Error("Only instructors can manage teaching specialties.");
  }
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
  revalidatePath(`/pathways/${pathwayId}/mentors`);
  revalidatePath("/admin/mentor-match");
}
