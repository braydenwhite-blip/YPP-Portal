import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";

/**
 * Chapter President navigation.
 *
 * CPs run a chapter, so they get the same plain-noun object sections leadership
 * uses — People · Programs · Meetings · Actions — alongside their chapter
 * operations, instead of a hiring-pipeline-only sidebar. This file is the single
 * source of truth for what a CP sees and how it is grouped, mirroring the
 * student/instructor `v1` layout pattern.
 *
 * Layout: Home · Chapter · People · Programs · Meetings · Actions (+ account).
 */

/** The full set of routes a Chapter President can reach from the sidebar. */
export const CHAPTER_PRESIDENT_ALLOWED_HREFS: ReadonlySet<string> = new Set([
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
  "/my-mentor",
  // Meetings
  "/meetings",
  "/scheduling",
  "/interviews",
  // Actions
  "/actions",
  "/operations/initiatives",
  // Account
  "/notifications",
  "/settings/personalization",
]);

/** Section emoji shown on each sidebar group header. */
export const CHAPTER_PRESIDENT_MINIMAL_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  Chapters: "🏘",
  People: "👥",
  Programs: "🎓",
  Meetings: "📅",
  Actions: "✅",
  "Profile & Settings": "⚙️",
};

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  // Shortcuts (extracted into the "core" row, not shown under a group header)
  "/": { group: "Start Here", label: "Home", icon: "🏠" },
  "/chapter": { group: "Start Here", label: "Chapter Home", icon: "🧭" },

  // Chapter — the day-to-day operating surfaces
  "/chapter/recruiting": { group: "Chapters", label: "Recruiting", icon: "🧑‍💼" },
  "/chapter-lead/instructor-applicants": { group: "Chapters", label: "Applicants", icon: "📝" },
  "/chapter-lead/instructor-readiness": { group: "Chapters", label: "Instructor Readiness", icon: "✅" },
  "/chapter/student-intake": { group: "Chapters", label: "Student Intake", icon: "🧭" },
  "/chapter/calendar": { group: "Chapters", label: "Calendar & Events", icon: "🗓" },
  "/chapter/channels": { group: "Chapters", label: "Channels", icon: "💬" },
  "/chapter/updates": { group: "Chapters", label: "Announcements", icon: "📢" },
  "/chapter/invites": { group: "Chapters", label: "Invite Links", icon: "🔗" },
  "/chapter/marketing": { group: "Chapters", label: "Marketing", icon: "📊" },
  "/chapter/achievements": { group: "Chapters", label: "Milestones", icon: "🏆" },
  "/chapter/leaderboard": { group: "Chapters", label: "XP Leaderboard", icon: "🥇" },

  // People — chapter members and the wider people directory
  "/people": { group: "People", label: "People", icon: "👥" },
  "/chapter/members": { group: "People", label: "Members", icon: "👥" },
  "/chapter/students": { group: "People", label: "Students", icon: "🎓" },
  "/chapter/instructors": { group: "People", label: "Instructors", icon: "👩‍🏫" },

  // Programs — learning, mentorship, pathways
  "/mentorship": { group: "Programs", label: "Mentorship", icon: "🤝" },
  "/curriculum": { group: "Programs", label: "Curriculum", icon: "📖" },
  "/pathways": { group: "Programs", label: "Pathways", icon: "🗺" },
  "/my-mentor": { group: "Programs", label: "My Mentor", icon: "🌱" },

  // Meetings — prepare, run, and follow up
  "/meetings": { group: "Meetings", label: "Meetings", icon: "📅" },
  "/scheduling": { group: "Meetings", label: "Scheduling", icon: "🗓" },
  "/interviews": { group: "Meetings", label: "Interviews", icon: "🎤" },

  // Actions — action items and initiatives
  "/actions": { group: "Actions", label: "Actions", icon: "✅" },
  "/operations/initiatives": { group: "Actions", label: "Initiatives", icon: "🎯" },

  // Account
  "/chapter/settings": { group: "Profile & Settings", label: "Chapter Settings", icon: "⚙️" },
  "/notifications": { group: "Profile & Settings", label: "Notifications", icon: "🔔" },
  "/settings/personalization": { group: "Profile & Settings", label: "Account", icon: "👤" },
};

/** Order of links within the chapter-president sidebar (lower = earlier). */
export const CHAPTER_PRESIDENT_SIDEBAR_LINK_ORDER: string[] = [
  "/",
  "/chapter",
  // Chapter
  "/chapter/recruiting",
  "/chapter-lead/instructor-applicants",
  "/chapter-lead/instructor-readiness",
  "/chapter/student-intake",
  "/chapter/calendar",
  "/chapter/channels",
  "/chapter/updates",
  "/chapter/invites",
  "/chapter/marketing",
  "/chapter/achievements",
  "/chapter/leaderboard",
  // People
  "/people",
  "/chapter/members",
  "/chapter/students",
  "/chapter/instructors",
  // Programs
  "/mentorship",
  "/curriculum",
  "/pathways",
  "/my-mentor",
  // Meetings
  "/meetings",
  "/scheduling",
  "/interviews",
  // Actions
  "/actions",
  "/operations/initiatives",
  // Account
  "/chapter/settings",
  "/notifications",
  "/settings/personalization",
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
