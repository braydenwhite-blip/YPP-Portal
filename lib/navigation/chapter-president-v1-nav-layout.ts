import type { NavGroup, NavLink, NavRole } from "@/lib/navigation/types";

/**
 * Chapter President navigation.
 *
 * CPs run a chapter — they need direct, one-click access to their operating
 * tools, not a hiring-pipeline-only sidebar. This file is the single source of
 * truth for what a CP sees and how it is grouped, mirroring the student/
 * instructor `v1` layout pattern.
 */

/** The full set of routes a Chapter President can reach from the sidebar. */
export const CHAPTER_PRESIDENT_ALLOWED_HREFS: ReadonlySet<string> = new Set([
  "/",
  "/chapter",
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
  "/interviews",
  "/scheduling",
  "/mentorship",
  "/my-mentor",
  "/chapter/invites",
  "/chapter/marketing",
  "/chapter/achievements",
  "/chapter/leaderboard",
  "/chapter/settings",
  "/messages",
  "/notifications",
  "/settings/personalization",
]);

/** Section emoji shown on each sidebar group header. */
export const CHAPTER_PRESIDENT_MINIMAL_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  Chapters: "🏘",
  Recruiting: "🎯",
  Growth: "📈",
  "Profile & Settings": "⚙️",
};

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  // Shortcuts (extracted into the "core" row, not shown under a group header)
  "/": { group: "Start Here", label: "Home", icon: "🏠" },
  "/chapter": { group: "Start Here", label: "Chapter Home", icon: "🧭" },

  // Chapter — the day-to-day operating surfaces
  "/chapter/members": { group: "Chapters", label: "Members", icon: "👥" },
  "/chapter/students": { group: "Chapters", label: "Students", icon: "🎓" },
  "/chapter/instructors": { group: "Chapters", label: "Instructors", icon: "👩‍🏫" },
  "/chapter/calendar": { group: "Chapters", label: "Calendar & Events", icon: "🗓" },
  "/chapter/channels": { group: "Chapters", label: "Channels", icon: "💬" },
  "/chapter/updates": { group: "Chapters", label: "Announcements", icon: "📢" },

  // Recruiting — building the chapter team
  "/chapter/recruiting": { group: "Recruiting", label: "Recruiting", icon: "🧑‍💼" },
  "/chapter-lead/instructor-applicants": { group: "Recruiting", label: "Applicants", icon: "📝" },
  "/chapter-lead/instructor-readiness": { group: "Recruiting", label: "Instructor Readiness", icon: "✅" },
  "/chapter/student-intake": { group: "Recruiting", label: "Student Intake", icon: "🧭" },
  "/interviews": { group: "Recruiting", label: "Interviews", icon: "🎤" },
  "/scheduling": { group: "Recruiting", label: "Scheduling Hub", icon: "🗓" },
  "/mentorship": { group: "Growth", label: "Mentorship", icon: "🤝" },
  "/my-mentor": { group: "Growth", label: "My Mentor", icon: "🤝" },

  // Growth — momentum, outreach, recognition
  "/chapter/invites": { group: "Growth", label: "Invite Links", icon: "🔗" },
  "/chapter/marketing": { group: "Growth", label: "Marketing", icon: "📊" },
  "/chapter/achievements": { group: "Growth", label: "Milestones", icon: "🏆" },
  "/chapter/leaderboard": { group: "Growth", label: "XP Leaderboard", icon: "🥇" },

  // Account
  "/chapter/settings": { group: "Profile & Settings", label: "Chapter Settings", icon: "⚙️" },
  "/messages": { group: "Profile & Settings", label: "Messages", icon: "✉" },
  "/notifications": { group: "Profile & Settings", label: "Notifications", icon: "🔔" },
  "/settings/personalization": { group: "Profile & Settings", label: "Account", icon: "👤" },
};

/** Order of links within the chapter-president sidebar (lower = earlier). */
export const CHAPTER_PRESIDENT_SIDEBAR_LINK_ORDER: string[] = [
  "/",
  "/chapter",
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
  "/interviews",
  "/scheduling",
  "/mentorship",
  "/my-mentor",
  "/chapter/invites",
  "/chapter/marketing",
  "/chapter/achievements",
  "/chapter/leaderboard",
  "/chapter/settings",
  "/messages",
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
