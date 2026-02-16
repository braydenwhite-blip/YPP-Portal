import { CORE_NAV_LIMIT, CORE_NAV_MAP, PRIMARY_ROLE_FALLBACK_ORDER } from "@/lib/navigation/core-map";
import { NAV_CATALOG } from "@/lib/navigation/catalog";
import type { NavGroup, NavLink, NavRole, NavViewModel } from "@/lib/navigation/types";

const AWARD_TIERS = new Set(["BRONZE", "SILVER", "GOLD"]);
const CRITICAL_CORE_LINKS = ["/messages", "/notifications"];

type RoleGroupOrder = Record<NavRole, NavGroup[]>;

const GROUP_ORDER_BY_ROLE: RoleGroupOrder = {
  STUDENT: [
    "Start Here",
    "Learning",
    "Progress",
    "Challenges",
    "Projects",
    "People & Support",
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
  CHAPTER_LEAD: [
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
  primaryRole?: string | null;
  awardTier?: string | null;
  pathname: string;
  maxCoreItems?: number;
}

function toNavRole(value: string | null | undefined): NavRole | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (
    normalized === "ADMIN" ||
    normalized === "CHAPTER_LEAD" ||
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

export function resolveNavModel(input: ResolveNavInput): NavViewModel {
  const roles = normalizeRoles(input.roles);
  const primaryRole = resolvePrimaryRole(input.primaryRole, roles);
  const hasAward = isAwardTier(input.awardTier);
  const limit = Math.min(input.maxCoreItems ?? CORE_NAV_LIMIT, CORE_NAV_LIMIT);

  const visible = sortLinksForRole(
    NAV_CATALOG.filter((item) => hasRoleAccess(item, roles) && hasAwardAccess(item, roles, hasAward)),
    primaryRole,
  );

  const visibleByHref = new Map(visible.map((item) => [item.href, item]));

  const core: NavLink[] = [];
  for (const href of CORE_NAV_MAP[primaryRole]) {
    const item = visibleByHref.get(href);
    if (!item || !item.coreEligible) continue;
    addOrReplaceCoreItem(core, item, limit);
  }

  for (const criticalHref of CRITICAL_CORE_LINKS) {
    const item = visibleByHref.get(criticalHref);
    if (!item || !item.coreEligible) continue;
    addOrReplaceCoreItem(core, item, limit);
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
  const more = groupLabels.map((label) => ({
    label,
    items: grouped.get(label) ?? [],
  }));

  return {
    primaryRole,
    visible,
    core,
    more,
  };
}
