import { RoleType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function findDefaultInitialReviewerForChapter(chapterId?: string | null) {
  if (!chapterId) return null;

  return prisma.user.findFirst({
    where: {
      chapterId,
      OR: [
        { primaryRole: RoleType.CHAPTER_PRESIDENT },
        { roles: { some: { role: RoleType.CHAPTER_PRESIDENT } } },
      ],
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
  });
}
