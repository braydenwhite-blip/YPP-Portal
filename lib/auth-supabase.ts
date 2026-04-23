import { cache } from "react";
import { createServerClientOrNull } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { normalizeRoleValues, normalizeRoleValue } from "@/lib/role-utils";
import { getLegacySessionFromCookies } from "@/lib/legacy-auth-server";
import { normalizeAdminSubtypes, type AdminSubtypeValue } from "@/lib/admin-subtypes";
import { isHiringDemoModeEnabled } from "@/lib/hiring-demo-mode";

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

function isPrismaTimeout(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  // Postgres statement_timeout → SQLSTATE 57014. Supabase's pooler is prone
  // to these under load; callers should degrade rather than 500.
  return (
    message.includes("57014") ||
    message.includes("canceling statement due to statement timeout") ||
    message.includes("Connection pool timeout") ||
    message.includes("connection timeout")
  );
}

async function runWithTimeoutRetry<T>(op: () => Promise<T>): Promise<T | null> {
  try {
    return await op();
  } catch (error) {
    if (!isPrismaTimeout(error)) throw error;
    try {
      return await op();
    } catch (retryError) {
      if (isPrismaTimeout(retryError)) {
        console.error("[auth] Prisma user lookup timed out twice; treating as signed out.", retryError);
        return null;
      }
      throw retryError;
    }
  }
}

async function resolvePrismaUserForSession(where: {
  supabaseAuthId?: string;
  id?: string;
  email?: string;
}) {
  if (where.supabaseAuthId) {
    const user = await runWithTimeoutRetry(() =>
      prisma.user.findUnique({
        where: { supabaseAuthId: where.supabaseAuthId! },
        select: sessionUserSelect,
      })
    );
    return user?.archivedAt ? null : user;
  }

  if (where.id) {
    const user = await runWithTimeoutRetry(() =>
      prisma.user.findUnique({
        where: { id: where.id! },
        select: sessionUserSelect,
      })
    );
    return user?.archivedAt ? null : user;
  }

  if (where.email) {
    return runWithTimeoutRetry(() =>
      prisma.user.findFirst({
        where: {
          email: where.email!,
          archivedAt: null,
        },
        select: sessionUserSelect,
      })
    );
  }

  return null;
}

/**
 * One Supabase + Prisma resolution per RSC request (layout + page both call getSession).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const demoLegacySession = isHiringDemoModeEnabled()
    ? await getLegacySessionFromCookies()
    : null;
  const supabase = demoLegacySession ? null : await createServerClientOrNull();
  let authUser = null;
  if (!demoLegacySession && supabase) {
    try {
      const { data } = await supabase.auth.getUser();
      authUser = data.user;
    } catch {
      // Stale / invalid refresh token — treat as signed out. Middleware will
      // have already stripped the poison cookies from the response.
      authUser = null;
    }
  }

  let prismaUser = null;
  if (demoLegacySession) {
    prismaUser = await resolvePrismaUserForSession({
      id: demoLegacySession.userId,
      email: demoLegacySession.email,
    });
  } else if (authUser) {
    prismaUser = await resolvePrismaUserForSession({ supabaseAuthId: authUser.id });
  } else {
    const legacySession = await getLegacySessionFromCookies();
    prismaUser = legacySession
      ? await resolvePrismaUserForSession({
          id: legacySession.userId,
          email: legacySession.email,
        })
      : null;
  }

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
  user: SessionUser;
} | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  return { user };
});
