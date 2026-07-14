import type { NavRole } from "@/lib/navigation/types";

/**
 * Leadership / hiring sidebar — shipped default.
 * Home · Mentorship · Actions · Applicants
 * (Hiring Chair keeps People/directory instead of Mentorship.)
 *
 * Set `LEADERSHIP_FULL_PORTAL_EXPLORER=true` locally to unlock the full
 * officer / chapter-president catalog for testing.
 */
export const LEADERSHIP_SIMPLE_NAV_ROLES: ReadonlySet<NavRole> = new Set<NavRole>([
  "ADMIN",
  "STAFF",
  "HIRING_CHAIR",
  "CHAPTER_PRESIDENT",
]);

/** Roles that get Mentorship in the simple leadership sidebar. */
const MENTORSHIP_SIMPLE_NAV_ROLES: ReadonlySet<NavRole> = new Set<NavRole>([
  "ADMIN",
  "STAFF",
  "CHAPTER_PRESIDENT",
]);

const NETWORK_APPLICANTS = "/admin/instructor-applicants";
const CHAPTER_APPLICANTS = "/chapter-lead/instructor-applicants";

/** Core pins when the full leadership explorer is on (pre–simple-nav IA). */
export const LEADERSHIP_FULL_CORE_NAV_MAP: Partial<Record<NavRole, string[]>> = {
  ADMIN: ["/", "/mentorship", "/actions", "/admin"],
  STAFF: ["/", "/mentorship", "/actions", "/leadership-pathway"],
  HIRING_CHAIR: ["/", "/admin/instructor-applicants", "/people", "/actions", "/meetings"],
  CHAPTER_PRESIDENT: ["/", "/chapter", "/mentorship", "/actions"],
};

export function leadershipSimpleNavHrefs(primaryRole: NavRole): readonly string[] {
  const applicants =
    primaryRole === "CHAPTER_PRESIDENT" ? CHAPTER_APPLICANTS : NETWORK_APPLICANTS;
  if (MENTORSHIP_SIMPLE_NAV_ROLES.has(primaryRole)) {
    return ["/", "/mentorship", "/actions", applicants];
  }
  return ["/", "/people", "/actions", applicants];
}

export function isLeadershipFullPortalExplorerEnabled(): boolean {
  return process.env.LEADERSHIP_FULL_PORTAL_EXPLORER === "true";
}

export function shouldApplyLeadershipSimpleNav(
  primaryRole: NavRole,
  leadershipFullPortalExplorer?: boolean
): boolean {
  if (!LEADERSHIP_SIMPLE_NAV_ROLES.has(primaryRole)) return false;
  if (leadershipFullPortalExplorer === true) return false;
  if (isLeadershipFullPortalExplorerEnabled()) return false;
  return true;
}
