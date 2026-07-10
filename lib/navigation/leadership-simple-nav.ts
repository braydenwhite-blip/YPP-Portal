import type { NavRole } from "@/lib/navigation/types";

/**
 * Leadership / hiring sidebar — four destinations only (shipped default).
 * Home · People · Actions · Applicants
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

const NETWORK_APPLICANTS = "/admin/instructor-applicants";
const CHAPTER_APPLICANTS = "/chapter-lead/instructor-applicants";

/** Core pins when the full leadership explorer is on (pre–simple-nav IA). */
export const LEADERSHIP_FULL_CORE_NAV_MAP: Partial<Record<NavRole, string[]>> = {
  ADMIN: ["/", "/people", "/mentorship", "/actions", "/admin"],
  STAFF: ["/", "/people", "/mentorship", "/actions", "/leadership-pathway"],
  HIRING_CHAIR: ["/", "/admin/instructor-applicants", "/people", "/actions", "/meetings"],
  CHAPTER_PRESIDENT: ["/", "/chapter", "/people", "/mentorship", "/actions"],
};

export function leadershipSimpleNavHrefs(primaryRole: NavRole): readonly string[] {
  const applicants =
    primaryRole === "CHAPTER_PRESIDENT" ? CHAPTER_APPLICANTS : NETWORK_APPLICANTS;
  return ["/", "/people", "/actions", applicants];
}

export function isLeadershipFullPortalExplorerEnabled(): boolean {
  return process.env.LEADERSHIP_FULL_PORTAL_EXPLORER === "true";
}

export function shouldApplyLeadershipSimpleNav(
  primaryRole: NavRole,
  leadershipFullPortalExplorer?: boolean,
): boolean {
  if (!LEADERSHIP_SIMPLE_NAV_ROLES.has(primaryRole)) return false;
  const fullExplorer =
    leadershipFullPortalExplorer !== undefined
      ? leadershipFullPortalExplorer
      : isLeadershipFullPortalExplorerEnabled();
  return !fullExplorer;
}
