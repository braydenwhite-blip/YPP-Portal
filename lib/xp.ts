import { prisma } from "@/lib/prisma";
import { getLevelForXp } from "@/lib/xp-config";

export { LEVELS, XP_REWARDS, getLevelForXp } from "@/lib/xp-config";

export async function awardXp(
  userId: string,
  amount: number,
  reason: string,
  metadata?: Record<string, unknown>
) {
  const [, user] = await prisma.$transaction([
    prisma.xpTransaction.create({
      data: { userId, amount, reason, metadata: (metadata ?? undefined) as any },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: amount } },
    }),
  ]);

  const levelInfo = getLevelForXp(user.xp);
  if (levelInfo.level !== user.level) {
    await prisma.user.update({
      where: { id: userId },
      data: { level: levelInfo.level },
    });
  }

  return { xp: user.xp, level: levelInfo.level, title: levelInfo.title };
}
