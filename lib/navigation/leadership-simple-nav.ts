import type { NavRole } from "@/lib/navigation/types";

/**
 * Leadership / hiring sidebar — shipped default.
 * Home · Mentorship · Actions · Applicants (role-specific board)
 * Admins only: Applicants (`/admin/applicants`) + Users (`/admin/users`).
 * Chapter Presidents get their own fixed 4-page set instead.
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

/** Admin-only network applicants front door. */
const ADMIN_APPLICANTS = "/admin/applicants";
/** Staff / hiring-chair board (same underlying page, different nav entry). */
const NETWORK_APPLICANTS = "/admin/instructor-applicants";
const CHAPTER_APPLICANTS = "/chapter-lead/instructor-applicants";
const ADMIN_USERS = "/admin/users";

/** Core pins when the full leadership explorer is on (pre-simple-nav IA). */
export const LEADERSHIP_FULL_CORE_NAV_MAP: Partial<Record<NavRole, string[]>> = {
  ADMIN: ["/", "/mentorship", "/actions", ADMIN_APPLICANTS, ADMIN_USERS],
  STAFF: ["/", "/mentorship", "/actions", "/leadership-pathway"],
  HIRING_CHAIR: ["/", NETWORK_APPLICANTS, "/people", "/actions", "/meetings"],
  CHAPTER_PRESIDENT: ["/chapter", "/chapter/onboarding", "/chapter/resources", "/chapter/recruiting"],
};

export function leadershipSimpleNavHrefs(primaryRole: NavRole): readonly string[] {
  if (primaryRole === "ADMIN") {
    return ["/", "/mentorship", "/actions", ADMIN_APPLICANTS, ADMIN_USERS];
  }
  if (primaryRole === "CHAPTER_PRESIDENT") {
    return ["/chapter", "/chapter/onboarding", "/chapter/resources", "/chapter/recruiting"];
  }
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
