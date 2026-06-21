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
  // Leadership sidebar sections — the nine real-world YPP objects the officer
  // nav is organized into (Home is a pinned link, not a group). See
  // lib/navigation/officer-nav-layout.ts. These plain-noun sections replaced the
  // old "operating system" model (Start / Work / Modes / Command / Data), whose
  // labels are retained below only for back-compat with code that still imports
  // them — they are no longer used by the officer layout.
  | "People"
  | "Programs"
  | "Meetings"
  | "Actions"
  | "Applicants"
  | "Partners"
  | "Admin"
  // Deprecated officer "operating system" groups (no longer used by the layout;
  // kept in the union so older references still compile).
  | "Command"
  | "Start"
  | "Modes"
  | "More"
  | "Work"
  | "Data"
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
