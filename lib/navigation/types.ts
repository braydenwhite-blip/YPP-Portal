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
  | "Main"
  | "Learning"
  | "Growth"
  | "Challenges"
  | "Incubator"
  | "Opportunities"
  | "Community"
  | "Chapters"
  | "Account"
  | "Admin: People"
  | "Admin: Content"
  | "Admin: Reports"
  | "Admin: Ops";

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
