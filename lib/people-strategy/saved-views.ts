import { prisma } from "@/lib/prisma";
import { isActionTrackerEnabled } from "@/lib/feature-flags";

/**
 * People Strategy — Saved Action Views read query (Phase 9).
 *
 * Plain (non-"use server") function mirroring `action-queries.ts`. Returns a
 * user's saved filter sets, newest first, for the Action Tracker.
 */

export type SavedActionViewDTO = { id: string; name: string; query: string };

export async function listSavedActionViews(userId: string): Promise<SavedActionViewDTO[]> {
  if (!isActionTrackerEnabled()) return [];
  return prisma.savedActionView.findMany({
    where: { userId },
    select: { id: true, name: true, query: true },
    orderBy: [{ createdAt: "desc" }],
    take: 50,
  });
}
