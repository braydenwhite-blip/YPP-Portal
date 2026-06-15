import type { FeatureKey } from "@/lib/feature-gate-constants";

export type NavRole =
  | "ADMIN"
  | "APPLICANT"
  | "CHAPTER_PRESIDENT"
  | "HIRING_CHAIR"
  | "INSTRUCTOR"
  | "MENTOR"
  | "PARENT"
  | "STAFF"
  | "STUDENT";

export type NavBadgeKey = "notifications" | "messages" | "approvals" | "chairQueueCount";

export type NavGroup =
  | "Family"
  | "Start Here"
  | "Teach"
  | "Learning"
  | "Progress"
  | "Challenges"
  | "Projects"
  | "Opportunities"
  | "People & Support"
  | "Chapters"
  | "Recruiting"
  | "Growth"
  | "Profile & Settings"
  | "Schedule"
  | "Community"
  | "Profile"
  // Officer operating-system sections (Start → Work → Modes → People → Programs →
  // Partners → Data → Admin). These are the human-readable groups the leadership
  // sidebar is organized into; see lib/navigation/officer-nav-layout.ts.
  // "Start" holds the three primary choices (Command Center · My Queue · Browse);
  // "Modes" holds the demoted operating modes (Decide · Delegate · Meet · Review ·
  // Follow Up), collapsed by default. "Command" is retained for back-compat.
  | "Command"
  | "Start"
  | "Modes"
  | "Work"
  | "People"
  | "Programs"
  | "Partners"
  | "Data"
  | "Admin"
  | "Admin People"
  | "Admin Content"
  | "Admin Reports"
  | "Admin Operations";

export interface NavLink {
  href: string;
  label: string;
  icon: string;
  group: NavGroup;
  roles?: NavRole[];
  /** When set, hide this link if the resolved primary nav role matches any entry. */
  hideForPrimaryRoles?: NavRole[];
  priority: number;
  coreEligible: boolean;
  badgeKey?: NavBadgeKey;
  searchAliases?: string[];
  requiresAward?: boolean;
  /**
   * When true, only INSTRUCTOR-role users with `instructorSubtype === "SUMMER_WORKSHOP"`
   * see this link. Used for SW-specific surfaces (e.g. Workshop Design Studio)
   * that we do not want to expose to full-track instructors or to applicants.
   */
  requiresSummerWorkshopSubtype?: boolean;
  /**
   * When true, this link is only shown while the People Strategy Action Tracker
   * is enabled (env `ENABLE_ACTION_TRACKER`). Threaded from the server layout —
   * no per-user feature-gate / admin bypass applies, so the link is fully
   * hidden for everyone when the flag is off.
   */
  requiresActionTracker?: boolean;
  /**
   * When true, this link is only shown while the Student Operating System /
   * Growth Engine is enabled (env `ENABLE_GROWTH_OS`). Threaded from the server
   * layout — the link is fully hidden for everyone when the flag is off, so the
   * dark-launched `/my-growth` route is never a 404 in the sidebar.
   */
  requiresGrowthOs?: boolean;
  /**
   * When true, this link is only shown while the People Strategy Operations Hub
   * is enabled (env `ENABLE_OPERATIONS_HUB`). Threaded from the server layout —
   * no per-user feature-gate / admin bypass applies, so the link is fully
   * hidden for everyone when the flag is off.
   */
  requiresOperationsHub?: boolean;
  /**
   * Temporary deprecation gate for the older Leadership Action Center nav item.
   * The underlying routes stay reachable until migration/backfill is complete.
   */
  requiresLegacyActionCenterNav?: boolean;
  featureKey?: FeatureKey;
  dashboardDescription?: string;
  dashboardBadgeKey?: string;
  dashboardPriority?: number;
}

export interface NavGroupView {
  label: NavGroup;
  items: NavLink[];
}

export interface NavViewModel {
  primaryRole: NavRole;
  visible: NavLink[];
  core: NavLink[];
  more: NavGroupView[];
}
