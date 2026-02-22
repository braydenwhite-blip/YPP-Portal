"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface UpdateChapterPathwayConfigInput {
  chapterId: string;
  pathwayId: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
}

export async function updateChapterPathwayConfig(input: UpdateChapterPathwayConfigInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (session.user.primaryRole !== "ADMIN") return { error: "Unauthorized" };

  await prisma.chapterPathway.upsert({
    where: { chapterId_pathwayId: { chapterId: input.chapterId, pathwayId: input.pathwayId } },
    create: {
      chapterId: input.chapterId,
      pathwayId: input.pathwayId,
      isAvailable: input.isAvailable ?? true,
      isFeatured: input.isFeatured ?? false,
      displayOrder: input.displayOrder ?? 0,
    },
    update: {
      ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
    },
  });

  return { success: true };
}
