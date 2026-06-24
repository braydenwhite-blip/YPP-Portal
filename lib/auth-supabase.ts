import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
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
  /** Free-text/canonical human title + org-ladder spine for label + tier resolution. */
  title?: string | null;
  internalLevel?: number | null;
  ladder?: string | null;
  canonicalTitle?: string | null;
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
  // Org-authority spine + stored title — drive the displayed ladder title and
  // the level-based authorization tier (see lib/org/levels.ts, lib/user-title.ts).
  title: true,
  internalLevel: true,
  ladder: true,
  canonicalTitle: true,
  roles: { select: { role: true } },
  adminSubtypes: { select: { subtype: true } },
  awards: {
    select: { type: true },
    orderBy: { awardedAt: "desc" },
    take: 24,
  },
} as const;

function isRecoverablePrismaTimeout(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  // Postgres statement_timeout (57014) and connection pool timeout (P2024).
  // We degrade to "signed out" rather than 500 the page, but we do NOT
  // retry: the user is already waiting on a struggling database, and a
  // retry just doubles their wait for the same likely-failing outcome.
  // Downstream requests will pick up the session once the pool recovers.
  return (
    message.includes("57014") ||
    message.includes("canceling statement due to statement timeout") ||
    message.includes("P2024") ||
    message.includes("Connection pool timeout") ||
    message.includes("connection timeout")
  );
}

async function runSessionQuery<T>(op: () => Promise<T>): Promise<T | null> {
  try {
    return await op();
  } catch (error) {
    if (isRecoverablePrismaTimeout(error)) {
      console.error("[auth] Prisma user lookup timed out; treating as signed out.", error);
      return null;
    }
    throw error;
  }
}

async function resolvePrismaUserForSession(where: {
  supabaseAuthId?: string;
  id?: string;
  email?: string;
}) {
  if (where.supabaseAuthId) {
    const user = await runSessionQuery(() =>
      prisma.user.findUnique({
        where: { supabaseAuthId: where.supabaseAuthId! },
        select: sessionUserSelect,
      })
    );
    return user?.archivedAt ? null : user;
  }

  if (where.id) {
    const user = await runSessionQuery(() =>
      prisma.user.findUnique({
        where: { id: where.id! },
        select: sessionUserSelect,
      })
    );
    return user?.archivedAt ? null : user;
  }

  if (where.email) {
    return runSessionQuery(() =>
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

  const headerStore = await headers();
  const middlewareSupabaseAuthId = headerStore.get("x-supabase-auth-id");
  const middlewareSupabaseEmail = headerStore.get("x-supabase-auth-email");
  const middlewareLegacyUserId = headerStore.get("x-legacy-user-id");
  const middlewareLegacyEmail = headerStore.get("x-legacy-auth-email");

  let prismaUser = null;

  if (demoLegacySession) {
    prismaUser = await resolvePrismaUserForSession({
      id: demoLegacySession.userId,
      email: demoLegacySession.email,
    });
  } else if (middlewareLegacyUserId) {
    prismaUser = await resolvePrismaUserForSession({
      id: middlewareLegacyUserId,
      email: middlewareLegacyEmail ?? undefined,
    });
  } else if (middlewareSupabaseAuthId) {
    // Middleware already validated the Supabase session — skip a second
    // network round-trip to supabase.auth.getUser() on every RSC render.
    prismaUser = await resolvePrismaUserForSession({
      supabaseAuthId: middlewareSupabaseAuthId,
    });

    if (!prismaUser && middlewareSupabaseEmail) {
      const byEmail = await resolvePrismaUserForSession({ email: middlewareSupabaseEmail });
      if (byEmail) {
        prismaUser = byEmail;
        try {
          await prisma.user.update({
            where: { id: byEmail.id },
            data: { supabaseAuthId: middlewareSupabaseAuthId },
          });
        } catch (error) {
          console.warn("[auth] Could not back-fill supabaseAuthId.", error);
        }
      }
    }
  } else {
    const supabase = await createServerClientOrNull();
    let authUser = null;
    if (supabase) {
      try {
        const { data } = await supabase.auth.getUser();
        authUser = data.user;
      } catch {
        authUser = null;
      }
    }

    if (authUser) {
      prismaUser = await resolvePrismaUserForSession({ supabaseAuthId: authUser.id });

      if (!prismaUser && authUser.email) {
        const byEmail = await resolvePrismaUserForSession({ email: authUser.email });
        if (byEmail) {
          prismaUser = byEmail;
          try {
            await prisma.user.update({
              where: { id: byEmail.id },
              data: { supabaseAuthId: authUser.id },
            });
          } catch (error) {
            console.warn("[auth] Could not back-fill supabaseAuthId.", error);
          }
        }
      }
    } else {
      const legacySession = await getLegacySessionFromCookies();
      prismaUser = legacySession
        ? await resolvePrismaUserForSession({
            id: legacySession.userId,
            email: legacySession.email,
          })
        : null;
    }
  }

  if (!prismaUser) return null;

  const resolvedUser = prismaUser;
  const roles = normalizeRoleValues(resolvedUser.roles.map((r) => r.role));
  // The user's actual `roles` are the source of truth for the highest
  // privilege they hold. An ADMIN must always be treated as an admin across
  // the UI (sidebar, role label, and default dashboard) even when the stored
  // `primaryRole` column is a stale lower role — e.g. an account created as a
  // STUDENT and later promoted to ADMIN without that column being updated.
  // SUPER_ADMIN / Leadership / Board all carry the ADMIN role, so a single ADMIN
  // check covers every admin tier here.
  const primaryRole = roles.includes("ADMIN")
    ? "ADMIN"
    : normalizeRoleValue(resolvedUser.primaryRole) ?? roles[0] ?? "STUDENT";
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
    title: resolvedUser.title,
    internalLevel: resolvedUser.internalLevel,
    ladder: resolvedUser.ladder,
    canonicalTitle: resolvedUser.canonicalTitle,
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
