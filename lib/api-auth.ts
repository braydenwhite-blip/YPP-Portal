/**
 * Centralized API-route auth. Today ~128 app/api/**\/route.ts files each
 * re-check `getSessionUser`/roles inline (see CLAUDE.md authorization audit) —
 * that's a per-file discipline problem, not a per-route one. `withApiAuth`
 * gives route handlers one shared place to require a session + role/subtype,
 * so a route can't ship with a missing or inconsistent check.
 *
 * This does not replace `lib/authorization.ts` (used by server actions) —
 * it's the API-route equivalent, returning a Response instead of throwing.
 */

import "server-only";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-supabase";
import { hasAnyRole, hasAnyAdminSubtype, type SessionUser } from "@/lib/authorization-roles";
import type { AdminSubtypeValue } from "@/lib/admin-subtypes";

export interface ApiAuthOptions {
  /** Passes if the session user has any of these primary/extra roles. */
  roles?: string[];
  /** Passes if the session user has any of these admin subtypes. */
  adminSubtypes?: AdminSubtypeValue[];
  /** Passes if the session user's internalLevel is at least this value. */
  minInternalLevel?: number;
}

/**
 * Load the session user and check it against `options`. Returns the user on
 * success, or a ready-to-return `NextResponse` (401/403) on failure — callers
 * check `"response" in result`.
 */
export async function requireApiSession(
  options: ApiAuthOptions = {}
): Promise<{ user: SessionUser } | { response: NextResponse }> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const user = session.user as SessionUser;
  const { roles, adminSubtypes, minInternalLevel } = options;
  const hasNoRequirement = !roles && !adminSubtypes && minInternalLevel == null;

  if (hasNoRequirement) return { user };

  const passesRole = roles ? hasAnyRole(user.roles, roles, user.primaryRole) : false;
  const passesSubtype = adminSubtypes ? hasAnyAdminSubtype(user.adminSubtypes, adminSubtypes) : false;
  const passesLevel =
    minInternalLevel != null ? (user.internalLevel ?? -1) >= minInternalLevel : false;

  if (passesRole || passesSubtype || passesLevel) return { user };

  return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
}

/** Wrap a route handler so it never runs without the required session/role check. */
export function withApiAuth(
  options: ApiAuthOptions,
  handler: (req: Request, ctx: { user: SessionUser }) => Promise<Response> | Response
) {
  return async (req: Request) => {
    const result = await requireApiSession(options);
    if ("response" in result) return result.response;
    return handler(req, { user: result.user });
  };
}
