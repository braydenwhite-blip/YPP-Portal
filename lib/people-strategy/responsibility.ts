import type { GrowthTag } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { listVisibleActionItems } from "./action-queries";
import type { ActionViewer } from "./action-permissions";
import {
  buildPeopleRiskRadar,
  buildResponsibilityRows,
  type ResponsibilityRow,
  type RiskEntry,
} from "./responsibility-selectors";

/**
 * People Strategy — Responsibility Map data loader (Phase 8).
 *
 * One visibility-checked read of the Action Tracker (reused) plus the growth
 * tags for the people who appear, composed through the pure responsibility
 * selectors. Mirrors the Command Center / People Dashboard loader convention.
 */

export interface ResponsibilityData {
  rows: ResponsibilityRow[];
  risks: RiskEntry[];
}

async function loadGrowthTags(userIds: string[]): Promise<Map<string, GrowthTag[]>> {
  const byUser = new Map<string, GrowthTag[]>();
  if (userIds.length === 0) return byUser;

  const tags = await prisma.memberGrowthTag.findMany({
    where: { userId: { in: userIds } },
    select: { userId: true, tag: true },
  });
  for (const { userId, tag } of tags) {
    const list = byUser.get(userId);
    if (list) list.push(tag);
    else byUser.set(userId, [tag]);
  }
  return byUser;
}

export async function loadResponsibilityMap(
  viewer: ActionViewer,
  now: Date = new Date()
): Promise<ResponsibilityData> {
  const items = await listVisibleActionItems(viewer);

  // Build the rows once with empty tags to discover which users appear, then
  // hydrate their growth tags and rebuild. (Two cheap passes over the same data
  // beats fetching tags for every user in the org.)
  const provisional = buildResponsibilityRows(items, new Map(), now);
  const growthByUser = await loadGrowthTags(provisional.map((r) => r.id));

  const rows = buildResponsibilityRows(items, growthByUser, now);
  const risks = buildPeopleRiskRadar(rows);

  return { rows, risks };
}
