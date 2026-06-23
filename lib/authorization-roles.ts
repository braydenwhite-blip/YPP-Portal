import { z } from "zod";
import { normalizeRoleValue, normalizeRoleValues } from "@/lib/role-utils";
import {
  normalizeAdminSubtypes,
  type AdminSubtypeValue,
} from "@/lib/admin-subtypes";

/**
 * Pure role / subtype helpers — safe for client components and isomorphic modules.
 *
 * Server session guards (`requireOfficer`, `requireSessionUser`, …) live in
 * `@/lib/authorization`, which depends on `next/headers`. Client code and
 * shared permission predicates must import from this module instead.
 */

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
  /** Org-authority spine (optional; preferred over roles/subtypes when present). */
  internalLevel?: number | null;
  ladder?: string | null;
  canonicalTitle?: string | null;
  title?: string | null;
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
