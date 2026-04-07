import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
  "CHAPTER_PRESIDENT",
  "STAFF",
  "PARENT",
  "APPLICANT",
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
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const roleSet = normalizeRoleSet(session.user.roles as SessionRoleEntry[], session.user.primaryRole ?? null);
  const roles = Array.from(roleSet);
  const primaryRole = normalizeRoleValue(session.user.primaryRole ?? null) ?? roles[0] ?? "STUDENT";

  return {
    id: session.user.id,
    roles,
    primaryRole,
    adminSubtypes: normalizeAdminSubtypes((session.user as any).adminSubtypes ?? []),
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
