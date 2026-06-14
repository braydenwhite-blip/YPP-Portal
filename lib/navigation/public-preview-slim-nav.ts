import type { NavRole } from "@/lib/navigation/types";
import { isPublicGateEnabled } from "@/lib/public-gate";

/**
 * Slim sidebar for the public-gated preview ship (f-6dd640 / Summer Workshop focus).
 *
 * When the portal public gate is ON, officer-tier users only see the leadership
 * surfaces that are finished and usable in this version — not the full catalog
 * hidden under "More Tools (80)".
 *
 * Set `PORTAL_SLIM_NAV=false` to restore the full officer sidebar locally.
 */

/** Leadership home + People Strategy front doors (Knowledge OS V2 preview). */
const LEADERSHIP_SLIM_HREFS = [
  "/",
  "/people",
  "/actions",
  "/operations/initiatives",
  "/work",
] as const;

/** Hiring chair extras still needed during the instructor-applicant public ship. */
const HIRING_CHAIR_SLIM_HREFS = [
  "/admin/instructor-applicants",
  "/admin/instructor-applicants/chair-queue",
] as const;

/** Chapter president keeps chapter hub + the same leadership stack. */
const CHAPTER_PRESIDENT_SLIM_HREFS = ["/chapter", ...LEADERSHIP_SLIM_HREFS] as const;

export function isPublicPreviewSlimNavEnabled(): boolean {
  if (process.env.PORTAL_SLIM_NAV === "false") return false;
  return isPublicGateEnabled();
}

export function shouldApplyPublicPreviewSlimNav(
  primaryRole: NavRole,
  roles: NavRole[]
): boolean {
  if (!isPublicPreviewSlimNavEnabled()) return false;
  if (primaryRole === "ADMIN" || primaryRole === "STAFF") return true;
  if (primaryRole === "HIRING_CHAIR" || roles.includes("HIRING_CHAIR")) return true;
  if (primaryRole === "CHAPTER_PRESIDENT" || roles.includes("CHAPTER_PRESIDENT")) {
    return true;
  }
  return false;
}

export function getPublicPreviewSlimNavHrefs(
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = []
): ReadonlySet<string> {
  const hrefs = new Set<string>(LEADERSHIP_SLIM_HREFS);

  if (primaryRole === "CHAPTER_PRESIDENT" || roles.includes("CHAPTER_PRESIDENT")) {
    for (const href of CHAPTER_PRESIDENT_SLIM_HREFS) {
      hrefs.add(href);
    }
  }

  const hasHiringChairAccess =
    primaryRole === "HIRING_CHAIR" ||
    roles.includes("HIRING_CHAIR") ||
    adminSubtypes.includes("HIRING_ADMIN");

  if (hasHiringChairAccess) {
    for (const href of HIRING_CHAIR_SLIM_HREFS) {
      hrefs.add(href);
    }
  }

  return hrefs;
}

export function isPublicPreviewSlimNavHref(
  href: string,
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = []
): boolean {
  return getPublicPreviewSlimNavHrefs(primaryRole, roles, adminSubtypes).has(href);
}
