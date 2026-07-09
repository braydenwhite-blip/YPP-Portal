/**
 * Authorization helpers for the Weekly Meetings module.
 *
 * Thin wrappers over lib/authorization so routes + server actions share one
 * definition of "can run meetings" / "can configure teams" / "can edit this
 * impact entry".
 */
import "server-only";

import {
  requireLeadership,
  requireSessionUser,
  type SessionUser,
} from "@/lib/authorization";
import { hasAnyRole, hasRole } from "@/lib/authorization-roles";
import { OFFICER_TIER_ROLES } from "@/lib/org/role-sets";

export type Viewer = SessionUser;

/** Officer-tier (ADMIN / STAFF / CHAPTER_PRESIDENT / HIRING_CHAIR). */
export function isOfficer(viewer: Viewer): boolean {
  return hasAnyRole(viewer.roles, [...OFFICER_TIER_ROLES], viewer.primaryRole);
}

/** Network admin — required to configure Teams. */
export function isAdmin(viewer: Viewer): boolean {
  return hasRole(viewer.roles, "ADMIN", viewer.primaryRole);
}

/** Whoever may run/edit meetings (Sr. Leadership / Board only). */
export async function requireMeetingRunner(): Promise<Viewer> {
  return requireLeadership();
}

/** Team configuration is admin-only. */
export async function requireTeamAdmin(): Promise<Viewer> {
  const viewer = await requireSessionUser();
  if (!isAdmin(viewer)) throw new Error("Unauthorized");
  return viewer;
}

/** Any signed-in user may fill their own Weekly Impact form. */
export async function requireImpactAuthor(): Promise<Viewer> {
  return requireSessionUser();
}

/** A person edits their own entry; admins may edit anyone's. */
export function canEditImpactEntry(viewer: Viewer, entryUserId: string): boolean {
  return viewer.id === entryUserId || isAdmin(viewer);
}
