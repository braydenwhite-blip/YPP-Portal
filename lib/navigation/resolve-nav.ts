import { CORE_NAV_LIMIT, CORE_NAV_MAP, PRIMARY_ROLE_FALLBACK_ORDER } from "@/lib/navigation/core-map";
import { NAV_CATALOG } from "@/lib/navigation/catalog";
import { getVisibleNavGroups } from "@/lib/unlock-nav-groups";
import {
  CHAPTER_PRESIDENT_ALLOWED_HREFS,
  applyChapterPresidentMinimalSidebarLayout,
  chapterPresidentMinimalLinkOrderIndex,
  shouldApplyChapterPresidentNavFilter,
} from "@/lib/navigation/chapter-president-v1-nav-layout";
import {
  INSTRUCTOR_V1_ALLOWED_HREFS,
  shouldApplyInstructorV1NavFilter,
} from "@/lib/navigation/instructor-v1-allowlist";
import {
  applyInstructorMinimalSidebarLayout,
  instructorMinimalLinkOrderIndex,
} from "@/lib/navigation/instructor-v1-nav-layout";
import {
  STUDENT_V1_ALLOWED_HREFS,
  shouldApplyStudentV1NavFilter,
} from "@/lib/navigation/student-v1-allowlist";
import {
  APPLICANT_ALLOWED_HREFS,
  shouldApplyApplicantNavFilter,
} from "@/lib/navigation/applicant-allowlist";
import {
  isRegularInstructorEnabled,
  isRegularInstructorGatedPath,
  isSummerWorkshopPermittedPath,
} from "@/lib/feature-flags";
import { isAllowedPublicPath, isOfficerTierFromAuth } from "@/lib/public-gate";
import {
  applyStudentMinimalSidebarLayout,
  studentMinimalLinkOrderIndex,
} from "@/lib/navigation/student-v1-nav-layout";
import type { NavGroup, NavLink, NavRole, NavViewModel } from "@/lib/navigation/types";
import { canAccessAdminRoute } from "@/lib/admin-capabilities";
import { applyAdminPrimarySidebarFilter } from "@/lib/navigation/admin-primary-nav-filter";
import {
  getPublicPreviewSlimNavHrefs,
  shouldApplyPublicPreviewSlimNav,
} from "@/lib/navigation/public-preview-slim-nav";
import {
  OFFICER_GROUP_ORDER,
  OFFICER_UNHIDE_HREFS,
  applyOfficerNavLayout,
  officerLinkOrderIndex,
  shouldApplyOfficerNavLayout,
} from "@/lib/navigation/officer-nav-layout";

const AWARD_TIERS = new Set(["BRONZE", "SILVER", "GOLD"]);
const CRITICAL_CORE_LINKS = ["/messages"];

/** Always pinned in officer-tier sidebars when visible (People Strategy front doors). */
const OFFICER_CRITICAL_CORE_LINKS = [
  "/people",
  "/actions",
  "/operations/initiatives",
  "/work",
];

type RoleGroupOrder = Record<NavRole, NavGroup[]>;

const ALWAYS_HIDDEN_HREFS = new Set([
  "/admin/portal-rollout",
  "/chapter-lead/portal-rollout",
  "/admin/rollout-comms",
  "/admin/hiring-committee",
  /** Hidden until product is ready; page remains reachable by URL. */
  "/instructor/mentee-health",
  /**
   * Chapter links are consolidated into a single "Chapter Hub" entry
   * to keep the sidebar compact. The destination pages remain reachable
   * via the hub (and by URL).
   */
  "/chapters",
  "/join-chapter",
  "/chapter/apply",
  "/chapter/president",
  "/chapter/student-intake",
  "/chapter/channels",
  "/chapter/members",
  "/chapter/leaderboard",
  "/chapter/achievements",
  "/chapters/leaderboard",
  "/admin/chapters",
  /** Action Tracker — one sidebar link (/actions); rest via in-page nav or search. */
  "/actions/all",
  "/actions/command-center",
  "/actions/responsibility",
  // Meetings are hidden by default and un-hidden for officers (OFFICER_UNHIDE_HREFS),
  // who reach the umbrella `/meetings` plus the two type hubs from the Work section.
  "/meetings",
  "/actions/meetings",
  "/impact-meetings",
  "/mentorship/mentees",
  "/mentorship/reviews",
  "/mentorship/schedule",
  "/mentorship/feedback",
  "/mentorship/ask",
  "/mentorship/resources",
  "/mentorship/awards",
  "/mentorship/chair",
  "/mentor/feedback",
  "/mentor/ask",
  "/mentor/resources",
  "/mentorship-program/awards",
]);


const GROUP_ORDER_BY_ROLE: RoleGroupOrder = {
  STUDENT: [
    "Learning",
    "Schedule",
    "Progress",
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
    "Teach",
    "Progress",
    "People & Support",
    "Chapters",
    "Profile & Settings",
    "Learning",
    "Opportunities",
    "Projects",
    "Challenges",
    "Family",
    "Admin People",
    "Admin Content",
    "Admin Reports",
    "Admin Operations",
  ],
  // Officer operating-system order (Command → Work → People → Programs →
  // Partners → Data → Admin), then the personal / long-tail sections.
  // Single source of truth: lib/navigation/officer-nav-layout.ts.
  ADMIN: OFFICER_GROUP_ORDER,
  HIRING_CHAIR: OFFICER_GROUP_ORDER,
  CHAPTER_PRESIDENT: [
    "Start Here",
    "Chapters",
    "Recruiting",
    "Growth",
    "Profile & Settings",
    "Progress",
    "People & Support",
    "Learning",
    "Opportunities",
    "Projects",
    "Challenges",
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
  STAFF: OFFICER_GROUP_ORDER,
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
  /** When true, People Strategy Action Tracker links (e.g. /my-actions) are shown. */
  actionTrackerEnabled?: boolean;
  /** When true, the Student Operating System link (/my-growth) is shown. */
  growthOsEnabled?: boolean;
  /** When true, the People Strategy Operations Hub link (/operations) is shown. */
  operationsHubEnabled?: boolean;
  /** When true, show the deprecated Leadership Action Center sidebar entry. */
  legacyActionCenterNavEnabled?: boolean;
  /** When true, students see the full nav catalog. Omit/false uses env `STUDENT_FULL_PORTAL_EXPLORER`. */
  studentFullPortalExplorer?: boolean;
  /** When set, hides "Join a chapter" — not needed if the user is already assigned to a chapter. */
  studentHasChapter?: boolean;
  /** When true, instructors see the full nav catalog. Omit/false uses env `INSTRUCTOR_FULL_PORTAL_EXPLORER`. */
  instructorFullPortalExplorer?: boolean;
  /** Demo-only: narrow the left sidebar to the hiring surfaces for the active role. */
  hiringDemoMode?: boolean;
  /**
   * Instructor subtype — when SUMMER_WORKSHOP, SW-permitted hrefs in
   * `SUMMER_WORKSHOP_PERMITTED_HREF_PREFIXES` stay visible even with the
   * regular instructor program paused.
   */
  instructorSubtype?: string | null;
  /**
   * Public portal gate. When true, hide nav links the middleware would
   * redirect to /locked. Officer-tier roles bypass this filter here even
   * if the layout still passes `publicGateActive=true` (defense in depth).
   */
  publicGateActive?: boolean;
}

function toNavRole(value: string | null | undefined): NavRole | null {
  if (!value) return null;
  const normalized = value.toUpperCase();
  if (
    normalized === "ADMIN" ||
    normalized === "APPLICANT" ||
    normalized === "CHAPTER_PRESIDENT" ||
    normalized === "HIRING_CHAIR" ||
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

function isLegacyMenteeMentorshipHref(href: string): boolean {
  return href === "/my-program" || href.startsWith("/my-program/");
}

function hasAdminSubtypeAccess(item: NavLink, roles: NavRole[], adminSubtypes: string[]): boolean {
  if (!roles.includes("ADMIN")) return true;
  if (hasNonAdminRoleAccess(item, roles)) return true;
  if (!requiresAdminSubtypeFiltering(item)) return true;

  return canAccessAdminRoute(adminSubtypes, item.href);
}

function hiringDemoHrefsForRole(primaryRole: NavRole): string[] | null {
  if (primaryRole === "APPLICANT") {
    return ["/application-status"];
  }
  if (primaryRole === "ADMIN") {
    return ["/admin/instructor-applicants"];
  }
  if (primaryRole === "CHAPTER_PRESIDENT") {
    return ["/chapter-lead/instructor-applicants"];
  }
  return null;
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

function pathMatchesHref(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function profileMergedIntoPersonalizationActive(
  pathname: string,
  candidateHrefs: readonly string[],
): boolean {
  if (candidateHrefs.includes("/profile")) return false;
  if (pathname === "/profile") return true;
  return pathname.startsWith("/profile/") && !pathname.startsWith("/profile/timeline");
}

function studentAssignmentsHubActive(
  pathname: string,
  candidateHrefs: readonly string[],
): boolean {
  if (!candidateHrefs.includes("/my-classes/assignments")) return false;
  return pathname.startsWith("/curriculum/") && pathname.includes("/assignments");
}

function navHrefMatchesPathnameForActive(
  pathname: string,
  href: string,
  candidateHrefs: readonly string[],
): boolean {
  if (pathMatchesHref(pathname, href)) return true;
  if (href === "/actions" && pathname.startsWith("/actions")) {
    return true;
  }
  if (href === "/people") {
    return pathname === "/people" || pathname.startsWith("/people/");
  }
  if (href === "/actions" && (pathname === "/my-actions" || pathname.startsWith("/my-actions/"))) {
    return true;
  }
  if (
    href === "/actions/all" &&
    (pathname === "/all-actions" ||
      pathname.startsWith("/all-actions/") ||
      pathname === "/admin/actions" ||
      pathname.startsWith("/admin/actions/"))
  ) {
    return true;
  }
  if (
    href === "/actions/meetings" &&
    (pathname === "/officer-meetings" || pathname.startsWith("/officer-meetings/"))
  ) {
    return true;
  }
  if (href === "/my-classes/assignments" && studentAssignmentsHubActive(pathname, candidateHrefs)) {
    return true;
  }
  if (
    href === "/settings/personalization" &&
    profileMergedIntoPersonalizationActive(pathname, candidateHrefs)
  ) {
    return true;
  }
  return false;
}

/**
 * Among all visible nav links, returns the single best-matching href for the current pathname
 * (longest prefix / most specific). Prevents both `/profile` and `/profile/timeline` from
 * highlighting when only one page is open.
 *
 * When `/profile` is not in the nav (student minimal IA), `/profile` and nested profile routes
 * except Journey (`/profile/timeline`) count as active for `/settings/personalization`.
 */
export function resolveNavActiveHref(pathname: string, candidateHrefs: readonly string[]): string | null {
  const uniq = Array.from(
    new Set(candidateHrefs.filter((h): h is string => typeof h === "string" && h.length > 0 && h !== "#")),
  );
  const matches = uniq.filter((href) => navHrefMatchesPathnameForActive(pathname, href, candidateHrefs));
  if (matches.length === 0) return null;
  return matches.reduce((best, h) => (h.length > best.length ? h : best));
}

/** True if pathname is this route or a nested segment under it (used for legacy checks). */
export function isNavHrefActive(href: string, pathname: string): boolean {
  return pathMatchesHref(pathname, href);
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

export function resolveNavModel(
  input: ResolveNavInput,
): NavViewModel & { lockedGroups?: Map<NavGroup, string>; officerChrome?: boolean } {
  const roles = normalizeRoles(input.roles);
  const primaryRole = resolvePrimaryRole(input.primaryRole, roles);
  const officerTierUser = isOfficerTierFromAuth(roles, primaryRole);
  const publicGateRestrictsNav =
    input.publicGateActive === true && !officerTierUser;
  const hasAward = isAwardTier(input.awardTier);
  const limit = Math.min(input.maxCoreItems ?? CORE_NAV_LIMIT, CORE_NAV_LIMIT);
  const adminSubtypes = input.adminSubtypes ?? [];
  const hiringDemoHrefs = input.hiringDemoMode
    ? hiringDemoHrefsForRole(primaryRole)
    : null;
  // Leadership operating-system layout (Command → Work → People → Programs →
  // Partners → Data → Admin). Officers always get the full, organized nav — it
  // takes precedence over the public-preview "slim" 5-link stack, which was
  // dumbing the leadership sidebar down to a handful of links. (Officers bypass
  // the public gate at the route level, so every section is reachable.) Only the
  // hiring demo, which has its own curated stack, opts out.
  const officerLayoutActive =
    shouldApplyOfficerNavLayout(primaryRole) && !hiringDemoHrefs;
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
      if (hiringDemoHrefs) {
        return hiringDemoHrefs.includes(item.href) && hasRoleAccess(item, roles);
      }

      // Chapter presidents have a dedicated, comprehensive sidebar
      // (chapter-president-v1-nav-layout.ts). For them the CP allowlist is the
      // single source of truth — `ALWAYS_HIDDEN_HREFS` (which exists to keep
      // OTHER roles' sidebars compact by routing chapter pages through the Hub)
      // does not apply, since the CP gets those pages as first-class nav.
      const isChapterPresidentNav = shouldApplyChapterPresidentNavFilter(primaryRole);

      if (
        ALWAYS_HIDDEN_HREFS.has(item.href) &&
        !isChapterPresidentNav &&
        !(officerLayoutActive && OFFICER_UNHIDE_HREFS.has(item.href))
      ) {
        return false;
      }

      if (isChapterPresidentNav && !CHAPTER_PRESIDENT_ALLOWED_HREFS.has(item.href)) {
        return false;
      }

      // Public portal gate: hide nav links outside the public allowlist.
      // Officer-tier roles keep the leadership sidebar without preview mode.
      if (publicGateRestrictsNav && !isAllowedPublicPath(item.href)) {
        return false;
      }

      // Temporary gate: hide regular Instructor navigation while paused.
      // Admin sidebars stay intact so admins can keep managing applicants.
      // SW-subtype users keep the workshop studio + training links so the
      // post-approval onboarding path actually works.
      if (
        !isRegularInstructorEnabled() &&
        !roles.includes("ADMIN") &&
        primaryRole !== "ADMIN" &&
        isRegularInstructorGatedPath(item.href) &&
        !(
          input.instructorSubtype === "SUMMER_WORKSHOP" &&
          isSummerWorkshopPermittedPath(item.href)
        )
      ) {
        return false;
      }
      if (input.studentHasChapter && item.href === "/join-chapter") return false;
      // People Strategy Action Tracker links stay fully hidden while the
      // feature flag is off — for every role, including admins.
      if (item.requiresActionTracker && !input.actionTrackerEnabled) return false;
      if (item.requiresGrowthOs && !input.growthOsEnabled) return false;
      if (item.requiresOperationsHub && !input.operationsHubEnabled) return false;
      if (item.requiresLegacyActionCenterNav && !input.legacyActionCenterNavEnabled) return false;
      if (!hasRoleAccess(item, roles)) return false;
      if (primaryRole !== "STUDENT" && isLegacyMenteeMentorshipHref(item.href)) {
        return false;
      }
      if (item.hideForPrimaryRoles?.includes(primaryRole)) return false;
      if (!hasAwardAccess(item, roles, hasAward)) return false;
      if (!hasFeatureAccess(item, input.enabledFeatureKeys, roles)) return false;
      if (!hasAdminSubtypeAccess(item, roles, adminSubtypes)) return false;
      // SW-subtype-only entries (e.g. Workshop Design Studio) stay hidden for
      // anyone whose most-recent application is NOT on the Summer Workshop
      // track. Admins still see them (they need to monitor the SW pathway).
      if (
        item.requiresSummerWorkshopSubtype &&
        input.instructorSubtype !== "SUMMER_WORKSHOP" &&
        !roles.includes("ADMIN") &&
        primaryRole !== "ADMIN"
      ) {
        return false;
      }

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

  if (!hiringDemoHrefs) {
    visible = applyAdminPrimarySidebarFilter(visible, primaryRole, roles, adminSubtypes);
  }

  if (shouldApplyPublicPreviewSlimNav(primaryRole, roles) && !officerLayoutActive) {
    const slimHrefs = getPublicPreviewSlimNavHrefs(primaryRole, roles, adminSubtypes);
    visible = visible.filter((item) => slimHrefs.has(item.href));
  }

  if (shouldApplyStudentV1NavFilter(primaryRole, input.studentFullPortalExplorer)) {
    visible = visible.filter((item) => STUDENT_V1_ALLOWED_HREFS.has(item.href));
  }

  if (shouldApplyInstructorV1NavFilter(primaryRole, input.instructorFullPortalExplorer)) {
    visible = visible.filter((item) => INSTRUCTOR_V1_ALLOWED_HREFS.has(item.href));
  }

  // Apply applicant-only allowlist for users whose primary role is APPLICANT
  // and who don't hold a more-elevated role. Keeps the sidebar focused on
  // application status / general portal pages instead of premature instructor
  // tooling (e.g. Lesson Design Studio appearing before approval).
  if (shouldApplyApplicantNavFilter(primaryRole, roles)) {
    visible = visible.filter((item) => APPLICANT_ALLOWED_HREFS.has(item.href));
  }

  const studentMinimalSidebar =
    primaryRole === "STUDENT" && shouldApplyStudentV1NavFilter(primaryRole, input.studentFullPortalExplorer);

  const instructorMinimalSidebar =
    primaryRole === "INSTRUCTOR" &&
    shouldApplyInstructorV1NavFilter(primaryRole, input.instructorFullPortalExplorer);

  const chapterPresidentSidebar = shouldApplyChapterPresidentNavFilter(primaryRole);

  if (studentMinimalSidebar) {
    visible = visible.map(applyStudentMinimalSidebarLayout);
  }

  if (instructorMinimalSidebar) {
    visible = visible.map(applyInstructorMinimalSidebarLayout);
  }

  if (chapterPresidentSidebar) {
    visible = visible.map(applyChapterPresidentMinimalSidebarLayout);
  }

  if (officerLayoutActive) {
    visible = visible.map(applyOfficerNavLayout);
  }

  const visibleByHref = new Map(visible.map((item) => [item.href, item]));

  const coreHrefList =
    hiringDemoHrefs ??
    (studentMinimalSidebar && primaryRole === "STUDENT" ? ["/"] : CORE_NAV_MAP[primaryRole]);

  const core: NavLink[] = [];
  for (const href of coreHrefList) {
    const item = visibleByHref.get(href);
    if (!item || !item.coreEligible) continue;
    addOrReplaceCoreItem(core, item, limit);
  }

  if (!studentMinimalSidebar || primaryRole !== "STUDENT") {
    const skipMessagesPin =
      shouldApplyPublicPreviewSlimNav(primaryRole, roles) && !officerLayoutActive;
    if (!skipMessagesPin) {
      for (const criticalHref of CRITICAL_CORE_LINKS) {
        const item = visibleByHref.get(criticalHref);
        if (!item || !item.coreEligible) continue;
        addOrReplaceCoreItem(core, item, limit);
      }
    }
  }

  if (officerTierUser && !hiringDemoHrefs) {
    for (const criticalHref of OFFICER_CRITICAL_CORE_LINKS) {
      const item = visibleByHref.get(criticalHref);
      if (!item || !item.coreEligible) continue;
      addOrReplaceCoreItem(core, item, limit);
    }
  }

  if (shouldApplyPublicPreviewSlimNav(primaryRole, roles) && !officerLayoutActive) {
    for (const href of getPublicPreviewSlimNavHrefs(primaryRole, roles, adminSubtypes)) {
      const item = visibleByHref.get(href);
      if (!item) continue;
      addOrReplaceCoreItem(core, item, limit);
    }
  }

  const coreHrefs = new Set(core.map((item) => item.href));
  const moreLinks = hiringDemoHrefs
    ? []
    : visible.filter((item) => !coreHrefs.has(item.href));

  const grouped = new Map<NavGroup, NavLink[]>();
  for (const link of moreLinks) {
    const current = grouped.get(link.group);
    if (current) {
      current.push(link);
    } else {
      grouped.set(link.group, [link]);
    }
  }

  // Admin UX: keep chapter-related links inside the same "info/tools" section.
  // This matches the mental model of "one place to find chapter + support surfaces"
  // rather than splitting them across separate "Chapters" and "People & Support" groups.
  if (primaryRole === "ADMIN") {
    const chapters = grouped.get("Chapters");
    if (chapters && chapters.length > 0) {
      const support = grouped.get("People & Support") ?? [];
      grouped.set("People & Support", [...support, ...chapters]);
      grouped.delete("Chapters");
    }
  }

  const groupLabels = orderGroups(primaryRole, Array.from(grouped.keys()));
  const more = groupLabels.map((label) => {
    const items = grouped.get(label) ?? [];
    const sorted =
      studentMinimalSidebar && primaryRole === "STUDENT"
        ? [...items].sort((a, b) => studentMinimalLinkOrderIndex(a.href) - studentMinimalLinkOrderIndex(b.href))
        : instructorMinimalSidebar && primaryRole === "INSTRUCTOR"
          ? [...items].sort(
              (a, b) => instructorMinimalLinkOrderIndex(a.href) - instructorMinimalLinkOrderIndex(b.href),
            )
          : chapterPresidentSidebar
            ? [...items].sort(
                (a, b) =>
                  chapterPresidentMinimalLinkOrderIndex(a.href) -
                  chapterPresidentMinimalLinkOrderIndex(b.href),
              )
            : officerLayoutActive
              ? [...items].sort(
                  (a, b) => officerLinkOrderIndex(a.href) - officerLinkOrderIndex(b.href),
                )
              : items;
    return { label, items: sorted };
  });

  return {
    primaryRole,
    visible,
    core,
    more,
    lockedGroups: unlockLockedGroups ?? undefined,
    officerChrome: officerLayoutActive,
  };
}
