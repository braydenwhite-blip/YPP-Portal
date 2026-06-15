import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";

/**
 * Officer (leadership) navigation layout — the YPP operating system.
 *
 * Admins, staff, and hiring chairs run the whole organization, so their sidebar
 * is organized into one coherent set of human-readable sections instead of a
 * pile of separate tools:
 *
 *   Command   — Home, what needs attention, the Help Agent
 *   Work      — all work: actions, meetings, initiatives, follow-ups
 *   People    — the people directory, instructors, applicants, reviews
 *   Programs  — classes, curriculum, training, chapters
 *   Partners  — partner relationships and the partner pipeline
 *   Data      — Data 360 and organizational memory
 *   Admin     — configuration, imports, analytics, settings
 *
 * This file is the single source of truth for how officer links are grouped,
 * labeled, and ordered, mirroring the student / instructor / chapter-president
 * `v1` layout pattern (group/label/icon remap applied in resolveNavModel). It
 * never adds or removes routes — every href below is a real catalog entry that
 * already passed role + feature gating; we only re-skin it for the leadership
 * mental model. Links that aren't mapped here keep their catalog group and fall
 * into the (collapsed) sections below the operating-system groups.
 */

/** Officer roles that get the leadership operating-system sidebar. */
const OFFICER_LAYOUT_ROLES: ReadonlySet<NavRole> = new Set<NavRole>([
  "ADMIN",
  "STAFF",
  "HIRING_CHAIR",
]);

/** Section emoji shown on each officer sidebar group header. */
export const OFFICER_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  Command: "🧭",
  Work: "🎛️",
  People: "👥",
  Programs: "🎓",
  Partners: "🤝",
  Data: "🧠",
  Admin: "🛠",
};

/**
 * Hidden-from-everyone-else hrefs that officers should still reach directly from
 * the Work section (the rest of the org gets to them through in-page subnav).
 * resolveNavModel un-hides only these specific routes for officer layouts.
 */
export const OFFICER_UNHIDE_HREFS: ReadonlySet<string> = new Set<string>([
  "/actions/meetings",
  "/actions/all",
  "/actions/responsibility",
]);

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  // Command — start your day here
  "/": { group: "Command", label: "Home", icon: "▣" },
  "/operations": { group: "Command", label: "Needs Attention", icon: "🧭" },
  "/help-agent": { group: "Command", label: "Help Agent", icon: "🔎" },
  "/announcements": { group: "Command", label: "Updates", icon: "📢" },

  // Work — everything that needs doing, in one place
  "/work": { group: "Work", label: "Work", icon: "🎛️" },
  "/actions": { group: "Work", label: "Actions", icon: "✅" },
  "/operations/initiatives": { group: "Work", label: "Initiatives", icon: "🎯" },
  "/actions/meetings": { group: "Work", label: "Meetings", icon: "📅" },
  "/actions/all": { group: "Work", label: "All Actions", icon: "🗂️" },
  "/actions/responsibility": { group: "Work", label: "Responsibility Map", icon: "🗺️" },
  "/scheduling": { group: "Work", label: "Scheduling", icon: "🗓" },

  // People — find anyone, run leadership & review workflows
  "/people": { group: "People", label: "People", icon: "👥" },
  "/admin/instructors": { group: "People", label: "Instructors", icon: "👩‍🏫" },
  "/admin/instructor-applicants": { group: "People", label: "Applicants", icon: "📝" },
  "/admin/instructor-applicants/chair-queue": { group: "People", label: "Hiring Chair Queue", icon: "⚖️" },
  "/admin/students": { group: "People", label: "Students", icon: "🎓" },
  "/admin/leadership": { group: "People", label: "Leadership Roles", icon: "🏛️" },
  "/admin/parent-feedback": { group: "People", label: "Feedback", icon: "💬" },
  "/interviews": { group: "People", label: "Interviews", icon: "🎤" },
  "/positions": { group: "People", label: "Open Positions", icon: "📌" },

  // Programs — classes, curriculum, training, chapters
  "/admin/classes": { group: "Programs", label: "Classes", icon: "🏫" },
  "/admin/programs": { group: "Programs", label: "Programs", icon: "📦" },
  "/curriculum": { group: "Programs", label: "Curriculum", icon: "📖" },
  "/admin/curricula": { group: "Programs", label: "Curriculum Review", icon: "📝" },
  "/admin/training": { group: "Programs", label: "Training", icon: "🎒" },
  "/instructor-onboarding": { group: "Programs", label: "Instructor Orientation", icon: "🧭" },
  "/chapter/hub": { group: "Programs", label: "Chapters", icon: "🏘" },
  "/pathways": { group: "Programs", label: "Pathways", icon: "🗺" },

  // Partners — external relationships
  "/partners": { group: "Partners", label: "Partner Directory", icon: "🤝" },
  "/admin/partners": { group: "Partners", label: "Partner Pipeline", icon: "📊" },

  // Data — connected knowledge & organizational memory
  "/operations/data-360": { group: "Data", label: "Data 360", icon: "🧠" },

  // Admin — configuration only
  "/admin": { group: "Admin", label: "Administration", icon: "🛠" },
  "/admin/bulk-users": { group: "Admin", label: "Imports & Users", icon: "👥" },
  "/admin/analytics": { group: "Admin", label: "Analytics", icon: "📈" },
  "/settings/personalization": { group: "Admin", label: "Settings", icon: "⚙️" },
  "/notifications": { group: "Admin", label: "Notifications", icon: "🔔" },
};

/** Order of links within the officer sidebar (lower = earlier). */
export const OFFICER_SIDEBAR_LINK_ORDER: string[] = [
  // Command
  "/",
  "/operations",
  "/help-agent",
  "/announcements",
  // Work
  "/work",
  "/actions",
  "/operations/initiatives",
  "/actions/meetings",
  "/actions/all",
  "/actions/responsibility",
  "/scheduling",
  // People
  "/people",
  "/admin/instructors",
  "/admin/instructor-applicants",
  "/admin/instructor-applicants/chair-queue",
  "/admin/students",
  "/admin/leadership",
  "/admin/parent-feedback",
  "/interviews",
  "/positions",
  // Programs
  "/admin/classes",
  "/admin/programs",
  "/curriculum",
  "/admin/curricula",
  "/admin/training",
  "/instructor-onboarding",
  "/chapter/hub",
  "/pathways",
  // Partners
  "/partners",
  "/admin/partners",
  // Data
  "/operations/data-360",
  // Admin
  "/admin",
  "/admin/bulk-users",
  "/admin/analytics",
  "/settings/personalization",
  "/notifications",
];

/** Officer group order: the operating-system sections first, personal/long-tail last. */
export const OFFICER_GROUP_ORDER: NavGroup[] = [
  "Command",
  "Work",
  "People",
  "Programs",
  "Partners",
  "Data",
  "Admin",
  // Long-tail / personal surfaces stay reachable but collapsed below the OS.
  "Start Here",
  "Learning",
  "Progress",
  "Recruiting",
  "Growth",
  "People & Support",
  "Chapters",
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
 * Whether the leadership operating-system layout applies. True for admins,
 * staff, and hiring chairs (chapter presidents have their own chapter-scoped
 * layout, applicants/students/instructors have their own minimal navs).
 */
export function shouldApplyOfficerNavLayout(primaryRole: NavRole): boolean {
  return OFFICER_LAYOUT_ROLES.has(primaryRole);
}
