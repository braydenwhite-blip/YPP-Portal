import type { ActionItemWithRelations } from "./action-queries";
import { actionItemDepartments } from "./action-item-departments";
import { STANDING_ACTION_DEPARTMENTS } from "./action-departments";
import { isActionOverdue, sortByDeadline } from "./my-actions-selectors";

export type ActionDepartmentGroup = {
  id: string;
  name: string;
  slug: string | null;
  items: ActionItemWithRelations[];
  overdueCount: number;
};

const SLUG_ORDER = new Map<string, number>(
  STANDING_ACTION_DEPARTMENTS.map((d, i) => [d.slug, i])
);

const DEPT_HEADER_COLORS: Record<string, string> = {
  leadership: "#7c3aed",
  instruction: "#db2777",
  chapters: "#d97706",
  technology: "#4f46e5",
  tech: "#4f46e5",
  fundraising: "#0f766e",
  communications: "#059669",
  "social-media": "#e11d48",
  unassigned: "#9a9ab0",
};

export function departmentHeaderColor(slug: string | null): string {
  if (!slug) return DEPT_HEADER_COLORS.unassigned;
  return DEPT_HEADER_COLORS[slug] ?? "#6b21c8";
}

/** Group open actions by department for the Actions Hub list. */
export function groupActionsByDepartment(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionDepartmentGroup[] {
  const buckets = new Map<string, ActionDepartmentGroup>();

  for (const item of items) {
    if (item.status === "DROPPED") continue;
    const teams = actionItemDepartments(item);
    const targets =
      teams.length > 0
        ? teams
        : [{ id: "unassigned", name: "Unassigned", slug: null as string | null }];

    for (const team of targets) {
      let group = buckets.get(team.id);
      if (!group) {
        group = { id: team.id, name: team.name, slug: team.slug, items: [], overdueCount: 0 };
        buckets.set(team.id, group);
      }
      group.items.push(item);
      if (isActionOverdue(item, now)) group.overdueCount += 1;
    }
  }

  return Array.from(buckets.values())
    .map((group) => ({
      ...group,
      items: sortByDeadline(group.items),
    }))
    .sort((a, b) => {
      const ai = a.slug ? (SLUG_ORDER.get(a.slug) ?? 998) : 999;
      const bi = b.slug ? (SLUG_ORDER.get(b.slug) ?? 998) : 999;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name);
    });
}
