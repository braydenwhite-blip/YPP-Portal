import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";

/**
 * Officer (leadership) navigation layout — organized around real YPP objects.
 *
 * Admins, staff, and hiring chairs run the whole organization. Instead of a pile
 * of separate operating "modes" (the old Work hub, Command Center, My Queue,
 * Browse, Decisions, Owners, Weekly Review, Meet), the sidebar is now a small,
 * obvious set of plain-noun sections — one home per thing people actually look
 * for:
 *
 *   Home        — the pinned starting point ("what do I need to know or do today")
 *   People      — find and understand any person
 *   Programs    — classes, cohorts, mentorship, advising, reviews, instructor dev
 *   Meetings    — find, prep, run, and follow up on meetings
 *   Actions     — every action item in one place
 *   Applicants  — application review workflows
 *   Partners    — partner & organization relationships
 *   Chapters    — chapter operations
 *   Admin       — true configuration (users, settings)
 *
 * This file is the single source of truth for how officer links are grouped,
 * labeled, and ordered, mirroring the student / instructor / chapter-president
 * `v1` layout pattern (group/label/icon remap applied in resolveNavModel). It
 * never adds or removes routes — every href below is a real catalog entry that
 * already passed role + feature gating; we only re-skin it into the section
 * model. Links that aren't mapped here keep their catalog group and fall into
 * the (collapsed) long-tail sections below.
 */

/** Officer roles that get the leadership section sidebar. */
const OFFICER_LAYOUT_ROLES: ReadonlySet<NavRole> = new Set<NavRole>([
  "ADMIN",
  "STAFF",
  "HIRING_CHAIR",
]);

/**
 * The eight object sections, shown expanded by default so the whole toolset is
 * visible at a glance. (Home is a pinned core link, not a group.) Personal /
 * long-tail sections (Profile & Settings, etc.) stay collapsed beneath these.
 */
export const OFFICER_PRIMARY_GROUPS: ReadonlySet<NavGroup> = new Set<NavGroup>([
  "People",
  "Programs",
  "Meetings",
  "Actions",
  "Applicants",
  "Partners",
  "Chapters",
  "Admin",
]);

/** Section emoji shown on each officer sidebar group header. */
export const OFFICER_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  People: "👥",
  Programs: "🎓",
  Meetings: "📅",
  Actions: "✅",
  Applicants: "📝",
  Partners: "🤝",
  Chapters: "🏘",
  Admin: "🛠",
};

/**
 * Hrefs that sit in ALWAYS_HIDDEN_HREFS (to keep other roles' sidebars compact)
 * but that officers should reach directly from their sections. resolveNavModel
 * un-hides only these specific routes for the officer layout.
 */
export const OFFICER_UNHIDE_HREFS: ReadonlySet<string> = new Set<string>([
  "/actions/all",
  "/actions/responsibility",
  "/admin/chapters",
]);

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  // People — find and understand any person.
  "/people": { group: "People", label: "People", icon: "👥" },
  "/admin/instructors": { group: "People", label: "Instructors", icon: "👩‍🏫" },
  "/admin/students": { group: "People", label: "Students", icon: "🎓" },
  "/admin/leadership": { group: "People", label: "Leadership Roles", icon: "🏛️" },
  "/admin/parent-feedback": { group: "People", label: "Parent Feedback", icon: "💬" },
  "/operations/advising": { group: "People", label: "Advising Center", icon: "🧭" },
  "/operations/instructor-pairing": { group: "People", label: "Instructor Pairing", icon: "🧩" },
  "/operations/data-360": { group: "People", label: "Connected Data", icon: "🧠" },
  "/operations": { group: "People", label: "Operations", icon: "🗺️" },

  // Programs — operate classes, cohorts, mentorship, advising, reviews, dev.
  "/admin/classes": { group: "Programs", label: "Classes", icon: "🏫" },
  "/admin/programs": { group: "Programs", label: "Programs", icon: "📦" },
  "/curriculum": { group: "Programs", label: "Curriculum", icon: "📖" },
  "/admin/curricula": { group: "Programs", label: "Curriculum Review", icon: "📝" },
  "/admin/training": { group: "Programs", label: "Training", icon: "🎒" },
  "/pathways": { group: "Programs", label: "Pathways", icon: "🗺" },

  // Meetings — one umbrella front door for prep, run, and follow-up.
  "/meetings": { group: "Meetings", label: "Meetings", icon: "📅" },
  "/scheduling": { group: "Meetings", label: "Scheduling", icon: "🗓" },

  // Actions — every action item in one place.
  "/actions": { group: "Actions", label: "Actions", icon: "✅" },
  "/operations/initiatives": { group: "Actions", label: "Initiatives", icon: "🎯" },
  "/follow-up": { group: "Actions", label: "Follow Ups", icon: "🔔" },
  "/delegate": { group: "Actions", label: "Owners", icon: "🤝" },
  "/actions/all": { group: "Actions", label: "All Actions", icon: "🗂️" },
  "/actions/responsibility": { group: "Actions", label: "Responsibility Map", icon: "🗺️" },

  // Applicants — application review workflows.
  "/admin/instructor-applicants": { group: "Applicants", label: "Applicants", icon: "📝" },
  "/interviews": { group: "Applicants", label: "Interviews", icon: "🎤" },
  "/positions": { group: "Applicants", label: "Open Positions", icon: "📌" },

  // Partners — partner & organization relationships.
  "/partners": { group: "Partners", label: "Partner Directory", icon: "🤝" },
  "/admin/partners": { group: "Partners", label: "Partner Pipeline", icon: "📊" },

  // Chapters — chapter operations.
  "/chapter/hub": { group: "Chapters", label: "Chapter Hub", icon: "🏘" },
  "/admin/chapters": { group: "Chapters", label: "Chapter Directory", icon: "🏢" },
  "/admin/chapter-reports": { group: "Chapters", label: "Chapter Reports", icon: "📊" },

  // Admin — true configuration & utilities.
  "/admin": { group: "Admin", label: "Administration", icon: "🛠" },
  "/admin/bulk-users": { group: "Admin", label: "Imports & Users", icon: "👥" },
  "/admin/analytics": { group: "Admin", label: "Analytics", icon: "📈" },
  "/help-agent": { group: "Admin", label: "Help Agent", icon: "🔎" },
  "/announcements": { group: "Admin", label: "Updates", icon: "📢" },
  "/settings/personalization": { group: "Admin", label: "Settings", icon: "⚙️" },
  "/notifications": { group: "Admin", label: "Notifications", icon: "🔔" },
};

/** Order of links within the officer sidebar (lower = earlier). */
export const OFFICER_SIDEBAR_LINK_ORDER: string[] = [
  // People
  "/people",
  "/admin/instructors",
  "/admin/students",
  "/admin/leadership",
  "/admin/parent-feedback",
  "/operations/advising",
  "/operations/instructor-pairing",
  "/operations/data-360",
  "/operations",
  // Programs
  "/admin/classes",
  "/admin/programs",
  "/curriculum",
  "/admin/curricula",
  "/admin/training",
  "/pathways",
  // Meetings
  "/meetings",
  "/scheduling",
  // Actions
  "/actions",
  "/operations/initiatives",
  "/follow-up",
  "/delegate",
  "/actions/all",
  "/actions/responsibility",
  // Applicants
  "/admin/instructor-applicants",
  "/interviews",
  "/positions",
  // Partners
  "/partners",
  "/admin/partners",
  // Chapters
  "/chapter/hub",
  "/admin/chapters",
  "/admin/chapter-reports",
  // Admin
  "/admin",
  "/admin/bulk-users",
  "/admin/analytics",
  "/help-agent",
  "/announcements",
  "/settings/personalization",
  "/notifications",
];

/** Officer group order: the eight object sections first, personal / long-tail last. */
export const OFFICER_GROUP_ORDER: NavGroup[] = [
  "People",
  "Programs",
  "Meetings",
  "Actions",
  "Applicants",
  "Partners",
  "Chapters",
  "Admin",
  // Long-tail / personal surfaces stay reachable but collapsed below the sections.
  "Start Here",
  "Learning",
  "Progress",
  "Recruiting",
  "Growth",
  "People & Support",
  "Opportunities",
  "Schedule",
  "Community",
  "Teach",
  "Projects",
  "Challenges",
  "Profile",
  "Profile & Settings",
  "Family",
  "Admin People",
  "Admin Content",
  "Admin Reports",
  "Admin Operations",
  // Retired operating-system groups (kept for back-compat; normally empty).
  "Start",
  "Work",
  "More",
  "Modes",
  "Command",
  "Data",
];

export function officerLinkOrderIndex(href: string): number {
  const index = OFFICER_SIDEBAR_LINK_ORDER.indexOf(href);
  return index === -1 ? 9999 : index;
}

export function applyOfficerNavLayout(link: NavLink): NavLink {
  const mapped = SIDEBAR_BY_HREF[link.href];
  if (!mapped) return link;
  return {
    ...link,
    group: mapped.group,
    label: mapped.label,
    icon: mapped.icon,
  };
}

/**
 * Whether the leadership section layout applies. True for admins, staff, and
 * hiring chairs (chapter presidents have their own chapter-scoped layout,
 * applicants/students/instructors have their own minimal navs).
 */
export function shouldApplyOfficerNavLayout(primaryRole: NavRole): boolean {
  return OFFICER_LAYOUT_ROLES.has(primaryRole);
}
