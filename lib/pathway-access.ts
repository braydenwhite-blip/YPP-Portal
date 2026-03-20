import { prisma } from "@/lib/prisma";

export type ChapterPathwayConfigValue = {
  isAvailable: boolean;
  isFeatured: boolean;
  displayOrder: number;
};

export type ChapterPathwayConfigMap = Map<string, ChapterPathwayConfigValue>;

export async function getChapterPathwayConfigMapForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { chapterId: true },
  });

  if (!user?.chapterId) {
    return {
      chapterId: null,
      configMap: new Map<string, ChapterPathwayConfigValue>(),
    };
  }

  const configs = await prisma.chapterPathway
    .findMany({
      where: { chapterId: user.chapterId },
      select: {
        pathwayId: true,
        isAvailable: true,
        isFeatured: true,
        displayOrder: true,
      },
    })
    .catch(
      () =>
        [] as Array<{
          pathwayId: string;
          isAvailable: boolean;
          isFeatured: boolean;
          displayOrder: number;
        }>
    );

  return {
    chapterId: user.chapterId,
    configMap: new Map(
      configs.map((config) => [
        config.pathwayId,
        {
          isAvailable: config.isAvailable,
          isFeatured: config.isFeatured,
          displayOrder: config.displayOrder,
        },
      ])
    ),
  };
}

export function isPathwayAvailableForUserChapter(
  pathwayId: string,
  chapterId: string | null,
  configMap: ChapterPathwayConfigMap
) {
  if (!chapterId) {
    return true;
  }

  return configMap.get(pathwayId)?.isAvailable !== false;
}

export function comparePathwaysByChapterConfig(
  configMap: ChapterPathwayConfigMap,
  left: { id: string; name: string },
  right: { id: string; name: string }
) {
  const leftConfig = configMap.get(left.id);
  const rightConfig = configMap.get(right.id);

  const leftFeatured = leftConfig?.isFeatured ? 1 : 0;
  const rightFeatured = rightConfig?.isFeatured ? 1 : 0;
  if (leftFeatured !== rightFeatured) {
    return rightFeatured - leftFeatured;
  }

  const leftDisplayOrder = leftConfig?.displayOrder ?? Number.MAX_SAFE_INTEGER;
  const rightDisplayOrder = rightConfig?.displayOrder ?? Number.MAX_SAFE_INTEGER;
  if (leftDisplayOrder !== rightDisplayOrder) {
    return leftDisplayOrder - rightDisplayOrder;
  }

  return left.name.localeCompare(right.name);
}
