import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

/**
 * Standing teams / departments for the Action Tracker picker.
 * Synced to the `Department` table via migration + `ensureStandingActionDepartments`.
 */
export type ActionDepartmentGroup = "core" | "org" | "leadership";

export type StandingActionDepartmentDef = {
  name: string;
  slug: string;
  group: ActionDepartmentGroup;
  description: string;
};

export const ACTION_DEPARTMENT_GROUP_LABELS: Record<ActionDepartmentGroup, string> = {
  core: "Core teams",
  org: "Org & growth",
  leadership: "Leadership",
};

export const STANDING_ACTION_DEPARTMENTS: StandingActionDepartmentDef[] = [
  {
    name: "Instruction",
    slug: "instruction",
    group: "core",
    description: "Curriculum, teaching, and classroom operations.",
  },
  {
    name: "Recruitment & Hiring",
    slug: "recruitment-hiring",
    group: "core",
    description: "Sourcing, interviewing, and hiring instructors.",
  },
  {
    name: "Mentorship",
    slug: "mentorship",
    group: "core",
    description: "Pairing, coaching, and instructor growth support.",
  },
  {
    name: "Partnerships",
    slug: "partnerships",
    group: "core",
    description: "Community building, outreach, and partnerships.",
  },
  {
    name: "Operations",
    slug: "operations",
    group: "core",
    description: "Platform, logistics, and internal operations.",
  },
  {
    name: "Chapters",
    slug: "chapters",
    group: "org",
    description: "Chapter launches, expansion, and local chapter leads.",
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
    description: "Org-wide messaging, announcements, and comms strategy.",
  },
  {
    name: "Social Media",
    slug: "social-media",
    group: "org",
    description: "Social content, campaigns, and channel management.",
  },
  {
    name: "Fundraising",
    slug: "fundraising",
    group: "org",
    description: "Donor outreach, sponsorships, and fundraising campaigns.",
  },
  {
    name: "Officers",
    slug: "officers",
    group: "leadership",
    description: "Officer-team work that spans multiple functions.",
  },
  {
    name: "Board",
    slug: "board",
    group: "leadership",
    description: "Board-facing priorities, governance, and approvals.",
  },
];

const SLUG_ORDER = new Map(STANDING_ACTION_DEPARTMENTS.map((d, index) => [d.slug, index]));
const SLUG_TO_GROUP = new Map(STANDING_ACTION_DEPARTMENTS.map((d) => [d.slug, d.group]));

export type ActionDepartmentOption = {
  id: string;
  name: string;
  slug: string | null;
  group: ActionDepartmentGroup | null;
};

/** Upsert every standing department so the picker is complete on every environment. */
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
    leadership: [],
    other: [],
  };

  for (const department of departments) {
    const key = department.group ?? "other";
    buckets[key].push(department);
  }

  const groups: Array<{
    key: ActionDepartmentGroup | "other";
    label: string;
    items: ActionDepartmentOption[];
  }> = [];

  for (const key of ["core", "org", "leadership"] as const) {
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
