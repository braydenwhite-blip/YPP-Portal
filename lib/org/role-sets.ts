/**
 * Canonical role-set constants + spine-derived tier predicates.
 *
 * SINGLE source of truth for the legacy role-string groupings that used to be
 * copy-pasted across server, client, and edge modules (officer tier, reviewer
 * roles, instructor surfaces, …). PURE and EDGE-SAFE: it imports only pure
 * helpers (`role-utils`, `admin-subtypes` — which itself is type-only on
 * `@prisma/client`) and the pure org spine (`levels.ts`). It must NEVER import
 * `auth-supabase`, `prisma`, or `next`, so the client app-shell and the edge
 * middleware (`proxy.ts`) can import it without pulling in server code.
 *
 * The tier predicates bridge the two authority systems: each passes when the
 * canonical `internalLevel` clears the bar OR — during the backfill window, when
 * a user's level is still null — the user carries a legacy role in the matching
 * set. The OR is deliberate ("legacy never loses access"); once every row is
 * backfilled the level check is authoritative. See
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md.
 */

import { normalizeRoleValue } from "@/lib/role-utils";
import { hasAnyAdminSubtype } from "@/lib/admin-subtypes";
import {
  OFFICER_MIN_LEVEL,
  TOP_INTERNAL_LEVEL,
  LEAD_MIN_LEVEL,
  type PersonAuthority,
} from "@/lib/org/levels";

// ── Canonical role-set constants ───────────────────────────────────────────
// These are the byte-for-byte copies of the literals previously scattered
// across the codebase. Every other module re-exports or imports from here.

/** Officer-tier and above. Any ADMIN-tier user carries ADMIN and passes. */
export const OFFICER_TIER_ROLES = [
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "HIRING_CHAIR",
] as const;

/** Who can reach the (legacy) Leadership Action Center. */
export const LEADERSHIP_ACTION_CENTER_ROLES = ["ADMIN", "STAFF"] as const;

/** Who works the hiring/application review pipeline. */
export const APPLICATION_REVIEWER_ROLES = [
  "ADMIN",
  "STAFF",
  "HIRING_CHAIR",
  "CHAPTER_PRESIDENT",
] as const;

/** Roles that get the instructor surfaces (workspace, lesson plans, etc.). */
export const INSTRUCTOR_SURFACE_ROLES = [
  "INSTRUCTOR",
  "ADMIN",
  "CHAPTER_PRESIDENT",
] as const;

/** Roles treated as approved instructors for the training academy. */
export const INSTRUCTOR_TRAINING_ROLES = [
  "ADMIN",
  "CHAPTER_PRESIDENT",
  "INSTRUCTOR",
] as const;

/** Roles offered the People Strategy Operations Hub (page is itself role-aware). */
export const OPERATIONS_HUB_ROLES = [
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
  "HIRING_CHAIR",
  "INSTRUCTOR",
  "MENTOR",
  "STUDENT",
] as const;

// ── Membership helper (pure, normalized) ───────────────────────────────────

/** True when `primaryRole` or any of `roles` (normalized) is in `set`. */
export function rolesIncludeAny(
  roles: Array<string | null | undefined> | null | undefined,
  primaryRole: string | null | undefined,
  set: readonly string[]
): boolean {
  const want = new Set<string>(set);
  const primary = normalizeRoleValue(primaryRole);
  if (primary && want.has(primary)) return true;
  if (!Array.isArray(roles)) return false;
  return roles.some((role) => {
    const normalized = normalizeRoleValue(role);
    return normalized != null && want.has(normalized);
  });
}

// ── Spine-derived tier predicates ──────────────────────────────────────────

export interface AuthorityTierInput {
  /** Resolved canonical authority (preferred when available). */
  authority?: PersonAuthority | null;
  /** Legacy session roles (compatibility fallback while levels backfill). */
  roles?: Array<string | null | undefined> | null;
  primaryRole?: string | null;
  adminSubtypes?: Array<string | null | undefined> | null;
}

/** Officer-tier and above: internal level ≥ 5, OR a legacy officer-tier role. */
export function isOfficerTierAuthority(input: AuthorityTierInput): boolean {
  const level = input.authority?.internalLevel ?? null;
  if (level != null && level >= OFFICER_MIN_LEVEL) return true;
  return rolesIncludeAny(input.roles, input.primaryRole, OFFICER_TIER_ROLES);
}

/** Board: internal level ≥ 7, OR the SUPER_ADMIN subtype (stands in for Board). */
export function isBoardAuthority(input: AuthorityTierInput): boolean {
  const level = input.authority?.internalLevel ?? null;
  if (level != null && level >= TOP_INTERNAL_LEVEL) return true;
  return hasAnyAdminSubtype(input.adminSubtypes ?? [], ["SUPER_ADMIN"]);
}

/** Leadership or Board: internal level ≥ 5, OR a LEADERSHIP/SUPER_ADMIN subtype. */
export function isLeadershipAuthority(input: AuthorityTierInput): boolean {
  const level = input.authority?.internalLevel ?? null;
  if (level != null && level >= OFFICER_MIN_LEVEL) return true;
  return hasAnyAdminSubtype(input.adminSubtypes ?? [], ["LEADERSHIP", "SUPER_ADMIN"]);
}

/** Lead Instructor and above on the instruction ladder (internal level ≥ 3). */
export function isInstructionLeadAuthority(input: AuthorityTierInput): boolean {
  const authority = input.authority;
  return Boolean(
    authority &&
      authority.ladder === "INSTRUCTION" &&
      authority.internalLevel != null &&
      authority.internalLevel >= LEAD_MIN_LEVEL
  );
}

/** True when the user belongs to the instructor surfaces (legacy role check). */
export function isInstructorSurface(
  roles: Array<string | null | undefined> | null | undefined,
  primaryRole?: string | null
): boolean {
  return rolesIncludeAny(roles, primaryRole, INSTRUCTOR_SURFACE_ROLES);
}

/**
 * Edge-safe officer check for middleware (Supabase `user_metadata.roles`).
 * Accepts loosely-typed input and upper-cases before comparing, matching the
 * raw shape the edge runtime sees. Moved here from `lib/public-gate.ts` so the
 * officer-tier set lives in exactly one place; `public-gate` re-exports it.
 */
export function isOfficerTierFromAuth(
  roles: unknown,
  primaryRole?: unknown
): boolean {
  const officerSet = new Set<string>(OFFICER_TIER_ROLES);
  const roleSet = new Set<string>();
  if (typeof primaryRole === "string" && primaryRole.trim()) {
    roleSet.add(primaryRole.trim().toUpperCase());
  }
  if (Array.isArray(roles)) {
    for (const role of roles) {
      if (typeof role === "string" && role.trim()) {
        roleSet.add(role.trim().toUpperCase());
      }
    }
  }
  for (const role of roleSet) {
    if (officerSet.has(role)) return true;
  }
  return false;
}
