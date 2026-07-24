import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";
import {
  ORG_DEPARTMENTS,
  ORG_FUNCTIONS,
  type OrgFunctionSlug,
} from "@/lib/org/functions-departments";

/**
 * Standing Action Tracker departments — nested under Org Functions.
 * Display as Function + Department (never "Operations - Technology").
 */

export type ActionDepartmentOption = {
  id: string;
  name: string;
  slug: string | null;
  functionId: string | null;
  functionName: string | null;
  functionSlug: OrgFunctionSlug | null;
};

/** @deprecated use functionName — kept for older callers during transition */
export type ActionDepartmentGroup = OrgFunctionSlug;

export const ACTION_DEPARTMENT_GROUP_LABELS: Record<string, string> = {
  "core-instruction": "Core Instruction",
  operations: "Operations",
  core: "Core Instruction",
  org: "Operations",
};

/** Retired slugs — remapped or archived by migration; kept for tests. */
export const RETIRED_ACTION_DEPARTMENT_SLUGS = [
  "mentorship",
  "recruitment-hiring",
  "partnerships",
  "operations",
  "officers",
  "board",
  "instructional-affairs",
  "community-partnerships",
  "platform-operations",
  "tech", // renamed to technology
] as const;

/** @deprecated Prefer ORG_DEPARTMENTS — standing list for Action Tracker. */
export const STANDING_ACTION_DEPARTMENTS = ORG_DEPARTMENTS.map((d) => ({
  name: d.name,
  slug: d.slug,
  group: d.functionSlug === "core-instruction" ? ("core" as const) : ("org" as const),
  description: d.description,
  functionSlug: d.functionSlug,
}));

const SLUG_ORDER = new Map(ORG_DEPARTMENTS.map((d, index) => [d.slug, index]));

/** Ensure OrgFunction + Department rows exist and are linked. */
export async function ensureOrgFunctionsAndDepartments(): Promise<void> {
  for (const fn of ORG_FUNCTIONS) {
    await prisma.orgFunction.upsert({
      where: { slug: fn.slug },
      create: {
        name: fn.name,
        slug: fn.slug,
        description: fn.description,
      },
      update: {
        name: fn.name,
        description: fn.description,
        archivedAt: null,
      },
    });
  }

  const functions = await prisma.orgFunction.findMany({
    where: { slug: { in: ORG_FUNCTIONS.map((f) => f.slug) } },
    select: { id: true, slug: true },
  });
  const functionIdBySlug = new Map(functions.map((f) => [f.slug, f.id]));

  for (const dept of ORG_DEPARTMENTS) {
    const functionId = functionIdBySlug.get(dept.functionSlug);
    if (!functionId) continue;
    await prisma.department.upsert({
      where: { slug: dept.slug },
      create: {
        name: dept.name,
        slug: dept.slug,
        description: dept.description,
        functionId,
      },
      update: {
        name: dept.name,
        description: dept.description,
        functionId,
        archivedAt: null,
      },
    });
  }

  // Archive renamed / retired teams
  await prisma.department.updateMany({
    where: {
      slug: { in: [...RETIRED_ACTION_DEPARTMENT_SLUGS] },
      archivedAt: null,
    },
    data: { archivedAt: new Date() },
  });
}

/** Upsert standing departments (Action Tracker). Also ensures Functions. */
export async function ensureStandingActionDepartments(): Promise<void> {
  if (!isActionTrackerEnabled()) {
    // Still ensure taxonomy for people placement even if actions are off.
    await ensureOrgFunctionsAndDepartments();
    return;
  }
  await ensureOrgFunctionsAndDepartments();
}

export function enrichActionDepartmentOption(row: {
  id: string;
  name: string;
  slug: string | null;
  functionId?: string | null;
  function?: { id: string; name: string; slug: string } | null;
}): ActionDepartmentOption {
  const fn = row.function ?? null;
  const catalog = row.slug
    ? ORG_DEPARTMENTS.find((d) => d.slug === row.slug)
    : undefined;
  const functionSlug =
    (fn?.slug as OrgFunctionSlug | undefined) ??
    catalog?.functionSlug ??
    null;
  const functionName =
    fn?.name ??
    (functionSlug
      ? ORG_FUNCTIONS.find((f) => f.slug === functionSlug)?.name ?? null
      : null);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    functionId: row.functionId ?? fn?.id ?? null,
    functionName,
    functionSlug,
  };
}

export function sortActionDepartmentOptions(
  rows: Array<{
    id: string;
    name: string;
    slug: string | null;
    functionId?: string | null;
    function?: { id: string; name: string; slug: string } | null;
  }>
): ActionDepartmentOption[] {
  return rows.map(enrichActionDepartmentOption).sort((a, b) => {
    const ai = a.slug != null ? (SLUG_ORDER.get(a.slug as never) ?? 999) : 999;
    const bi = b.slug != null ? (SLUG_ORDER.get(b.slug as never) ?? 999) : 999;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
}

export function groupActionDepartments(departments: ActionDepartmentOption[]): Array<{
  key: string;
  label: string;
  items: ActionDepartmentOption[];
}> {
  const buckets = new Map<string, ActionDepartmentOption[]>();

  for (const department of departments) {
    const key = department.functionSlug ?? "other";
    const list = buckets.get(key) ?? [];
    list.push(department);
    buckets.set(key, list);
  }

  const groups: Array<{ key: string; label: string; items: ActionDepartmentOption[] }> = [];

  for (const fn of ORG_FUNCTIONS) {
    const items = buckets.get(fn.slug);
    if (items?.length) {
      groups.push({ key: fn.slug, label: fn.name, items });
      buckets.delete(fn.slug);
    }
  }

  for (const [key, items] of buckets) {
    if (items.length === 0) continue;
    groups.push({
      key,
      label: ACTION_DEPARTMENT_GROUP_LABELS[key] ?? "Other",
      items,
    });
  }

  return groups;
}

export async function listActionDepartmentOptions(): Promise<ActionDepartmentOption[]> {
  await ensureStandingActionDepartments();
  const rows = await prisma.department.findMany({
    where: {
      archivedAt: null,
      slug: { in: ORG_DEPARTMENTS.map((d) => d.slug) },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      functionId: true,
      function: { select: { id: true, name: true, slug: true } },
    },
  });
  return sortActionDepartmentOptions(rows);
}

export async function listOrgFunctionOptions(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  await ensureOrgFunctionsAndDepartments();
  return prisma.orgFunction.findMany({
    where: { archivedAt: null, slug: { in: ORG_FUNCTIONS.map((f) => f.slug) } },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
}
