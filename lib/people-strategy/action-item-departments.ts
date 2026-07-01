import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ActionDepartmentRef = {
  id: string;
  name: string;
  slug: string | null;
};

type DepartmentLinkRow = {
  department: ActionDepartmentRef;
};

type ActionItemDepartmentShape = {
  departmentId: string | null;
  department: ActionDepartmentRef | null;
  departmentLinks?: DepartmentLinkRow[];
};

/** Unique department ids from junction rows, falling back to the legacy FK. */
export function actionItemDepartmentIds(item: ActionItemDepartmentShape): string[] {
  const fromLinks = (item.departmentLinks ?? []).map((link) => link.department.id);
  if (fromLinks.length > 0) return [...new Set(fromLinks)];
  const legacy = item.departmentId ?? item.department?.id ?? null;
  return legacy ? [legacy] : [];
}

/** All teams linked to an action, de-duplicated and ordered by name. */
export function actionItemDepartments(item: ActionItemDepartmentShape): ActionDepartmentRef[] {
  const fromLinks = (item.departmentLinks ?? []).map((link) => link.department);
  if (fromLinks.length > 0) {
    const seen = new Set<string>();
    return fromLinks.filter((dept) => {
      if (seen.has(dept.id)) return false;
      seen.add(dept.id);
      return true;
    });
  }
  if (item.department) return [item.department];
  return [];
}

/** Normalize create/update input into a unique, ordered department id list. */
export function normalizeActionDepartmentIds(input: {
  departmentIds?: string[];
  departmentId?: string | null;
}): string[] {
  const raw =
    input.departmentIds !== undefined
      ? input.departmentIds
      : input.departmentId
        ? [input.departmentId]
        : input.departmentId === null
          ? []
          : [];
  return [...new Set(raw.map((id) => id.trim()).filter(Boolean))];
}

/** Primary team for legacy `departmentId` — first selected team, or null. */
export function primaryActionDepartmentId(departmentIds: string[]): string | null {
  return departmentIds[0] ?? null;
}

type ActionItemDepartmentClient = {
  findMany?: (args: unknown) => Promise<unknown>;
  deleteMany?: (args: unknown) => Promise<unknown>;
  createMany?: (args: unknown) => Promise<unknown>;
};

type Tx = {
  actionItemDepartment?: ActionItemDepartmentClient;
};

export type ActionItemDepartmentLink = {
  department: ActionDepartmentRef;
};

export function hasActionItemDepartmentModel(client: Tx): boolean {
  return typeof client.actionItemDepartment?.findMany === "function";
}

/** Batch-load junction teams onto action rows (avoids invalid include when client is stale). */
export async function hydrateActionItemDepartmentLinks<T extends { id: string }>(
  items: T[]
): Promise<(T & { departmentLinks: ActionItemDepartmentLink[] })[]> {
  if (items.length === 0) {
    return [];
  }
  if (!hasActionItemDepartmentModel(prisma)) {
    return items.map((item) => ({ ...item, departmentLinks: [] }));
  }

  const links = await prisma.actionItemDepartment.findMany({
    where: { actionItemId: { in: items.map((item) => item.id) } },
    orderBy: { createdAt: "asc" },
    select: {
      actionItemId: true,
      department: { select: { id: true, name: true, slug: true } },
    },
  });

  const byAction = new Map<string, ActionItemDepartmentLink[]>();
  for (const link of links) {
    const bucket = byAction.get(link.actionItemId) ?? [];
    bucket.push({ department: link.department });
    byAction.set(link.actionItemId, bucket);
  }

  return items.map((item) => ({
    ...item,
    departmentLinks: byAction.get(item.id) ?? [],
  }));
}

/** Replace junction rows for an action with the given department ids. */
export async function syncActionItemDepartments(
  actionItemId: string,
  departmentIds: string[],
  tx: Tx = prisma
) {
  if (!hasActionItemDepartmentModel(tx)) return;

  const uniqueIds = [...new Set(departmentIds.filter(Boolean))];
  await tx.actionItemDepartment!.deleteMany({ where: { actionItemId } });
  if (uniqueIds.length === 0) return;
  await tx.actionItemDepartment!.createMany({
    data: uniqueIds.map((departmentId) => ({ actionItemId, departmentId })),
    skipDuplicates: true,
  });
}

export const ACTION_ITEM_DEPARTMENT_INCLUDE = {
  departmentLinks: {
    orderBy: { createdAt: "asc" as const },
    select: {
      department: { select: { id: true, name: true, slug: true } },
    },
  },
} satisfies Prisma.ActionItemInclude;
