import type { NavGroup, NavLink } from "@/lib/navigation/types";

/** Section emoji in sidebar for focused instructor IA. */
export const INSTRUCTOR_MINIMAL_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  "Start Here": "🏠",
  Teach: "📚",
  Progress: "🎓",
  "People & Support": "📋",
  Chapters: "🏘",
  "Profile & Settings": "👤",
};

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  "/": { group: "Start Here", label: "Home", icon: "🏠" },
  "/instructor-onboarding": { group: "Start Here", label: "Onboarding Guide", icon: "🧭" },
  "/instructor/workspace": { group: "Teach", label: "Workspace", icon: "🧩" },
  "/instructor/curriculum-builder": { group: "Teach", label: "Curriculum Builder", icon: "🛠" },
  "/lesson-plans": { group: "Teach", label: "Lesson Plans", icon: "📝" },
  "/instructor/class-settings": { group: "Teach", label: "Class Settings", icon: "⚙️" },
  "/instructor-training": { group: "Progress", label: "Instructor Training", icon: "🎓" },
  "/instructor/lesson-design-studio": { group: "Progress", label: "Lesson Design Studio", icon: "🎨" },
  "/instructor/workshop-design-studio": { group: "Progress", label: "Workshop Design Studio", icon: "🎒" },
  "/leadership-pathway": { group: "People & Support", label: "Leadership Pathway", icon: "🪜" },
  "/attendance": { group: "People & Support", label: "Attendance", icon: "📋" },
  "/instructor/parent-feedback": { group: "People & Support", label: "Parent Feedback", icon: "💬" },
  "/feedback/anonymous": { group: "People & Support", label: "Anonymous Feedback", icon: "🛡️" },
  "/scheduling": { group: "People & Support", label: "Scheduling Hub", icon: "🗓" },
  "/announcements": { group: "People & Support", label: "Updates", icon: "📢" },
  "/notifications": { group: "Profile & Settings", label: "Notifications", icon: "🔔" },
  "/calendar": { group: "People & Support", label: "Calendar", icon: "🗓" },
  "/mentorship": { group: "People & Support", label: "Mentorship", icon: "🌱" },
  "/my-mentor": { group: "People & Support", label: "My Mentor", icon: "🤝" },
  "/chapters": { group: "Chapters", label: "Chapter", icon: "🏘" },
  "/settings/personalization": { group: "Profile & Settings", label: "Account", icon: "⚙️" },
};

/** Order of links within the instructor minimal sidebar (lower = earlier). */
export const INSTRUCTOR_SIDEBAR_LINK_ORDER: string[] = [
  "/instructor-onboarding",
  "/instructor/workspace",
  "/instructor/curriculum-builder",
  "/lesson-plans",
  "/instructor/class-settings",
  "/instructor-training",
  "/instructor/lesson-design-studio",
  "/instructor/workshop-design-studio",
  "/leadership-pathway",
  "/attendance",
  "/instructor/parent-feedback",
  "/feedback/anonymous",
  "/scheduling",
  "/announcements",
  "/calendar",
  "/mentorship",
  "/my-mentor",
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
