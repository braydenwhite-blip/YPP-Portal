import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";

/** Sidebar groups removed for users whose primary role is Admin (tools stay reachable via /admin). */
const ADMIN_PRIMARY_HIDDEN_GROUPS = new Set<NavGroup>([
  "Admin People",
  "Admin Content",
  "Admin Reports",
  "Admin Operations",
]);

const OPPORTUNITIES_KEEP_ONLY = new Set(["/positions"]);

/**
 * Hrefs in otherwise-hidden Admin groups that all primary-role admins should see
 * in the sidebar. These are re-skinned into the leadership operating-system
 * sections (People / Programs / Partners / Admin) by officer-nav-layout.ts so
 * the most-used admin surfaces are one click away instead of buried in /admin.
 */
const ADMIN_PRIMARY_GROUP_KEEP_HREFS = new Set<string>([
  "/admin/training",
  "/admin/bulk-users",
  // People
  "/admin/instructors",
  "/admin/instructor-applicants",
  "/admin/instructor-applicants/chair-queue",
  "/admin/students",
  "/admin/leadership",
  "/admin/parent-feedback",
  // Programs
  "/admin/classes",
  "/admin/programs",
  "/admin/curricula",
  // Applicants
  "/admin/chapter-president-applicants",
  // Partners
  "/admin/partners",
  // Chapters
  "/admin/chapter-reports",
  // Admin
  "/admin/analytics",
]);

const PEOPLE_SUPPORT_HIDDEN_FOR_ADMIN_PRIMARY = new Set<string>([
  "/peer-recognition",
  "/my-program",
  "/my-program/gr",
  "/my-program/awards",
  "/my-mentor/awards",
  "/my-program/achievement-journey",
  "/my-program/certificate",
  "/my-program/schedule",
  "/mentorship-program/reviews",
  "/mentorship-program/chair",
  "/mentorship-program/awards",
  "/mentorship-program/schedule",
  "/mentorship/mentees",
  "/mentorship/reviews",
  "/mentorship/chair",
  "/mentorship/awards",
  "/mentorship/unlock-sections",
  "/mentorship/feedback",
  "/mentorship/ask",
  "/mentorship/resources",
  "/instructor-growth",
  "/instructor-growth/review",
  "/college-advisor/roadmap",
  "/college-advisor/activities",
  "/alumni-network",
  "/events",
  "/calendar",
  "/office-hours",
  "/instructor-training",
  "/instructor/lesson-design-studio",
  "/lesson-plans",
  "/instructor/lesson-plans/templates",
  "/instructor/workspace",
  "/instructor/curriculum-builder",
  "/instructor/class-settings",
  "/instructor/peer-observation",
  "/instructor/mentee-health",
  "/instructor/parent-feedback",
  "/internships",
  "/service-projects",
  "/resource-exchange",
  "/portfolio/templates",
  "/events/map",
  "/applications",
  "/instructor/certification-pathway",
]);

function hasMatchingNonAdminRole(item: NavLink, roles: NavRole[]): boolean {
  return (
    item.roles?.some((role) => role !== "ADMIN" && roles.includes(role)) ?? false
  );
}

/**
 * Streamlined left-rail for primary-role admins: learning + progress stay broad;
 * hiring/mentorship/attendance stay visible; deep instructor/mentor/college/extra links are trimmed.
 */
export function applyAdminPrimarySidebarFilter(
  links: NavLink[],
  primaryRole: NavRole,
  roles: NavRole[] = [],
  adminSubtypes: string[] = []
): NavLink[] {
  if (primaryRole !== "ADMIN") return links;
  const hasAdminSubtype = adminSubtypes.length > 0;

  return links.filter((item) => {
    if (ADMIN_PRIMARY_HIDDEN_GROUPS.has(item.group)) {
      if (ADMIN_PRIMARY_GROUP_KEEP_HREFS.has(item.href)) return true;
      return hasAdminSubtype;
    }
    if (item.group === "Challenges" || item.group === "Projects") return false;
    if (item.group === "Opportunities" && !OPPORTUNITIES_KEEP_ONLY.has(item.href)) {
      return false;
    }
    if (
      PEOPLE_SUPPORT_HIDDEN_FOR_ADMIN_PRIMARY.has(item.href) &&
      !hasMatchingNonAdminRole(item, roles)
    ) {
      return false;
    }
    if (item.href.startsWith("/my-program/")) return false;

    return true;
  });
}
