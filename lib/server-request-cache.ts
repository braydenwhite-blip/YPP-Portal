import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { countUnreadDirectMessages } from "@/lib/messaging/unread-direct-message-count";

/** One query per request — shared by app layout and dashboard (and similar callers). */
export const getUnreadDirectMessageCountCached = cache(async (userId: string) => {
  try {
    return await countUnreadDirectMessages(userId);
  } catch {
    return 0;
  }
});

export const getUnreadNotificationCountCached = cache(async (userId: string) => {
  try {
    return await prisma.notification.count({
      where: { userId, isRead: false },
    });
  } catch {
    return 0;
  }
});
