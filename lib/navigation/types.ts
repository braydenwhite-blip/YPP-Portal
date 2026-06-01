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
