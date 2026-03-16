// Pure utility — no "use server" so it can be imported by both server and client modules.

import type { NavGroup } from "@/lib/navigation/types";

// Nav groups always visible for students (never locked)
export const STUDENT_ALWAYS_VISIBLE_GROUPS: NavGroup[] = [
  "Start Here",
  "Learning",
  "Progress",
  "Profile & Settings",
];

// Nav groups always visible for parents
export const PARENT_ALWAYS_VISIBLE_GROUPS: NavGroup[] = [
  "Family",
  "Start Here",
  "Profile & Settings",
];

// Section key → nav groups (kept in sync with SECTION_UNLOCK_MAP in unlock-manager.ts)
export const SECTION_NAV_GROUP_MAP: Record<string, NavGroup[]> = {
  challenges: ["Challenges"],
  projects: ["Projects"],
  opportunities: ["Opportunities"],
  people_support: ["People & Support"],
};

// Section key → human-readable unlock requirement
export const SECTION_REQUIREMENTS: Record<string, string> = {
  challenges: "Complete any Pathway 101 step",
  projects: "Earn your first badge",
  opportunities: "Complete any Pathway 201",
  people_support: "Complete 2 pathway steps",
};

// Roles that see everything unlocked by default
export const FULL_ACCESS_ROLES = new Set([
  "ADMIN",
  "INSTRUCTOR",
  "CHAPTER_LEAD",
  "MENTOR",
  "STAFF",
]);

/**
 * Given a user's role and unlocked sections, returns the set of NavGroup names
 * that should be visible in navigation.
 *
 * Pure function — no async, no DB.
 */
export function getVisibleNavGroups(
  primaryRole: string,
  unlockedSections: Set<string>
): { visibleGroups: Set<NavGroup>; lockedGroups: Map<NavGroup, string> } {
  // Non-student roles see everything
  if (FULL_ACCESS_ROLES.has(primaryRole)) {
    return { visibleGroups: new Set<NavGroup>(), lockedGroups: new Map() };
  }

  const visibleGroups = new Set<NavGroup>();
  const lockedGroups = new Map<NavGroup, string>();

  // Always-visible groups
  const alwaysVisible =
    primaryRole === "PARENT"
      ? PARENT_ALWAYS_VISIBLE_GROUPS
      : STUDENT_ALWAYS_VISIBLE_GROUPS;
  for (const g of alwaysVisible) {
    visibleGroups.add(g);
  }

  // Check each lockable section
  for (const [sectionKey, navGroups] of Object.entries(SECTION_NAV_GROUP_MAP)) {
    const requirement = SECTION_REQUIREMENTS[sectionKey] ?? sectionKey;
    if (unlockedSections.has(sectionKey)) {
      for (const g of navGroups) {
        visibleGroups.add(g);
      }
    } else {
      for (const g of navGroups) {
        lockedGroups.set(g, requirement);
      }
    }
  }

  return { visibleGroups, lockedGroups };
}
