import type { NavRole } from "@/lib/navigation/types";
import { isPublicGateEnabled } from "@/lib/public-gate";
import {
  canAccessLeadershipPreviewStack,
  type LeadershipPreviewViewer,
} from "@/lib/leadership-preview-access";

/**
 * Slim sidebar for the public-gated preview ship (f-6dd640 / Summer Workshop focus).
 *
 * When the portal public gate is ON, officer-tier users see only the leadership
 * front doors plus the same Summer Workshop / hiring surfaces that are already
 * published to the public gate — not the full catalog under "More Tools".
 *
 * Set `PORTAL_SLIM_NAV=false` to restore the full officer sidebar locally.
 */

/** Leadership home + People Strategy front doors. */
const LEADERSHIP_SLIM_HREFS = ["/", "/people", "/actions", "/meetings"] as const;

/**
 * Nav entries that mirror `PUBLIC_ALLOWED_PREFIXES` in `lib/public-gate.ts`
 * (Summer Workshop apply/propose flows). Shown alongside the leadership stack.
 */
const PUBLIC_GATE_NAV_HREFS = [
  "/applications",
  "/application-status",
  "/instructor/workshop-design-studio",
  "/instructor-training",
] as const;

/** Hiring surfaces already published on the public gate for officer-tier users. */
const OFFICER_PUBLISHED_HIRING_HREFS = [
  "/admin/instructor-applicants",
  "/admin/external-applicants",
] as const;

/** Hiring chair extras still needed during the instructor-applicant public ship. */
const HIRING_CHAIR_SLIM_HREFS = [
  "/admin/instructor-applicants/chair-queue",
] as const;

/** Chapter president keeps chapter hub + the same leadership stack. */
const CHAPTER_PRESIDENT_SLIM_HREFS = ["/chapter", ...LEADERSHIP_SLIM_HREFS] as const;

/** Sidebar pin order when the slim nav is active. */
const SLIM_NAV_ORDER = [
  ...LEADERSHIP_SLIM_HREFS,
  "/chapter",
  ...PUBLIC_GATE_NAV_HREFS,
  ...OFFICER_PUBLISHED_HIRING_HREFS,
  ...HIRING_CHAIR_SLIM_HREFS,
] as const;

export function isPublicPreviewSlimNavEnabled(): boolean {
  if (process.env.PORTAL_SLIM_NAV === "false") return false;
  return isPublicGateEnabled();
}

export function shouldApplyPublicPreviewSlimNav(
  primaryRole: NavRole,
  roles: NavRole[],
  viewer: LeadershipPreviewViewer = {},
): boolean {
  if (!isPublicPreviewSlimNavEnabled()) return false;
  return canAccessLeadershipPreviewStack({
    ...viewer,
    primaryRole,
    roles,
  });
}

export function getPublicPreviewSlimNavHrefs(
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = []
): ReadonlySet<string> {
  const hrefs = new Set<string>(LEADERSHIP_SLIM_HREFS);

  for (const href of PUBLIC_GATE_NAV_HREFS) {
    hrefs.add(href);
  }

  if (primaryRole === "CHAPTER_PRESIDENT" || roles.includes("CHAPTER_PRESIDENT")) {
    for (const href of CHAPTER_PRESIDENT_SLIM_HREFS) {
      hrefs.add(href);
    }
  }

  const hasOfficerTierSlimNav = canAccessLeadershipPreviewStack({
    primaryRole,
    roles,
  });

  if (hasOfficerTierSlimNav) {
    for (const href of OFFICER_PUBLISHED_HIRING_HREFS) {
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

/** Deterministic sidebar order for the slim nav core strip. */
export function getPublicPreviewSlimNavHrefList(
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = []
): string[] {
  const allowed = getPublicPreviewSlimNavHrefs(primaryRole, roles, adminSubtypes);
  return SLIM_NAV_ORDER.filter((href) => allowed.has(href));
}

export function isPublicPreviewSlimNavHref(
  href: string,
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = []
): boolean {
  return getPublicPreviewSlimNavHrefs(primaryRole, roles, adminSubtypes).has(href);
}
