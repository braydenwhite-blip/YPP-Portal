/**
 * Pure grouping + aggregation for the Initiatives hub, mirroring the Action
 * Tracker and Meetings hubs (status donut + categorical bars + colored-header
 * groups). Generic over the minimal shape each function needs so it works with
 * the full InitiativeSummary and is trivially unit-testable. No prisma import.
 */
import type { InitiativeHealthLevel } from "./strategic-initiative-health";

/** Worst-first ordering for donut slices and group headers. */
export const INITIATIVE_HEALTH_ORDER: InitiativeHealthLevel[] = [
  "critical",
  "at_risk",
  "drifting",
  "healthy",
  "completed",
  "archived",
];

export type InitiativeHealthBreakdown = {
  total: number;
  counts: Record<InitiativeHealthLevel, number>;
};

export function summarizeInitiativeHealth<
  T extends { health: { level: InitiativeHealthLevel } },
>(items: T[]): InitiativeHealthBreakdown {
  const counts: Record<InitiativeHealthLevel, number> = {
    healthy: 0,
    drifting: 0,
    at_risk: 0,
    critical: 0,
    completed: 0,
    archived: 0,
  };
  for (const item of items) counts[item.health.level] += 1;
  return { total: items.length, counts };
}

export type InitiativeAreaBar = { label: string; total: number };

/** Per-area totals, biggest first (the hub shows the top few). */
export function summarizeInitiativeAreas<T extends { areaLabel: string }>(
  items: T[]
): InitiativeAreaBar[] {
  const byLabel = new Map<string, number>();
  for (const item of items) {
    byLabel.set(item.areaLabel, (byLabel.get(item.areaLabel) ?? 0) + 1);
  }
  return Array.from(byLabel.entries())
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
}

export type InitiativeHealthGroup<T> = {
  level: InitiativeHealthLevel;
  items: T[];
};

/** Group by health, ordered worst-first; empty levels are dropped. */
export function groupInitiativesByHealth<
  T extends { health: { level: InitiativeHealthLevel } },
>(items: T[]): Array<InitiativeHealthGroup<T>> {
  const byLevel = new Map<InitiativeHealthLevel, T[]>();
  for (const item of items) {
    const arr = byLevel.get(item.health.level);
    if (arr) arr.push(item);
    else byLevel.set(item.health.level, [item]);
  }
  return INITIATIVE_HEALTH_ORDER.filter((level) => byLevel.has(level)).map((level) => ({
    level,
    items: byLevel.get(level)!,
  }));
}

export type InitiativeOwnerGroup<T> = {
  owner: string;
  items: T[];
};

/** Group by owner, alphabetical, with "Unassigned" sorted last. */
export function groupInitiativesByOwner<T extends { owner: string | null }>(
  items: T[]
): Array<InitiativeOwnerGroup<T>> {
  const byOwner = new Map<string, T[]>();
  for (const item of items) {
    const owner = item.owner?.trim() || "Unassigned";
    const arr = byOwner.get(owner);
    if (arr) arr.push(item);
    else byOwner.set(owner, [item]);
  }
  return Array.from(byOwner.entries())
    .map(([owner, groupItems]) => ({ owner, items: groupItems }))
    .sort((a, b) => {
      if (a.owner === "Unassigned") return 1;
      if (b.owner === "Unassigned") return -1;
      return a.owner.localeCompare(b.owner);
    });
}
