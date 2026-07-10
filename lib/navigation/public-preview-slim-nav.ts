import type { NavRole } from "@/lib/navigation/types";
import { isOfficerTierFromAuth } from "@/lib/org/role-sets";
import { isPublicGateEnabled } from "@/lib/public-gate";
import {
  canAccessActionsOnlyPreview,
  canAccessLeadershipPreviewStack,
  isActionsOnlyPilotEmail,
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

/** Leadership home + People Strategy front doors (People added when officer-tier). */
const LEADERSHIP_SLIM_HREFS = ["/", "/actions"] as const;

/** Home + Actions only — for narrow preview pilots. */
const ACTIONS_ONLY_SLIM_HREFS = ["/", "/actions"] as const;

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

/** Chapter president keeps chapter hub + the same leadership stack. */
const CHAPTER_PRESIDENT_SLIM_HREFS = ["/chapter", ...LEADERSHIP_SLIM_HREFS] as const;

/** Sidebar pin order when the slim nav is active. */
const SLIM_NAV_ORDER = [
  ...LEADERSHIP_SLIM_HREFS,
  ...ACTIONS_ONLY_SLIM_HREFS,
  "/chapter",
  ...PUBLIC_GATE_NAV_HREFS,
  ...OFFICER_PUBLISHED_HIRING_HREFS,
] as const;

function isActionsOnlyPreviewViewer(
  primaryRole: NavRole,
  roles: NavRole[],
  viewer: LeadershipPreviewViewer = {},
): boolean {
  return isActionsOnlyPilotEmail(viewer.email);
}

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
  const merged = { ...viewer, primaryRole, roles };
  return canAccessLeadershipPreviewStack(merged) || canAccessActionsOnlyPreview(merged);
}

export function getPublicPreviewSlimNavHrefs(
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = [],
  viewer: LeadershipPreviewViewer = {},
): ReadonlySet<string> {
  if (isActionsOnlyPreviewViewer(primaryRole, roles, viewer)) {
    return new Set(ACTIONS_ONLY_SLIM_HREFS);
  }

  const hrefs = new Set<string>(LEADERSHIP_SLIM_HREFS);

  if (isOfficerTierFromAuth(roles, primaryRole)) {
    hrefs.add("/people");
  }

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

  return hrefs;
}

/** Deterministic sidebar order for the slim nav core strip. */
export function getPublicPreviewSlimNavHrefList(
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = [],
  viewer: LeadershipPreviewViewer = {},
): string[] {
  const allowed = getPublicPreviewSlimNavHrefs(primaryRole, roles, adminSubtypes, viewer);
  return SLIM_NAV_ORDER.filter((href) => allowed.has(href));
}

export function isPublicPreviewSlimNavHref(
  href: string,
  primaryRole: NavRole,
  roles: NavRole[],
  adminSubtypes: string[] = [],
  viewer: LeadershipPreviewViewer = {},
): boolean {
  return getPublicPreviewSlimNavHrefs(primaryRole, roles, adminSubtypes, viewer).has(href);
}
