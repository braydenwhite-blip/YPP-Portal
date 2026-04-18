import type { NavGroup, NavLink } from "@/lib/navigation/types";

/** Section emoji in sidebar (group header), matching student v1 IA. */
export const STUDENT_MINIMAL_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  Learning: "📚",
  Progress: "🎯",
  Schedule: "🗓",
  Community: "💬",
  Profile: "👤",
};

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  "/": { group: "Start Here", label: "Home", icon: "🏠" },
  "/my-classes": { group: "Learning", label: "My classes", icon: "🎓" },
  "/my-classes/assignments": { group: "Learning", label: "Assignments", icon: "📝" },
  "/curriculum": { group: "Learning", label: "Browse classes", icon: "📖" },
  "/pathways": { group: "Learning", label: "Pathways", icon: "🗺" },
  "/goals": { group: "Progress", label: "Goals", icon: "🎯" },
  "/pathways/progress": { group: "Progress", label: "Progress", icon: "📈" },
  "/my-program": { group: "Progress", label: "Program hub", icon: "🧭" },
  "/curriculum/schedule": { group: "Schedule", label: "Schedule", icon: "📅" },
  "/events": { group: "Schedule", label: "Events", icon: "📅" },
  "/calendar": { group: "Schedule", label: "Calendar", icon: "🗓" },
  "/events/map": { group: "Schedule", label: "Map", icon: "🗺" },
  "/messages": { group: "Community", label: "Messages", icon: "✉" },
  "/my-chapter": { group: "Community", label: "Chapter", icon: "🏘" },
  "/chapters": { group: "Community", label: "Find chapters", icon: "🔍" },
  "/join-chapter": { group: "Community", label: "Join a chapter", icon: "🤝" },
  "/positions": { group: "Community", label: "Open positions", icon: "💼" },
  "/applications": { group: "Community", label: "Applications", icon: "📨" },
  "/announcements": { group: "Community", label: "Updates", icon: "📢" },
  "/profile/timeline": { group: "Profile", label: "Journey", icon: "🛤" },
  "/settings/personalization": { group: "Profile", label: "Profile & settings", icon: "👤" },
  "/notifications": { group: "Profile", label: "Notifications", icon: "🔔" },
  "/student-training": { group: "Learning", label: "Training", icon: "🏫" },
};

/** Order of links within the student minimal sidebar (lower = earlier). */
export const STUDENT_SIDEBAR_LINK_ORDER: string[] = [
  "/my-classes",
  "/my-classes/assignments",
  "/curriculum",
  "/pathways",
  "/student-training",
  "/goals",
  "/pathways/progress",
  "/my-program",
  "/curriculum/schedule",
  "/events",
  "/calendar",
  "/events/map",
  "/messages",
  "/my-chapter",
  "/chapters",
  "/join-chapter",
  "/positions",
  "/applications",
  "/announcements",
  "/profile/timeline",
  "/settings/personalization",
  "/notifications",
];

export function studentMinimalLinkOrderIndex(href: string): number {
  const i = STUDENT_SIDEBAR_LINK_ORDER.indexOf(href);
  return i === -1 ? 9999 : i;
}

export function applyStudentMinimalSidebarLayout(link: NavLink): NavLink {
  const mapped = SIDEBAR_BY_HREF[link.href];
  if (!mapped) return link;
  return {
    ...link,
    group: mapped.group,
    label: mapped.label,
    icon: mapped.icon,
  };
}
