import { getSessionUser as getSupabaseSessionUser } from "@/lib/auth-supabase";
import { z } from "zod";
import { normalizeRoleValue, normalizeRoleValues } from "@/lib/role-utils";
import {
  normalizeAdminSubtypes,
  type AdminSubtypeValue,
} from "@/lib/admin-subtypes";

// Zod schema for validating user-supplied RoleType values before DB writes.
export const RoleTypeSchema = z.enum([
  "ADMIN",
  "INSTRUCTOR",
  "STUDENT",
  "MENTOR",
  "CHAPTER_PRESIDENT",
  "STAFF",
  "PARENT",
  "APPLICANT",
  "HIRING_CHAIR",
]);

/** Parse and validate a single role string from user input. Throws on invalid value. */
export function parseRoleType(value: unknown): string {
  return normalizeRoleValue(RoleTypeSchema.parse(value)) ?? "STUDENT";
}

/** Parse and validate an array of role strings from user input. Throws on any invalid value. */
export function parseRoleTypes(values: unknown[]): string[] {
  return normalizeRoleValues(values.map((v) => RoleTypeSchema.parse(v)));
}

type SessionRoleEntry = string | { role?: string } | null | undefined;

export type SessionUser = {
  id: string;
  roles: string[];
  primaryRole: string;
  adminSubtypes: AdminSubtypeValue[];
};

export function normalizeRoleSet(
  roles: SessionRoleEntry[] | undefined | null,
  primaryRole?: string | null
): Set<string> {
  const roleSet = new Set<string>();

  const normalizedPrimaryRole = normalizeRoleValue(primaryRole);
  if (normalizedPrimaryRole) {
    roleSet.add(normalizedPrimaryRole);
  }

  if (!Array.isArray(roles)) {
    return roleSet;
  }

  for (const role of roles) {
    if (typeof role === "string" && role.trim()) {
      const normalizedRole = normalizeRoleValue(role);
      if (normalizedRole) {
        roleSet.add(normalizedRole);
      }
      continue;
    }

    if (
      role &&
      typeof role === "object" &&
      typeof role.role === "string" &&
      role.role.trim()
    ) {
      const normalizedRole = normalizeRoleValue(role.role);
      if (normalizedRole) {
        roleSet.add(normalizedRole);
      }
    }
  }

  return roleSet;
}

export function normalizeRoleList(
  roles: SessionRoleEntry[] | undefined | null,
  primaryRole?: string | null
): string[] {
  return Array.from(normalizeRoleSet(roles, primaryRole));
}

export function hasRole(
  roles: SessionRoleEntry[] | undefined | null,
  role: string,
  primaryRole?: string | null
): boolean {
  return normalizeRoleSet(roles, primaryRole).has(role);
}

export function hasAnyRole(
  roles: SessionRoleEntry[] | undefined | null,
  requiredRoles: string[],
  primaryRole?: string | null
): boolean {
  if (requiredRoles.length === 0) return false;
  const roleSet = normalizeRoleSet(roles, primaryRole);
  return requiredRoles.some((role) => roleSet.has(role));
}

export function hasAdminSubtype(
  adminSubtypes: Array<string | null | undefined> | undefined | null,
  expectedSubtype: AdminSubtypeValue
): boolean {
  return normalizeAdminSubtypes(adminSubtypes ?? []).includes(expectedSubtype);
}

export function hasAnyAdminSubtype(
  adminSubtypes: Array<string | null | undefined> | undefined | null,
  requiredSubtypes: readonly AdminSubtypeValue[]
): boolean {
  const subtypeSet = new Set(normalizeAdminSubtypes(adminSubtypes ?? []));
  return requiredSubtypes.some((subtype) => subtypeSet.has(subtype));
}

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
  requiredSubtypes: readonly AdminSubtypeValue[]
): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  if (!hasAnyAdminSubtype(sessionUser.adminSubtypes, requiredSubtypes)) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}

/**
 * People Strategy tiers, mapped onto the real roles/subtypes in this codebase.
 * See INTEGRATION_MAP.md → "Role tiers" for the full table.
 */

/** Roles considered "Officer-tier and above" for the People Strategy layer. */
export const OFFICER_TIER_ROLES = [
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "HIRING_CHAIR",
] as const;

/**
 * CPO guard. The Co-President & Chief People Officer is modelled as the
 * `CPO` AdminSubtype. The Board has no dedicated role in this codebase, so the
 * org-owner tier (`SUPER_ADMIN`) stands in for "Board" — it passes too.
 *
 * Used by later People Strategy phases (People Dashboard, succession flags).
 */
export async function requireCPO(): Promise<SessionUser> {
  const sessionUser = await requireSessionUser();
  const isAdmin = hasRole(sessionUser.roles, "ADMIN", sessionUser.primaryRole);
  if (
    !isAdmin ||
    !hasAnyAdminSubtype(sessionUser.adminSubtypes, ["CPO", "SUPER_ADMIN"])
  ) {
    throw new Error("Unauthorized");
  }
  return sessionUser;
}

/**
 * Board guard. The Board has no dedicated role in this codebase; the org-owner
 * tier (`SUPER_ADMIN`) stands in for "Board" (see INTEGRATION_MAP.md → Part B).
 * Passes ONLY for ADMIN users with the `SUPER_ADMIN` subtype — a plain CPO
 * (AdminSubtype `CPO` without `SUPER_ADMIN`) does NOT pass, so Board-only
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
 * Hiring Chairs, and any ADMIN (which includes Sr. Leadership, the CPO, and the
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
