import { getAdminSubtypeSet, type AdminSubtypeValue } from "@/lib/admin-subtypes";

/**
 * Single source of truth for what each admin subtype can reach.
 *
 * The portal has one ADMIN role refined by subtypes (HIRING_ADMIN,
 * MENTORSHIP_ADMIN, INTAKE_ADMIN, CONTENT_ADMIN, COMMUNICATIONS_ADMIN,
 * SUPER_ADMIN). This module maps every admin route to an owning domain so
 * the subtypes compose predictably:
 *
 *   - SUPER_ADMIN          → everything (a true catch-all, not a hand list).
 *   - UNIVERSAL routes     → every admin, even one with no subtype assigned.
 *   - BASELINE routes      → cross-cutting tools (analytics, audit log, etc.)
 *                            shared by every admin who has at least one subtype.
 *   - domain routes        → only the matching subtype (and SUPER_ADMIN).
 *
 * Multiple subtypes union naturally: a HIRING_ADMIN + CONTENT_ADMIN reaches
 * the hiring routes, the content routes, the baseline, and the universal set.
 *
 * Both the navigation resolver and the `/admin` route guard consume this, so
 * the sidebar and route access can no longer drift apart.
 */

/** A route is owned by a subtype domain, or sits in a shared tier. */
export type AdminRouteDomain =
  | Exclude<AdminSubtypeValue, "SUPER_ADMIN">
  | "UNIVERSAL"
  | "BASELINE";

/**
 * First path segment after `/admin/` → owning domain. Every admin route
 * segment must appear here; an unmapped segment fails open (treated as
 * non-gated) so newly added routes are never silently locked out.
 */
const ADMIN_SEGMENT_DOMAIN: Record<string, AdminRouteDomain> = {
  // Universal — any admin, including one with no subtype assigned.
  chapters: "UNIVERSAL",
  training: "UNIVERSAL",
  "bulk-users": "UNIVERSAL",
  reflections: "UNIVERSAL",

  // Baseline — cross-cutting tools shared by every admin with a subtype.
  "action-center": "BASELINE",
  analytics: "BASELINE",
  "audit-log": "BASELINE",
  "chapter-reports": "BASELINE",
  "data-export": "BASELINE",
  export: "BASELINE",
  "feature-gates": "BASELINE",
  governance: "BASELINE",
  "role-matrix": "BASELINE",
  staff: "BASELINE",

  // Hiring domain.
  "application-cohorts": "HIRING_ADMIN",
  applications: "HIRING_ADMIN",
  "chapter-president-applicants": "HIRING_ADMIN",
  "external-applicants": "HIRING_ADMIN",
  "form-templates": "HIRING_ADMIN",
  "hiring-committee": "HIRING_ADMIN",
  "instructor-applicants": "HIRING_ADMIN",
  "instructor-approvals": "HIRING_ADMIN",
  "instructor-assignments": "HIRING_ADMIN",
  "instructor-readiness": "HIRING_ADMIN",
  instructors: "HIRING_ADMIN",
  positions: "HIRING_ADMIN",
  recruiting: "HIRING_ADMIN",

  // Mentorship domain.
  goals: "MENTORSHIP_ADMIN",
  "instructor-mentor-matching": "MENTORSHIP_ADMIN",
  "mentor-match": "MENTORSHIP_ADMIN",
  mentorship: "MENTORSHIP_ADMIN",
  "mentorship-program": "MENTORSHIP_ADMIN",
  "pathway-tracking": "MENTORSHIP_ADMIN",
  "unlock-approvals": "MENTORSHIP_ADMIN",

  // Content domain.
  activities: "CONTENT_ADMIN",
  challenges: "CONTENT_ADMIN",
  classes: "CONTENT_ADMIN",
  competitions: "CONTENT_ADMIN",
  "course-library": "CONTENT_ADMIN",
  curricula: "CONTENT_ADMIN",
  events: "CONTENT_ADMIN",
  incubator: "CONTENT_ADMIN",
  journeys: "CONTENT_ADMIN",
  opportunities: "CONTENT_ADMIN",
  passions: "CONTENT_ADMIN",
  pathways: "CONTENT_ADMIN",
  programs: "CONTENT_ADMIN",
  "reflection-forms": "CONTENT_ADMIN",
  "resource-library": "CONTENT_ADMIN",
  showcases: "CONTENT_ADMIN",
  stories: "CONTENT_ADMIN",
  "workshop-library": "CONTENT_ADMIN",
  "workshop-reviews": "CONTENT_ADMIN",

  // Communications domain.
  announcements: "COMMUNICATIONS_ADMIN",
  "emergency-broadcast": "COMMUNICATIONS_ADMIN",
  feedback: "COMMUNICATIONS_ADMIN",
  "parent-feedback": "COMMUNICATIONS_ADMIN",
  "portal-rollout": "COMMUNICATIONS_ADMIN",
  reminders: "COMMUNICATIONS_ADMIN",
  "rollout-comms": "COMMUNICATIONS_ADMIN",
  "student-of-month": "COMMUNICATIONS_ADMIN",
  "wall-of-fame": "COMMUNICATIONS_ADMIN",

  // Intake domain.
  alumni: "INTAKE_ADMIN",
  "parent-approvals": "INTAKE_ADMIN",
  scholarships: "INTAKE_ADMIN",
  students: "INTAKE_ADMIN",
  "volunteer-hours": "INTAKE_ADMIN",
  waitlist: "INTAKE_ADMIN",
};

function normalizePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0];
  if (path.length > 1 && path.endsWith("/")) {
    return path.replace(/\/+$/, "");
  }
  return path;
}

/**
 * Resolve the owning domain of a subtype-gated route, or `null` when the
 * path is not subtype-gated at all (a non-admin route, or an unmapped
 * admin segment that should fail open).
 */
export function resolveAdminRouteDomain(pathname: string): AdminRouteDomain | null {
  const path = normalizePath(pathname);

  // Participant-facing surfaces that are still admin-subtype gated.
  if (path === "/chapter/student-intake" || path.startsWith("/chapter/student-intake/")) {
    return "INTAKE_ADMIN";
  }
  if (path === "/mentorship-program" || path.startsWith("/mentorship-program/")) {
    return "MENTORSHIP_ADMIN";
  }

  if (path !== "/admin" && !path.startsWith("/admin/")) {
    return null;
  }
  // The /admin landing belongs to the baseline — any admin with a subtype.
  if (path === "/admin") {
    return "BASELINE";
  }

  const segment = path.slice("/admin/".length).split("/")[0];
  return ADMIN_SEGMENT_DOMAIN[segment] ?? null;
}

/**
 * Whether an admin with the given subtypes may reach `pathname`.
 *
 * SUPER_ADMIN passes everything. UNIVERSAL routes pass for any admin. An
 * admin with no subtype is held to the universal set; one with any subtype
 * additionally gets the shared baseline plus their own domain routes.
 */
export function canAccessAdminRoute(
  adminSubtypes: Array<string | null | undefined> | undefined | null,
  pathname: string
): boolean {
  const subtypes = getAdminSubtypeSet(adminSubtypes);
  if (subtypes.has("SUPER_ADMIN")) return true;

  const domain = resolveAdminRouteDomain(pathname);
  if (domain === null) return true;
  if (domain === "UNIVERSAL") return true;
  if (subtypes.size === 0) return false;
  if (domain === "BASELINE") return true;
  return subtypes.has(domain);
}
