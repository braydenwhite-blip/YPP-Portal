import { CORE_NAV_LIMIT, CORE_NAV_MAP, PRIMARY_ROLE_FALLBACK_ORDER } from "@/lib/navigation/core-map";
import { NAV_CATALOG } from "@/lib/navigation/catalog";
import { getVisibleNavGroups } from "@/lib/unlock-nav-groups";
import {
  STUDENT_V1_ALLOWED_HREFS,
  shouldApplyStudentV1NavFilter,
} from "@/lib/navigation/student-v1-allowlist";
import {
  applyStudentMinimalSidebarLayout,
  studentMinimalLinkOrderIndex,
} from "@/lib/navigation/student-v1-nav-layout";
import type { NavGroup, NavLink, NavRole, NavViewModel } from "@/lib/navigation/types";
import { normalizeAdminSubtypes } from "@/lib/admin-subtypes";

const AWARD_TIERS = new Set(["BRONZE", "SILVER", "GOLD"]);
const CRITICAL_CORE_LINKS = ["/messages"];

type RoleGroupOrder = Record<NavRole, NavGroup[]>;

const ALWAYS_HIDDEN_HREFS = new Set([
  "/admin/portal-rollout",
  "/chapter-lead/portal-rollout",
  "/admin/rollout-comms",
  "/admin/hiring-committee",
]);

const ADMIN_LINKS_BY_SUBTYPE = {
  SUPER_ADMIN: [
    "/admin",
    "/admin/instructor-applicants",
    "/admin/chapter-president-applicants",
    "/admin/recruiting",
    "/admin/curricula",
    "/admin/announcements",
    "/admin/audit-log",
    "/admin/analytics",
    "/admin/export",
    "/chapter/student-intake",
    "/mentorship-program",
    "/mentorship-program/reviews",
    "/mentorship-program/chair",
    "/mentorship-program/awards",
    "/admin/mentorship-program",
  ],
  HIRING_ADMIN: [
    "/admin/instructor-applicants",
    "/admin/chapter-president-applicants",
    "/admin/recruiting",
  ],
  MENTORSHIP_ADMIN: [
    "/mentorship-program",
    "/mentorship-program/reviews",
    "/mentorship-program/chair",
    "/mentorship-program/awards",
    "/admin/mentorship-program",
  ],
  INTAKE_ADMIN: [
    "/chapter/student-intake",
  ],
  CONTENT_ADMIN: [
    "/admin",
    "/admin/curricula",
  ],
  COMMUNICATIONS_ADMIN: [
    "/admin/announcements",
  ],
} as const;

const GROUP_ORDER_BY_ROLE: RoleGroupOrder = {
  STUDENT: [
    "Learning",
    "Progress",
    "Schedule",
    "Community",
    "Profile",
    "Start Here",
    "People & Support",
    "Challenges",
    "Projects",
    "Opportunities",
    "Chapters",
    "Profile & Settings",
    "Family",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
  INSTRUCTOR: [
    "Start Here",
    "Progress",
    "Learning",
    "People & Support",
    "Opportunities",
    "Projects",
    "Challenges",
    "Chapters",
    "Profile & Settings",
    "Family",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
  ADMIN: [
    "Start Here",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
    "Progress",
    "Learning",
    "People & Support",
    "Chapters",
    "Opportunities",
    "Profile & Settings",
    "Challenges",
    "Projects",
    "Family",
  ],
  CHAPTER_PRESIDENT: [
    "Start Here",
    "Chapters",
    "Progress",
    "People & Support",
    "Learning",
    "Opportunities",
    "Projects",
    "Challenges",
    "Profile & Settings",
    "Family",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
  PARENT: [
    "Family",
    "Start Here",
    "People & Support",
    "Learning",
    "Progress",
    "Profile & Settings",
    "Opportunities",
    "Chapters",
    "Challenges",
    "Projects",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
  MENTOR: [
    "Start Here",
    "People & Support",
    "Progress",
    "Learning",
    "Opportunities",
    "Chapters",
    "Profile & Settings",
    "Challenges",
    "Projects",
    "Family",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
  APPLICANT: [
    "Start Here",
    "Profile & Settings",
    "Family",
    "Learning",
    "Progress",
    "People & Support",
    "Opportunities",
    "Chapters",
    "Challenges",
    "Projects",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
  STAFF: [
    "Start Here",
    "Opportunities",
    "Learning",
    "Progress",
    "People & Support",
    "Chapters",
    "Profile & Settings",
    "Challenges",
    "Projects",
    "Family",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
};

export interface ResolveNavInput {
  roles?: string[];
  adminSubtypes?: string[];
  primaryRole?: string | null;
  awardTier?: string | null;
  pathname: string;
  maxCoreItems?: number;
  unlockedSections?: Set<string>;
  enabledFeatureKeys?: Set<string>;
  /** When true, students see the full nav catalog. Omit/false uses env `STUDENT_FULL_PORTAL_EXPLORER`. */
  studentFullPortalExplorer?: boolean;
}

function toNavRole(value: string | null | undefined): NavRole | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (
    normalized === "ADMIN" ||
    normalized === "APPLICANT" ||
    normalized === "CHAPTER_PRESIDENT" ||
    normalized === "INSTRUCTOR" ||
    normalized === "MENTOR" ||
    normalized === "PARENT" ||
    normalized === "STAFF" ||
    normalized === "STUDENT"
  ) {
    return normalized;
  }
  return null;
}

function normalizeRoles(roles: string[] | undefined): NavRole[] {
  const parsed = (roles ?? []).map((role) => toNavRole(role)).filter((role): role is NavRole => role !== null);
  return Array.from(new Set(parsed));
}

function resolvePrimaryRole(primaryRole: string | null | undefined, roles: NavRole[]): NavRole {
  const parsedPrimary = toNavRole(primaryRole);
  if (parsedPrimary) return parsedPrimary;

  for (const candidate of PRIMARY_ROLE_FALLBACK_ORDER) {
    if (roles.includes(candidate)) {
      return candidate;
    }
  }

  return "STUDENT";
}

function isAwardTier(tier: string | null | undefined): boolean {
  return tier ? AWARD_TIERS.has(tier.toUpperCase()) : false;
}

function hasRoleAccess(item: NavLink, roles: NavRole[]): boolean {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.some((role) => roles.includes(role));
}

function hasAwardAccess(item: NavLink, roles: NavRole[], hasAward: boolean): boolean {
  if (!item.requiresAward) return true;
  return hasAward || roles.includes("ADMIN");
}

function hasFeatureAccess(item: NavLink, enabledFeatureKeys: Set<string> | undefined, roles: NavRole[]): boolean {
  if (!item.featureKey) return true;
  if (roles.includes("ADMIN")) return true;
  return enabledFeatureKeys?.has(item.featureKey) ?? false;
}

function hasNonAdminRoleAccess(item: NavLink, roles: NavRole[]): boolean {
  if (!item.roles || item.roles.length === 0) return false;
  return item.roles.some((role) => role !== "ADMIN" && roles.includes(role));
}

function requiresAdminSubtypeFiltering(item: NavLink): boolean {
  return (
    item.href.startsWith("/admin") ||
    item.href === "/chapter/student-intake" ||
    item.href.startsWith("/mentorship-program")
  );
}

function hasAdminSubtypeAccess(item: NavLink, roles: NavRole[], adminSubtypes: string[]): boolean {
  if (!roles.includes("ADMIN")) return true;
  if (hasNonAdminRoleAccess(item, roles)) return true;
  if (!requiresAdminSubtypeFiltering(item)) return true;

  const normalizedSubtypes = normalizeAdminSubtypes(adminSubtypes);
  const allowedHrefs = new Set<string>();
  for (const subtype of normalizedSubtypes) {
    for (const href of ADMIN_LINKS_BY_SUBTYPE[subtype]) {
      allowedHrefs.add(href);
    }
  }

  return allowedHrefs.has(item.href);
}

function groupIndex(primaryRole: NavRole, group: NavGroup): number {
  const order = GROUP_ORDER_BY_ROLE[primaryRole];
  const index = order.indexOf(group);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function sortLinksForRole(links: NavLink[], primaryRole: NavRole): NavLink[] {
  return [...links].sort((a, b) => {
    const groupDiff = groupIndex(primaryRole, a.group) - groupIndex(primaryRole, b.group);
    if (groupDiff !== 0) return groupDiff;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.label.localeCompare(b.label);
  });
}

export function isNavHrefActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function addOrReplaceCoreItem(core: NavLink[], item: NavLink, limit: number): void {
  if (core.some((entry) => entry.href === item.href)) return;
  if (core.length < limit) {
    core.push(item);
    return;
  }

  let replaceIndex = core.length - 1;
  while (replaceIndex >= 0 && CRITICAL_CORE_LINKS.includes(core[replaceIndex].href)) {
    replaceIndex -= 1;
  }

  if (replaceIndex < 0) {
    replaceIndex = core.length - 1;
  }

  core[replaceIndex] = item;
}

function orderGroups(primaryRole: NavRole, groups: NavGroup[]): NavGroup[] {
  const order = GROUP_ORDER_BY_ROLE[primaryRole];
  return [...groups].sort((a, b) => {
    const diff = order.indexOf(a) - order.indexOf(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
}

export function resolveNavModel(input: ResolveNavInput): NavViewModel & { lockedGroups?: Map<NavGroup, string> } {
  const roles = normalizeRoles(input.roles);
  const primaryRole = resolvePrimaryRole(input.primaryRole, roles);
  const hasAward = isAwardTier(input.awardTier);
  const limit = Math.min(input.maxCoreItems ?? CORE_NAV_LIMIT, CORE_NAV_LIMIT);
  const adminSubtypes = input.adminSubtypes ?? [];
  const usesUnlockVisibility =
    primaryRole === "INSTRUCTOR" ||
    (input.unlockedSections && (primaryRole === "STUDENT" || primaryRole === "PARENT"));

  // Determine which groups are visible/locked based on unlock status
  let unlockVisibleGroups: Set<NavGroup> | null = null;
  let unlockLockedGroups: Map<NavGroup, string> | null = null;
  const restrictToVisibleGroups = primaryRole === "INSTRUCTOR";

  if (usesUnlockVisibility) {
    const { visibleGroups, lockedGroups } = getVisibleNavGroups(
      primaryRole,
      input.unlockedSections ?? new Set<string>(),
    );
    unlockVisibleGroups = visibleGroups;
    unlockLockedGroups = lockedGroups;
  }

  let visible = sortLinksForRole(
    NAV_CATALOG.filter((item) => {
      if (ALWAYS_HIDDEN_HREFS.has(item.href)) return false;
      if (!hasRoleAccess(item, roles)) return false;
      if (!hasAwardAccess(item, roles, hasAward)) return false;
      if (!hasFeatureAccess(item, input.enabledFeatureKeys, roles)) return false;
      if (!hasAdminSubtypeAccess(item, roles, adminSubtypes)) return false;

      // If unlock filtering is active, only include items whose group is visible
      // or whose group is not in the locked set (i.e. groups not managed by the
      // unlock system, like Admin groups, pass through unchanged).
      if (unlockVisibleGroups) {
        if (restrictToVisibleGroups) {
          return unlockVisibleGroups.has(item.group);
        }
        if (unlockVisibleGroups.has(item.group)) return true;
        if (unlockLockedGroups && unlockLockedGroups.has(item.group)) return false;
        // Group is neither in visible nor locked — it's not managed by the
        // unlock system, so let it through (e.g. Admin groups for roles that
        // have access).
        return true;
      }

      return true;
    }),
    primaryRole,
  );

  if (shouldApplyStudentV1NavFilter(primaryRole, input.studentFullPortalExplorer)) {
    visible = visible.filter((item) => STUDENT_V1_ALLOWED_HREFS.has(item.href));
  }

  const studentMinimalSidebar =
    primaryRole === "STUDENT" && shouldApplyStudentV1NavFilter(primaryRole, input.studentFullPortalExplorer);

  if (studentMinimalSidebar) {
    visible = visible.map(applyStudentMinimalSidebarLayout);
  }

  const visibleByHref = new Map(visible.map((item) => [item.href, item]));

  const coreHrefList =
    studentMinimalSidebar && primaryRole === "STUDENT" ? ["/"] : CORE_NAV_MAP[primaryRole];

  const core: NavLink[] = [];
  for (const href of coreHrefList) {
    const item = visibleByHref.get(href);
    if (!item || !item.coreEligible) continue;
    addOrReplaceCoreItem(core, item, limit);
  }

  if (!studentMinimalSidebar || primaryRole !== "STUDENT") {
    for (const criticalHref of CRITICAL_CORE_LINKS) {
      const item = visibleByHref.get(criticalHref);
      if (!item || !item.coreEligible) continue;
      addOrReplaceCoreItem(core, item, limit);
    }
  }

  const coreHrefs = new Set(core.map((item) => item.href));
  const moreLinks = visible.filter((item) => !coreHrefs.has(item.href));

  const grouped = new Map<NavGroup, NavLink[]>();
  for (const link of moreLinks) {
    const current = grouped.get(link.group);
    if (current) {
      current.push(link);
    } else {
      grouped.set(link.group, [link]);
    }
  }

  const groupLabels = orderGroups(primaryRole, Array.from(grouped.keys()));
  const more = groupLabels.map((label) => {
    const items = grouped.get(label) ?? [];
    const sorted =
      studentMinimalSidebar && primaryRole === "STUDENT"
        ? [...items].sort((a, b) => studentMinimalLinkOrderIndex(a.href) - studentMinimalLinkOrderIndex(b.href))
        : items;
    return { label, items: sorted };
  });

  return {
    primaryRole,
    visible,
    core,
    more,
    lockedGroups: unlockLockedGroups ?? undefined,
  };
}
