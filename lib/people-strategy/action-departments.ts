import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

/**
 * Standing teams for the Action Tracker picker — five categories only.
 * Synced to the `Department` table via migration + `ensureStandingActionDepartments`.
 */
export type ActionDepartmentGroup = "core" | "org";

export type StandingActionDepartmentDef = {
  name: string;
  slug: string;
  group: ActionDepartmentGroup;
  description: string;
};

export const ACTION_DEPARTMENT_GROUP_LABELS: Record<ActionDepartmentGroup, string> = {
  core: "Programs",
  org: "Org",
};

/** Retired slugs — remapped or archived by migration; kept for reference in tests. */
export const RETIRED_ACTION_DEPARTMENT_SLUGS = [
  "mentorship",
  "recruitment-hiring",
  "partnerships",
  "operations",
  "fundraising",
  "officers",
  "board",
  "instructional-affairs",
  "community-partnerships",
  "platform-operations",
] as const;

export const STANDING_ACTION_DEPARTMENTS: StandingActionDepartmentDef[] = [
  {
    name: "Instruction",
    slug: "instruction",
    group: "core",
    description: "Classes, curriculum, teaching quality, and mentorship.",
  },
  {
    name: "Chapters",
    slug: "chapters",
    group: "core",
    description: "Local chapters, hiring, and community partnerships.",
  },
  {
    name: "Tech",
    slug: "tech",
    group: "org",
    description: "Portal, tooling, automation, and technical delivery.",
  },
  {
    name: "Communications",
    slug: "communications",
    group: "org",
    description: "Org messaging, announcements, fundraising outreach, and comms.",
  },
  {
    name: "Social Media",
    slug: "social-media",
    group: "org",
    description: "Social content, campaigns, and channel management.",
  },
];

const SLUG_ORDER = new Map(STANDING_ACTION_DEPARTMENTS.map((d, index) => [d.slug, index]));
const SLUG_TO_GROUP = new Map(STANDING_ACTION_DEPARTMENTS.map((d) => [d.slug, d.group]));
const STANDING_SLUGS = STANDING_ACTION_DEPARTMENTS.map((d) => d.slug);

export type ActionDepartmentOption = {
  id: string;
  name: string;
  slug: string | null;
  group: ActionDepartmentGroup | null;
};

/** Upsert standing departments and archive retired teams so the picker stays at five. */
export async function ensureStandingActionDepartments(): Promise<void> {
  if (!isActionTrackerEnabled()) return;

  await Promise.all(
    STANDING_ACTION_DEPARTMENTS.map((def) =>
      prisma.department.upsert({
        where: { slug: def.slug },
        create: {
          name: def.name,
          slug: def.slug,
          description: def.description,
        },
        update: {
          name: def.name,
          description: def.description,
          archivedAt: null,
        },
      })
    )
  );

  await prisma.department.updateMany({
    where: {
      slug: { in: [...RETIRED_ACTION_DEPARTMENT_SLUGS] },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });
}

export function enrichActionDepartmentOption(row: {
  id: string;
  name: string;
  slug: string | null;
}): ActionDepartmentOption {
  return {
    ...row,
    group: row.slug ? (SLUG_TO_GROUP.get(row.slug) ?? null) : null,
  };
}

export function sortActionDepartmentOptions(
  rows: Array<{ id: string; name: string; slug: string | null }>
): ActionDepartmentOption[] {
  return rows.map(enrichActionDepartmentOption).sort((a, b) => {
    const ai = a.slug != null ? (SLUG_ORDER.get(a.slug) ?? 999) : 999;
    const bi = b.slug != null ? (SLUG_ORDER.get(b.slug) ?? 999) : 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

export function groupActionDepartments(departments: ActionDepartmentOption[]): Array<{
  key: ActionDepartmentGroup | "other";
  label: string;
  items: ActionDepartmentOption[];
}> {
  const buckets: Record<ActionDepartmentGroup | "other", ActionDepartmentOption[]> = {
    core: [],
    org: [],
    other: [],
  };

  for (const department of departments) {
    const key =
      department.slug && STANDING_SLUGS.includes(department.slug)
        ? (SLUG_TO_GROUP.get(department.slug) ?? "other")
        : "other";
    buckets[key].push(department);
  }

  const groups: Array<{
    key: ActionDepartmentGroup | "other";
    label: string;
    items: ActionDepartmentOption[];
  }> = [];

  for (const key of ["core", "org"] as const) {
    if (buckets[key].length > 0) {
      groups.push({
        key,
        label: ACTION_DEPARTMENT_GROUP_LABELS[key],
        items: buckets[key],
      });
    }
  }

  if (buckets.other.length > 0) {
    groups.push({ key: "other", label: "Other", items: buckets.other });
  }

  return groups;
}
