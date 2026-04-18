import type { NavGroup, NavLink } from "@/lib/navigation/types";

/** Section emoji in sidebar for focused instructor IA. */
export const INSTRUCTOR_MINIMAL_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  "Start Here": "🏠",
  Progress: "🎓",
  "People & Support": "📋",
  Chapters: "🏘",
  "Profile & Settings": "👤",
};

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  "/": { group: "Start Here", label: "Home", icon: "🏠" },
  "/instructor-training": { group: "Progress", label: "Instructor Training", icon: "🎓" },
  "/instructor/lesson-design-studio": { group: "Progress", label: "Lesson Design Studio", icon: "🎨" },
  "/attendance": { group: "People & Support", label: "Attendance", icon: "📋" },
  "/instructor/parent-feedback": { group: "People & Support", label: "Parent Feedback", icon: "💬" },
  "/feedback/anonymous": { group: "People & Support", label: "Anonymous Feedback", icon: "🛡️" },
  "/scheduling": { group: "People & Support", label: "Scheduling Hub", icon: "🗓" },
  "/announcements": { group: "People & Support", label: "Updates", icon: "📢" },
  "/notifications": { group: "Profile & Settings", label: "Notifications", icon: "🔔" },
  "/calendar": { group: "People & Support", label: "Calendar", icon: "🗓" },
  "/my-program": { group: "People & Support", label: "Mentorship & Program", icon: "🤝" },
  "/messages": { group: "People & Support", label: "Messages", icon: "✉" },
  "/chapters": { group: "Chapters", label: "Chapter", icon: "🏘" },
  "/settings/personalization": { group: "Profile & Settings", label: "Account", icon: "⚙️" },
};

/** Order of links within the instructor minimal sidebar (lower = earlier). */
export const INSTRUCTOR_SIDEBAR_LINK_ORDER: string[] = [
  "/instructor-training",
  "/instructor/lesson-design-studio",
  "/attendance",
  "/instructor/parent-feedback",
  "/feedback/anonymous",
  "/scheduling",
  "/announcements",
  "/calendar",
  "/my-program",
  "/messages",
  "/chapters",
  "/settings/personalization",
  "/notifications",
];

export function instructorMinimalLinkOrderIndex(href: string): number {
  const i = INSTRUCTOR_SIDEBAR_LINK_ORDER.indexOf(href);
  return i === -1 ? 9999 : i;
}

export function applyInstructorMinimalSidebarLayout(link: NavLink): NavLink {
  const mapped = SIDEBAR_BY_HREF[link.href];
  if (!mapped) return link;
  return {
    ...link,
    group: mapped.group,
    label: mapped.label,
    icon: mapped.icon,
  };
}
