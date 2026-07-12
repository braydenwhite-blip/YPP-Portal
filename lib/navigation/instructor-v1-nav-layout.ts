import type { NavGroup, NavLink } from "@/lib/navigation/types";

/** Section emoji in sidebar for focused instructor IA. */
export const INSTRUCTOR_MINIMAL_GROUP_EMOJI: Partial<Record<NavGroup, string>> = {
  "Start Here": "🏠",
  Teach: "📚",
};

const SIDEBAR_BY_HREF: Record<string, { group: NavGroup; label: string; icon: string }> = {
  "/": { group: "Start Here", label: "Home", icon: "🏠" },
  "/instructor/classes": { group: "Teach", label: "Classes", icon: "▤" },
  "/instructor/students": { group: "Teach", label: "Students", icon: "◉" },
  "/instructor/materials": { group: "Teach", label: "Materials", icon: "▱" },
  "/instructor/schedule": { group: "Teach", label: "Schedule", icon: "□" },
};

/** Order of links within the instructor minimal sidebar (lower = earlier). */
export const INSTRUCTOR_SIDEBAR_LINK_ORDER: string[] = [
  "/instructor/classes",
  "/instructor/students",
  "/instructor/materials",
  "/instructor/schedule",
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
