import { cache } from "react";
import { createServerClientOrNull } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeRoleValues, normalizeRoleValue } from "@/lib/role-utils";
import { getLegacySessionFromCookies } from "@/lib/legacy-auth-server";
import { normalizeAdminSubtypes, type AdminSubtypeValue } from "@/lib/admin-subtypes";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  roles: string[];
  primaryRole: string;
  chapterId?: string | null;
  adminSubtypes: AdminSubtypeValue[];
  /** Small sample for nav award tier; avoids a separate layout query. */
  awards?: { type: string | null }[];
};

const sessionUserSelect = {
  id: true,
  name: true,
  email: true,
  primaryRole: true,
  chapterId: true,
  archivedAt: true,
  roles: { select: { role: true } },
  adminSubtypes: { select: { subtype: true } },
  awards: {
    select: { type: true },
    orderBy: { awardedAt: "desc" },
    take: 24,
  },
} as const;

async function resolvePrismaUserForSession(where: {
  supabaseAuthId?: string;
  id?: string;
  email?: string;
}) {
  if (where.supabaseAuthId) {
    const user = await prisma.user.findUnique({
      where: { supabaseAuthId: where.supabaseAuthId },
      select: sessionUserSelect,
    });
    return user?.archivedAt ? null : user;
  }

  if (where.id) {
    const user = await prisma.user.findUnique({
      where: { id: where.id },
      select: sessionUserSelect,
    });
    return user?.archivedAt ? null : user;
  }

  if (where.email) {
    return prisma.user.findFirst({
      where: {
        email: where.email,
        archivedAt: null,
      },
      select: sessionUserSelect,
    });
  }

  return null;
}

/**
 * One Supabase + Prisma resolution per RSC request (layout + page both call getSession).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createServerClientOrNull();
  const authUser = supabase
    ? (await supabase.auth.getUser()).data.user
    : null;

  const prismaUser = authUser
    ? await resolvePrismaUserForSession({ supabaseAuthId: authUser.id })
    : await (async () => {
        const legacySession = await getLegacySessionFromCookies();
        if (!legacySession) return null;
        return resolvePrismaUserForSession({ id: legacySession.userId, email: legacySession.email });
      })();

  if (!prismaUser) return null;

  const resolvedUser = prismaUser;
  const roles = normalizeRoleValues(resolvedUser.roles.map((r) => r.role));
  const primaryRole =
    normalizeRoleValue(resolvedUser.primaryRole) ?? roles[0] ?? "STUDENT";
  const adminSubtypes = normalizeAdminSubtypes(
    resolvedUser.adminSubtypes.map((entry) => entry.subtype)
  );

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
    adminSubtypes,
    awards: resolvedUser.awards,
  };
});

/**
 * Returns a session-like object with `user` property so existing server code
 * can keep reading `session.user` while auth is powered by Supabase.
 */
export const getSession = cache(async (): Promise<{
  user: SessionUser & { image?: string | null };
} | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  return { user: { ...user, image: null } };
});
