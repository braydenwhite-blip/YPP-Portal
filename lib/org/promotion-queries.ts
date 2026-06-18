import "server-only";

/**
 * Promotion read models (Phase 8 of
 * docs/ROLES_ACCESS_REVIEWS_MENTORSHIP_PLAN.md). Server-only (not RPC-exposed):
 * promotion history is sensitive and only read from gated server components /
 * queue assembly. The client-invoked mutations live in `promotion-actions.ts`.
 */

import { prisma } from "@/lib/prisma";

export interface PromotionHistoryEntry {
  id: string;
  effectiveDate: Date;
  reason: string | null;
  previousTitle: string | null;
  newTitle: string | null;
  previousInternalLevel: number | null;
  newInternalLevel: number | null;
  committeesAdded: string[];
  committeesRemoved: string[];
  setupComplete: boolean;
  pendingSetup: string[];
  actorName: string | null;
  createdAt: Date;
}

function parseList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

/** Applied-promotion history for a person, newest first. */
export async function getPersonPromotionHistory(userId: string): Promise<PromotionHistoryEntry[]> {
  const rows = await prisma.promotionRecord.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      effectiveDate: true,
      reason: true,
      previousTitle: true,
      newTitle: true,
      previousInternalLevel: true,
      newInternalLevel: true,
      committeesAdded: true,
      committeesRemoved: true,
      setupComplete: true,
      pendingSetup: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    effectiveDate: r.effectiveDate,
    reason: r.reason,
    previousTitle: r.previousTitle,
    newTitle: r.newTitle,
    previousInternalLevel: r.previousInternalLevel,
    newInternalLevel: r.newInternalLevel,
    committeesAdded: parseList(r.committeesAdded),
    committeesRemoved: parseList(r.committeesRemoved),
    setupComplete: r.setupComplete,
    pendingSetup: parseList(r.pendingSetup),
    actorName: r.actor?.name ?? null,
    createdAt: r.createdAt,
  }));
}

export interface PendingPromotionSetup {
  id: string;
  userId: string;
  personName: string;
  newTitle: string | null;
  pendingSetup: string[];
}

/** Promotions whose new-role setup (mentor / chapter / committee) is unresolved. */
export async function getPendingPromotionSetups(): Promise<PendingPromotionSetup[]> {
  const rows = await prisma.promotionRecord.findMany({
    where: { setupComplete: false },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      newTitle: true,
      pendingSetup: true,
      user: { select: { name: true } },
    },
    take: 100,
  });

  return rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    personName: r.user.name,
    newTitle: r.newTitle,
    pendingSetup: parseList(r.pendingSetup),
  }));
}
