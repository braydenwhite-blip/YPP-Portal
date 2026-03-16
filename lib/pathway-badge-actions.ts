"use server";

import { prisma } from "@/lib/prisma";

export async function awardPathwayBadge(userId: string, pathwayId: string, pathwayName: string) {
  try {
    const badgeName = `${pathwayName} Graduate`;

    // Find or create a badge for this pathway
    let badge = await prisma.badge.findFirst({
      where: { name: badgeName },
    });

    if (!badge) {
      badge = await prisma.badge.create({
        data: {
          name: badgeName,
          description: `Awarded for completing all steps in the ${pathwayName}.`,
          icon: "🎓",
          category: "MASTERY",
          rarity: "RARE",
          isActive: true,
          order: 0,
        },
      });
    }

    // Upsert student badge (idempotent)
    await prisma.studentBadge.upsert({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
      create: { userId, badgeId: badge.id },
      update: {},
    });

    return { success: true, badge };
  } catch {
    return { success: false };
  }
}
