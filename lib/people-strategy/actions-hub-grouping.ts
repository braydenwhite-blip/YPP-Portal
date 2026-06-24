import type { ActionItemWithRelations } from "./action-queries";
import { STANDING_ACTION_DEPARTMENTS } from "./action-departments";
import { isActionOverdue, sortByDeadline } from "./my-actions-selectors";

export type ActionDepartmentGroup = {
  id: string;
  name: string;
  slug: string | null;
  items: ActionItemWithRelations[];
  overdueCount: number;
};

const SLUG_ORDER = new Map(STANDING_ACTION_DEPARTMENTS.map((d, i) => [d.slug, i]));

const DEPT_HEADER_COLORS: Record<string, string> = {
  instruction: "#db2777",
  "recruitment-hiring": "#7c3aed",
  mentorship: "#0891b2",
  partnerships: "#0e9f6e",
  operations: "#2563eb",
  chapters: "#d97706",
  tech: "#4f46e5",
  communications: "#059669",
  "social-media": "#e11d48",
  fundraising: "#047857",
  officers: "#475569",
  board: "#1e293b",
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
    const id = item.department?.id ?? "unassigned";
    const name = item.department?.name ?? "Unassigned";
    const slug = item.department?.slug ?? null;

    let group = buckets.get(id);
    if (!group) {
      group = { id, name, slug, items: [], overdueCount: 0 };
      buckets.set(id, group);
    }
    group.items.push(item);
    if (isActionOverdue(item, now)) group.overdueCount += 1;
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
