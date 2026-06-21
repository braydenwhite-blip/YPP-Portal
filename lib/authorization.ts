import { getSessionUser as getSupabaseSessionUser } from "@/lib/auth-supabase";
import { normalizeAdminSubtypes } from "@/lib/admin-subtypes";

export {
  RoleTypeSchema,
  parseRoleType,
  parseRoleTypes,
  normalizeRoleSet,
  normalizeRoleList,
  hasRole,
  hasAnyRole,
  hasAdminSubtype,
  hasAnyAdminSubtype,
  OFFICER_TIER_ROLES,
  type SessionUser,
} from "@/lib/authorization-roles";

import {
  hasAnyAdminSubtype,
  hasAdminSubtype,
  hasAnyRole,
  hasRole,
  OFFICER_TIER_ROLES,
  type SessionUser,
} from "@/lib/authorization-roles";

/**
 * Server-side session guards. Import role helpers from `@/lib/authorization-roles`
 * in client components and isomorphic permission modules.
 */

export async function requireSessionUser(): Promise<SessionUser> {
  const user = await getSupabaseSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }

  return {
    id: user.id,
    roles: user.roles,
    primaryRole: user.primaryRole,
    adminSubtypes: normalizeAdminSubtypes(user.adminSubtypes ?? []),
  };
}

export async function requireAnyRole(requiredRoles: string[]): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  if (!hasAnyRole(sessionUser.roles, requiredRoles)) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}

export async function requireAnyAdminSubtype(
  requiredSubtypes: Parameters<typeof hasAnyAdminSubtype>[1]
): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  if (!hasAnyAdminSubtype(sessionUser.adminSubtypes, requiredSubtypes)) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}

/**
 * Leadership guard. The Co-President & Chief People Officer is modelled as the
 * `Leadership` AdminSubtype. The Board has no dedicated role in this codebase, so the
 * org-owner tier (`SUPER_ADMIN`) stands in for "Board" — it passes too.
 *
 * Used by later People Strategy phases (People Dashboard, succession flags).
 */
export async function requireLeadership(): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  const isAdmin = hasRole(sessionUser.roles, "ADMIN", sessionUser.primaryRole);
  if (
    !isAdmin ||
    !hasAnyAdminSubtype(sessionUser.adminSubtypes, ["LEADERSHIP", "SUPER_ADMIN"])
  ) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}

/**
 * Board guard. The Board has no dedicated role in this codebase; the org-owner
 * tier (`SUPER_ADMIN`) stands in for "Board" (see INTEGRATION_MAP.md → Part B).
 * Passes ONLY for ADMIN users with the `SUPER_ADMIN` subtype — a plain Leadership
 * (AdminSubtype `Leadership` without `SUPER_ADMIN`) does NOT pass, so Board-only
 * surfaces (the escalation roll-up list) stay invisible to non-Board users.
 */
export async function requireBoard(): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  const isAdmin = hasRole(sessionUser.roles, "ADMIN", sessionUser.primaryRole);
  if (!isAdmin || !hasAdminSubtype(sessionUser.adminSubtypes, "SUPER_ADMIN")) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}

/**
 * Officer guard. Passes for Officer-tier and above: STAFF, Chapter Presidents,
 * Hiring Chairs, and any ADMIN (which includes Sr. Leadership, the Leadership, and the
 * Board/SUPER_ADMIN since those all carry the ADMIN role).
 *
 * Used by later People Strategy phases (Action Items, Officer Meetings,
 * My Actions / All Actions views).
 */
export async function requireOfficer(): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  if (!hasAnyRole(sessionUser.roles, [...OFFICER_TIER_ROLES])) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}

/**
 * Journey Editor access. ADMIN or CONTENT_ADMIN can edit and publish;
 * STAFF can view in read-only mode. Anyone else throws Unauthorized.
 *
 * Used by `app/(app)/admin/journeys/**` routes and
 * `lib/journey-editor/actions.ts` server actions.
 */
export async function requireJourneyEditor(): Promise<
  SessionUser & { canPublish: boolean }
> {
  const sessionUser = await requireSessionUser();
  const isAdmin = hasRole(sessionUser.roles, "ADMIN");
  const isContentAdmin = hasAdminSubtype(sessionUser.adminSubtypes, "CONTENT_ADMIN");
  const isStaff = hasRole(sessionUser.roles, "STAFF");

  if (!isAdmin && !isContentAdmin && !isStaff) {
    throw new Error("Unauthorized");
  }

  return { ...sessionUser, canPublish: isAdmin || isContentAdmin };
}
