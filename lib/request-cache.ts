import { cache } from "react";
import { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth-supabase";
import { prisma } from "@/lib/prisma";

export const getCachedServerSession = cache(() => getSession());

export const getUserAwardTypes = cache(async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: { awards: { select: { type: true } } },
  })
);

export const getUnreadNotificationCount = cache(async (userId: string) =>
  prisma.notification.count({
    where: { userId, isRead: false },
  })
);

export const getRecentNotifications = cache(async (userId: string, take: number) =>
  prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  })
);

export const getUnreadMessageCount = cache(async (userId: string) => {
  const rows = await prisma.$queryRaw<Array<{ unreadCount: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS "unreadCount"
    FROM "ConversationParticipant" cp
    JOIN LATERAL (
      SELECT m."senderId", m."createdAt"
      FROM "Message" m
      WHERE m."conversationId" = cp."conversationId"
      ORDER BY m."createdAt" DESC
      LIMIT 1
    ) latest ON true
    WHERE cp."userId" = ${userId}
      AND latest."createdAt" > cp."lastReadAt"
      AND latest."senderId" <> ${userId}
  `);

  return Number(rows[0]?.unreadCount ?? 0);
});
