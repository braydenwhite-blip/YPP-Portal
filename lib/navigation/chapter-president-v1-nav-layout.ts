import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";
import { isLeadershipFullPortalExplorerEnabled } from "@/lib/navigation/leadership-simple-nav";

/**
 * Chapter President navigation.
 *
 * Shipped: Dashboard Â· Onboarding Â· Chapter Goals & Resources Â· Recruiting
 * (the 4 approved CP Portal pages).
 *
 * Full explorer (`LEADERSHIP_FULL_PORTAL_EXPLORER=true`): chapter ops + People Â·
 * Programs Â· Actions sections for local testing.
 */

/** Shipped CP sidebar â€” the 4 approved pages only. */
export const CHAPTER_PRESIDENT_SIMPLE_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/chapter",
  "/chapter/onboarding",
  "/chapter/resources",
  "/chapter/recruiting",
]);

/** Full CP sidebar used when the leadership explorer flag is on. */
export const CHAPTER_PRESIDENT_FULL_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/chapter",
  // Chapter operations
  "/chapter/members",
  "/chapter/students",
  "/chapter/instructors",
  "/chapter/calendar",
  "/chapter/channels",
  "/chapter/updates",
  "/chapter/recruiting",
  "/chapter-lead/instructor-applicants",
  "/chapter-lead/instructor-readiness",
  "/chapter/student-intake",
  "/chapter/invites",
  "/chapter/marketing",
  "/chapter/achievements",
  "/chapter/leaderboard",
  "/chapter/settings",
  // People
  "/people",
  // Programs
  "/mentorship",
  "/curriculum",
  "/pathways",
  // Actions
  "/actions",
  "/operations/initiatives",
  // Account
  "/notifications",
  "/settings/personalization",
]);

/** @deprecated Prefer {@link chapterPresidentAllowedHrefs}. */
export const CHAPTER_PRESIDENT_ALLOWED_HREFS = CHAPTER_PRESIDENT_SIMPLE_ALLOWED_HREFS;

export function chapterPresidentAllowedHrefs(
  leadershipFullPortalExplorer?: boolean,
): ReadonlySet<string> {
  const fullExplorer =
    leadershipFullPortalExplorer !== undefined
      ? leadershipFullPortalExplorer
      : isLeadershipFullPortalExplorerEnabled();
  return fullExplorer
    ? CHAPTER_PRESIDENT_FULL_ALLOWED_HREFS
    : CHAPTER_PRESIDENT_SIMPLE_ALLOWED_HREFS;
}

/** Section labels shown on each sidebar group header. No emoji per Portal Rules. */
export const CHAPTER_PRESIDENT_MINIMAL_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {};

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  "/chapter": { group: "Start Here", label: "Dashboard", icon: "" },
  "/chapter/onboarding": { group: "Start Here", label: "Onboarding", icon: "" },
  "/chapter/resources": { group: "Start Here", label: "Chapter Goals & Resources", icon: "" },
  "/chapter/recruiting": { group: "Start Here", label: "Recruiting", icon: "" },
};

/** Order of links within the chapter-president sidebar (lower = earlier). */
export const CHAPTER_PRESIDENT_SIDEBAR_LINK_ORDER: string[] = [
  "/chapter",
  "/chapter/onboarding",
  "/chapter/resources",
  "/chapter/recruiting",
];

export function chapterPresidentMinimalLinkOrderIndex(href: string): number {
  const index = CHAPTER_PRESIDENT_SIDEBAR_LINK_ORDER.indexOf(href);
  return index === -1 ? 9999 : index;
}

export function applyChapterPresidentMinimalSidebarLayout(link: NavLink): NavLink {
  const mapped = SIDEBAR_BY_HREF[link.href];
  if (!mapped) return link;
  return {
    ...link,
    group: mapped.group,
    label: mapped.label,
    icon: mapped.icon,
  };
}

export function shouldApplyChapterPresidentNavFilter(primaryRole: NavRole): boolean {
  return primaryRole === "CHAPTER_PRESIDENT";
}