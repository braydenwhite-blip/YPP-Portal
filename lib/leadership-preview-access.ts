/**
 * Who may use the leadership preview stack (People, Actions, Meetings) and the
 * curated officer sidebar during the public-gate ship.
 *
 * Authority is read from the Prisma user row (roles, internalLevel) and mirrored
 * into Supabase `user_metadata` on login so edge middleware stays in sync.
 *
 * Qualifies when ANY of:
 *   - Officer-tier role in Supabase/Prisma (ADMIN, STAFF, CHAPTER_PRESIDENT, HIRING_CHAIR)
 *   - Leadership ladder internal level ≥ Officer (5) on the user row
 *   - Email listed in `PORTAL_LEADERSHIP_PILOT_EMAILS` (comma-separated; Sam / Zach, etc.)
 *
 * Set `PORTAL_LEADERSHIP_PILOT_EMAILS` in Vercel/local env — no hardcoded names.
 */

import { isOfficerTierFromAuth } from "@/lib/org/role-sets";
import { OFFICER_MIN_LEVEL } from "@/lib/org/levels";
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
  roles?: Array<string | null | undefined> | null;
  primaryRole?: string | null;
  internalLevel?: number | null;
};

let cachedPilotEmails: Set<string> | null = null;

/** @internal Test helper — clears the pilot-email parse cache. */
export function resetLeadershipPilotEmailCache(): void {
  cachedPilotEmails = null;
}

/** Pilot users (e.g. Sam, Zach) who are not yet officer-tier in Prisma. */
export function getLeadershipPilotEmails(): ReadonlySet<string> {
  if (cachedPilotEmails) return cachedPilotEmails;
  const raw = (process.env.PORTAL_LEADERSHIP_PILOT_EMAILS ?? "").trim();
  cachedPilotEmails = new Set(
    raw
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
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

/**
 * Server + isomorphic: may this user see/use the leadership preview stack?
 * Uses Prisma session fields when available.
 */
export function canAccessLeadershipPreviewStack(viewer: LeadershipPreviewViewer): boolean {
  if (isLeadershipPilotEmail(viewer.email)) return true;

  if (viewer.internalLevel != null && viewer.internalLevel >= OFFICER_MIN_LEVEL) {
    return true;
  }

  return isOfficerTierFromAuth(viewer.roles, viewer.primaryRole);
}

/**
 * Edge-safe check from Supabase JWT `user_metadata` (+ auth email fallback).
 * Prefer the mirrored `leadershipPreviewAccess` flag when present.
 */
export function isLeadershipPreviewAccessFromAuth(
  metadata: unknown,
  email?: string | null,
): boolean {
  if (isLeadershipPilotEmail(email)) return true;

  const record = metadata as
    | {
        leadershipPreviewAccess?: boolean;
        internalLevel?: number | null;
        roles?: string[];
        primaryRole?: string;
      }
    | null
    | undefined;

  if (record?.leadershipPreviewAccess === true) return true;

  if (
    typeof record?.internalLevel === "number" &&
    record.internalLevel >= OFFICER_MIN_LEVEL
  ) {
    return true;
  }

  return isOfficerTierFromAuth(record?.roles, record?.primaryRole);
}

/** Used when resolving slim nav for a specific primary role + role list. */
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
