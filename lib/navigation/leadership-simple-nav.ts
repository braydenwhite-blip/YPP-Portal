import type { NavRole } from "@/lib/navigation/types";

/**
 * Leadership / hiring sidebar — shipped default.
 * Home · Actions · Applicants · Chapters · Mentorship · Users (admins).
 * Staff: Home · Mentorship · Actions · Applicants · Chapters.
 * Chapter Presidents get their own fixed set:
 * Dashboard · My Chapter · Classes · Analytics · Actions · Mentorship.
 * (Partners, student invites, and instructor applicants are reached from Dashboard + My Chapter.
 * Hiring Chair keeps People/directory instead of Mentorship.)
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
const ADMIN_USERS = "/admin/users";

/** Core pins when the full leadership explorer is on (pre-simple-nav IA). */
export const LEADERSHIP_FULL_CORE_NAV_MAP: Partial<Record<NavRole, string[]>> = {
  ADMIN: ["/", "/actions", ADMIN_APPLICANTS, "/admin/chapters", "/mentorship", ADMIN_USERS],
  STAFF: ["/", "/mentorship", "/actions", "/leadership-pathway", "/admin/chapters"],
  HIRING_CHAIR: ["/", NETWORK_APPLICANTS, "/people", "/actions", "/meetings"],
  CHAPTER_PRESIDENT: [
    "/chapter",
    "/chapter/hub",
    "/partners",
    "/chapter/instructors",
    "/chapter/impact",
    "/mentorship",
  ],
};

export function leadershipSimpleNavHrefs(primaryRole: NavRole): readonly string[] {
  if (primaryRole === "ADMIN") {
    return ["/", "/actions", ADMIN_APPLICANTS, "/admin/chapters", "/mentorship", ADMIN_USERS];
  }
  if (primaryRole === "CHAPTER_PRESIDENT") {
    return [
      "/chapter",
      "/chapter/hub",
      "/chapter/instructors",
      "/chapter/impact",
      "/actions",
      "/mentorship",
    ];
  }
  const applicants = NETWORK_APPLICANTS;
  if (primaryRole === "STAFF") {
    return ["/", "/mentorship", "/actions", applicants, "/admin/chapters"];
  }
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
