import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";

/** Sidebar groups removed for users whose primary role is Admin (tools stay reachable via /admin). */
const ADMIN_PRIMARY_HIDDEN_GROUPS = new Set<NavGroup>([
  "Admin People",
  "Admin Content",
  "Admin Reports",
  "Admin Operations",
]);

const OPPORTUNITIES_KEEP_ONLY = new Set(["/positions"]);

const PEOPLE_SUPPORT_HIDDEN_FOR_ADMIN_PRIMARY = new Set<string>([
  "/peer-recognition",
  "/my-program/gr",
  "/my-program/awards",
  "/my-program/achievement-journey",
  "/my-program/certificate",
  "/my-program/schedule",
  "/mentorship-program/reviews",
  "/mentorship-program/chair",
  "/mentorship-program/awards",
  "/mentorship-program/schedule",
  "/mentorship/mentees",
  "/mentorship/reviews",
  "/mentorship/unlock-sections",
  "/instructor-growth",
  "/instructor-growth/review",
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
  "/reflection",
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
    if (ADMIN_PRIMARY_HIDDEN_GROUPS.has(item.group)) return hasAdminSubtype;
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
