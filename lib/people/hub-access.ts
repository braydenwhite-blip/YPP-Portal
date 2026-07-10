import { hasRole } from "@/lib/authorization-roles";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import {
  isLeadershipOrBoard,
  isOfficerTier,
  type ActionViewer,
} from "@/lib/people-strategy/action-permissions";

/** Static People hub routes (not per-person profile pages). */
const PEOPLE_HUB_STATIC_SEGMENTS = new Set([
  "directory",
  "check-ins",
  "quarterly-reviews",
  "performance",
  "find",
  "classes",
  "mentorship",
  "develop",
  "board-rollup",
]);

/**
 * Officer-tier gate for the People hub front door and its sub-surfaces.
 * Leadership preview pilots (roster email, ladder level, Sam/Zach) do not pass
 * unless they carry an assigned officer-tier role (ADMIN, STAFF,
 * CHAPTER_PRESIDENT, HIRING_CHAIR).
 */
export function canAccessPeopleHub(viewer: ActionViewer): boolean {
  return isOfficerTier(viewer);
}

/**
 * Edge-safe path check: hub routes require officer tier; `/people/[id]` profile
 * pages are excluded so member profiles keep their own page-level policy.
 */
export function isPeopleHubOfficerRoute(pathname: string): boolean {
  if (pathname === "/people") return true;
  if (!pathname.startsWith("/people/")) return false;
  const segment = pathname.slice("/people/".length).split("/")[0] ?? "";
  return PEOPLE_HUB_STATIC_SEGMENTS.has(segment);
}

/** Which People hub tabs the viewer may see. */
export function getPeopleHubAccess(viewer: ActionViewer) {
  return {
    showPerformance:
      isPeopleDashboardEnabled() && isLeadershipOrBoard(viewer),
    showClasses: hasRole(viewer.roles, "ADMIN", viewer.primaryRole ?? null),
  };
}
