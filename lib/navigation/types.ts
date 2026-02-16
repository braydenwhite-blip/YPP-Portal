export type NavRole =
  | "ADMIN"
  | "CHAPTER_LEAD"
  | "INSTRUCTOR"
  | "MENTOR"
  | "PARENT"
  | "STAFF"
  | "STUDENT";

export type NavBadgeKey = "notifications" | "messages" | "approvals";

export type NavGroup =
  | "Family"
  | "Start Here"
  | "Learning"
  | "Progress"
  | "Challenges"
  | "Projects"
  | "Opportunities"
  | "People & Support"
  | "Chapters"
  | "Profile & Settings"
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
  priority: number;
  coreEligible: boolean;
  badgeKey?: NavBadgeKey;
  searchAliases?: string[];
  requiresAward?: boolean;
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
