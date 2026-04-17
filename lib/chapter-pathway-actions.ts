"use server";

import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-supabase";
import { revalidatePath } from "next/cache";

interface UpdateChapterPathwayConfigInput {
  chapterId: string;
  pathwayId: string;
  isAvailable?: boolean;
  isFeatured?: boolean;
  displayOrder?: number;
  runStatus?: "NOT_OFFERED" | "COMING_SOON" | "ACTIVE" | "PAUSED";
  ownerId?: string | null;
}

export async function updateChapterPathwayConfig(input: UpdateChapterPathwayConfigInput) {
  const session = await getSession();
  if (!session?.user?.id) return { error: "Not authenticated" };
  if (!(session.user.roles ?? []).includes("ADMIN")) return { error: "Unauthorized" };

  await prisma.chapterPathway.upsert({
    where: { chapterId_pathwayId: { chapterId: input.chapterId, pathwayId: input.pathwayId } },
    create: {
      chapterId: input.chapterId,
      pathwayId: input.pathwayId,
      isAvailable: input.isAvailable ?? true,
      isFeatured: input.isFeatured ?? false,
      runStatus: input.runStatus ?? "NOT_OFFERED",
      ownerId: input.ownerId ?? null,
      displayOrder: input.displayOrder ?? 0,
    },
    update: {
      ...(input.isAvailable !== undefined ? { isAvailable: input.isAvailable } : {}),
      ...(input.isFeatured !== undefined ? { isFeatured: input.isFeatured } : {}),
      ...(input.runStatus !== undefined ? { runStatus: input.runStatus } : {}),
      ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
      ...(input.displayOrder !== undefined ? { displayOrder: input.displayOrder } : {}),
    },
  });

  revalidatePath("/admin/pathways");
  revalidatePath("/pathways");
  revalidatePath("/my-chapter");

  return { success: true };
}
