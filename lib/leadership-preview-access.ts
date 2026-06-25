/**
 * Who may use the leadership preview stack (People, Actions, Meetings) and the
 * curated officer sidebar during the public-gate ship.
 *
 * Authority is read from the Prisma user row (roles, internalLevel, name, email)
 * and mirrored into Supabase `user_metadata` on login so edge middleware stays
 * in sync.
 *
 * Qualifies when ANY of:
 *   - Email on the built-in leadership roster or `PORTAL_LEADERSHIP_PILOT_EMAILS`
 *   - First name Sam or Zach on the user record (mentor pilots)
 *   - Leadership ladder internal level ≥ Officer (5)
 *   - ADMIN or STAFF role (platform officers — not hiring chair / CP alone)
 *
 * Extend the roster in `lib/leadership-preview-roster.ts` or via env pilots.
 */

import { OFFICER_MIN_LEVEL } from "@/lib/org/levels";
import { normalizeRoleValue } from "@/lib/role-utils";
import {
  isLeadershipRosterEmail,
  isLeadershipRosterName,
  LEADERSHIP_PREVIEW_ROSTER_EMAILS,
} from "@/lib/leadership-preview-roster";
import type { NavRole } from "@/lib/navigation/types";

export const LEADERSHIP_PREVIEW_PATH_PREFIXES = [
  "/people",
  "/actions",
  "/meetings",
  "/operations",
  "/command-center",
  "/work",
  "/help-agent",
] as const;

export type LeadershipPreviewViewer = {
  id?: string;
  email?: string | null;
  name?: string | null;
  roles?: Array<string | null | undefined> | null;
  primaryRole?: string | null;
  internalLevel?: number | null;
};

let cachedPilotEmails: Set<string> | null = null;

/** @internal Test helper — clears the pilot-email parse cache. */
export function resetLeadershipPilotEmailCache(): void {
  cachedPilotEmails = null;
}

/** Extra pilot emails from env (comma-separated). Merged with the built-in roster. */
export function getLeadershipPilotEmails(): ReadonlySet<string> {
  if (cachedPilotEmails) return cachedPilotEmails;
  const fromEnv = (process.env.PORTAL_LEADERSHIP_PILOT_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  cachedPilotEmails = new Set([...LEADERSHIP_PREVIEW_ROSTER_EMAILS, ...fromEnv]);
  return cachedPilotEmails;
}

export function isLeadershipPilotEmail(email: string | null | undefined): boolean {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  return getLeadershipPilotEmails().has(normalized);
}

export function isLeadershipPreviewPath(pathname: string): boolean {
  return LEADERSHIP_PREVIEW_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasLeadershipPlatformOfficerRole(viewer: LeadershipPreviewViewer): boolean {
  const roles = viewer.roles ?? [];
  const primary = normalizeRoleValue(viewer.primaryRole);
  const want = new Set(["ADMIN", "STAFF"]);
  if (primary && want.has(primary)) return true;
  return roles.some((role) => {
    const normalized = normalizeRoleValue(role);
    return normalized != null && want.has(normalized);
  });
}

/**
 * Server + isomorphic: may this user see/use the leadership preview stack?
 */
export function canAccessLeadershipPreviewStack(viewer: LeadershipPreviewViewer): boolean {
  if (isLeadershipPilotEmail(viewer.email) || isLeadershipRosterEmail(viewer.email)) {
    return true;
  }
  if (isLeadershipRosterName(viewer.name)) return true;

  if (viewer.internalLevel != null && viewer.internalLevel >= OFFICER_MIN_LEVEL) {
    return true;
  }

  if (hasLeadershipPlatformOfficerRole(viewer)) return true;

  // Chapter presidents / hiring chairs with officer-tier bypass elsewhere but not
  // the leadership preview stack unless rostered or ladder-qualified above.
  return false;
}

/**
 * Edge-safe check from Supabase JWT `user_metadata` (+ auth email fallback).
 */
export function isLeadershipPreviewAccessFromAuth(
  metadata: unknown,
  email?: string | null,
): boolean {
  const record = metadata as
    | {
        leadershipPreviewAccess?: boolean;
        internalLevel?: number | null;
        roles?: string[];
        primaryRole?: string;
        name?: string | null;
      }
    | null
    | undefined;

  return canAccessLeadershipPreviewStack({
    email,
    name: record?.name,
    roles: record?.roles,
    primaryRole: record?.primaryRole,
    internalLevel: record?.internalLevel,
  });
}

export function shouldApplyLeadershipPreviewNav(
  primaryRole: NavRole,
  roles: NavRole[],
  viewer: LeadershipPreviewViewer = {},
): boolean {
  return canAccessLeadershipPreviewStack({
    ...viewer,
    primaryRole,
    roles,
  });
}

export function computeLeadershipPreviewAccessFlag(viewer: LeadershipPreviewViewer): boolean {
  return canAccessLeadershipPreviewStack(viewer);
}

export function isOfficerTierOrLeadershipPilot(viewer: LeadershipPreviewViewer): boolean {
  return canAccessLeadershipPreviewStack(viewer);
}
