import { createServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeRoleValues, normalizeRoleValue } from "@/lib/role-utils";
import { getLegacySessionFromCookies } from "@/lib/legacy-auth-server";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  roles: string[];
  primaryRole: string;
  chapterId?: string | null;
};

/**
 * Get the current authenticated user from Supabase Auth,
 * resolved to the Prisma User record with roles.
 *
 * Returns null if not authenticated or user not found in DB.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  async function resolvePrismaUser(where: { supabaseAuthId?: string; id?: string; email?: string }) {
    return prisma.user.findFirst({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        primaryRole: true,
        chapterId: true,
        roles: { select: { role: true } },
      },
    });
  }

  const supabase = await createServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  const prismaUser = authUser
    ? await resolvePrismaUser({ supabaseAuthId: authUser.id })
    : await (async () => {
        const legacySession = await getLegacySessionFromCookies();
        if (!legacySession) return null;
        return resolvePrismaUser({ id: legacySession.userId, email: legacySession.email });
      })();

  if (!prismaUser) return null;

  const resolvedUser = prismaUser;
  const roles = normalizeRoleValues(resolvedUser.roles.map((r) => r.role));
  const primaryRole =
    normalizeRoleValue(resolvedUser.primaryRole) ?? roles[0] ?? "STUDENT";

  if (!roles.includes(primaryRole)) {
    roles.unshift(primaryRole);
  }

  return {
    id: resolvedUser.id,
    name: resolvedUser.name,
    email: resolvedUser.email,
    roles: Array.from(new Set(roles)),
    primaryRole,
    chapterId: resolvedUser.chapterId,
  };
}

/**
 * Returns a session-like object with `user` property so existing server code
 * can keep reading `session.user` while auth is powered by Supabase.
 */
export async function getSession(): Promise<{
  user: SessionUser & { image?: string | null };
} | null> {
  const user = await getSessionUser();
  if (!user) return null;
  return { user: { ...user, image: null } };
}
