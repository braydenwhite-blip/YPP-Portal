import { prisma } from "@/lib/prisma";
import { whereActiveMember } from "@/lib/user-role-where";
import { resolveMentionedUserIds, type MentionableUser } from "@/lib/mentions";

let assignableUsersCache: { loadedAt: number; users: MentionableUser[] } | null = null;
const CACHE_TTL_MS = 60_000;

async function loadAssignableUsers(): Promise<MentionableUser[]> {
  const now = Date.now();
  if (assignableUsersCache && now - assignableUsersCache.loadedAt < CACHE_TTL_MS) {
    return assignableUsersCache.users;
  }

  const users = await prisma.user.findMany({
    where: { archivedAt: null, ...whereActiveMember() },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 500,
  });

  assignableUsersCache = { loadedAt: now, users };
  return users;
}

export async function resolveActionMentionUserIds(body: string): Promise<string[]> {
  const candidates = await loadAssignableUsers();
  return resolveMentionedUserIds(body, candidates);
}
