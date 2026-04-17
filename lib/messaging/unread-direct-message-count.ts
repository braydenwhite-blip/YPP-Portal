import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Count 1:1 conversations where the latest message is from someone else
 * and is newer than this participant's lastReadAt.
 *
 * Implemented as SQL so we avoid loading every DM + latest message into Node.
 */
export async function countUnreadDirectMessages(userId: string): Promise<number> {
  const rows = await prisma.$queryRaw<[{ count: bigint }]>(
    Prisma.sql`
    WITH user_dms AS (
      SELECT cp."conversationId", cp."lastReadAt"
      FROM "ConversationParticipant" cp
      INNER JOIN "Conversation" c ON c.id = cp."conversationId"
      WHERE cp."userId" = ${userId}
        AND c."isGroup" = false
    ),
    latest AS (
      SELECT DISTINCT ON (m."conversationId")
        m."conversationId",
        m."createdAt",
        m."senderId"
      FROM "Message" m
      INNER JOIN user_dms ud ON ud."conversationId" = m."conversationId"
      ORDER BY m."conversationId", m."createdAt" DESC
    )
    SELECT COUNT(*)::bigint AS count
    FROM user_dms ud
    INNER JOIN latest lm ON lm."conversationId" = ud."conversationId"
    WHERE lm."senderId" <> ${userId}
      AND lm."createdAt" > ud."lastReadAt"
    `
  );

  return Number(rows[0]?.count ?? 0);
}
