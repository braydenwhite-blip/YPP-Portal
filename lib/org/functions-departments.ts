/**
 * Org Function → Department taxonomy.
 *
 * Display as two fields everywhere — never "Operations - Technology":
 *   Function: Operations
 *   Department: Technology
 *
 * Examples:
 *   Core Instruction → Leadership
 *   Operations → Fundraising
 *   Operations → Technology
 */

export type OrgFunctionSlug = "core-instruction" | "operations";

export type OrgDepartmentSlug =
  | "leadership"
  | "instruction"
  | "chapters"
  | "technology"
  | "fundraising"
  | "communications"
  | "social-media";

export type OrgFunctionDef = {
  name: string;
  slug: OrgFunctionSlug;
  description: string;
};

export type OrgDepartmentDef = {
  name: string;
  slug: OrgDepartmentSlug;
  functionSlug: OrgFunctionSlug;
  description: string;
};

export const ORG_FUNCTIONS: OrgFunctionDef[] = [
  {
    name: "Core Instruction",
    slug: "core-instruction",
    description: "Programs, teaching, chapter leadership, and instructional quality.",
  },
  {
    name: "Operations",
    slug: "operations",
    description: "Org operations — technology, fundraising, communications, and channels.",
  },
];

export const ORG_DEPARTMENTS: OrgDepartmentDef[] = [
  {
    name: "Leadership",
    slug: "leadership",
    functionSlug: "core-instruction",
    description: "Chapter and program leadership under Core Instruction.",
  },
  {
    name: "Instruction",
    slug: "instruction",
    functionSlug: "core-instruction",
    description: "Classes, curriculum, teaching quality, and mentorship.",
  },
  {
    name: "Chapters",
    slug: "chapters",
    functionSlug: "core-instruction",
    description: "Local chapters, hiring, and community partnerships.",
  },
  {
    name: "Technology",
    slug: "technology",
    functionSlug: "operations",
    description: "Portal, tooling, automation, and technical delivery.",
  },
  {
    name: "Fundraising",
    slug: "fundraising",
    functionSlug: "operations",
    description: "Donor, grant, and fundraising operations.",
  },
  {
    name: "Communications",
    slug: "communications",
    functionSlug: "operations",
    description: "Org messaging, announcements, and outreach.",
  },
  {
    name: "Social Media",
    slug: "social-media",
    functionSlug: "operations",
    description: "Social content, campaigns, and channel management.",
  },
];

export const ORG_FUNCTION_BY_SLUG = new Map(
  ORG_FUNCTIONS.map((fn) => [fn.slug, fn] as const)
);
export const ORG_DEPARTMENT_BY_SLUG = new Map(
  ORG_DEPARTMENTS.map((d) => [d.slug, d] as const)
);

/** Departments belonging to a Function, in catalog order. */
export function departmentsForFunction(
  functionSlug: OrgFunctionSlug
): OrgDepartmentDef[] {
  return ORG_DEPARTMENTS.filter((d) => d.functionSlug === functionSlug);
}

/**
 * Format for UI — two labeled lines, never a dash-joined string.
 */
export function formatFunctionDepartment(opts: {
  functionName?: string | null;
  departmentName?: string | null;
}): { functionLabel: string | null; departmentLabel: string | null; summary: string | null } {
  const functionLabel = opts.functionName?.trim() || null;
  const departmentLabel = opts.departmentName?.trim() || null;
  if (!functionLabel && !departmentLabel) {
    return { functionLabel: null, departmentLabel: null, summary: null };
  }
  if (functionLabel && departmentLabel) {
    return {
      functionLabel,
      departmentLabel,
      summary: `${functionLabel} · ${departmentLabel}`,
    };
  }
  return {
    functionLabel,
    departmentLabel,
    summary: functionLabel ?? departmentLabel,
  };
}
