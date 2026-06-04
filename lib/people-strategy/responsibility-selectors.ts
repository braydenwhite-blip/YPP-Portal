import type { GrowthTag } from "@prisma/client";

import type { ActionItemWithRelations } from "./action-queries";
import {
  buildPersonMomentum,
  type PersonMomentum,
} from "./command-center-selectors";
import { hasDisengagementRisk, isGrowthOpportunity } from "./growth-signals";
import type { MomentumResult } from "./momentum";

/**
 * People Strategy — Responsibility Map + People Risk Radar selectors (Phase 8).
 *
 * Pure aggregations layered on top of `buildPersonMomentum`. The Responsibility
 * Map answers "who owns what, and who is overloaded or underutilized"; the Risk
 * Radar distills that (plus growth tags) into the few people a leader should act
 * on before a problem becomes an emergency. No DB/session access here — the
 * loader does the single read and passes data in.
 */

export interface ResponsibilityRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  avatarUrl: string | null;
  momentum: MomentumResult;
  openCount: number;
  overdue: number;
  completedRecent: number;
  flagged: number;
  /** Functional departments this person currently owns work in. */
  departments: string[];
  overloaded: boolean;
  /** No open ownership right now (capacity available). */
  underutilized: boolean;
  growthTags: GrowthTag[];
}

/** Map of userId → distinct department names across the items they own. */
function collectOwnerDepartments(
  items: ActionItemWithRelations[]
): Map<string, Set<string>> {
  const byUser = new Map<string, Set<string>>();
  const add = (userId: string, dept: string | null | undefined) => {
    if (!dept) return;
    let set = byUser.get(userId);
    if (!set) {
      set = new Set();
      byUser.set(userId, set);
    }
    set.add(dept);
  };
  for (const item of items) {
    if (item.status === "DROPPED") continue;
    const dept = item.department?.name ?? null;
    if (item.lead) add(item.lead.id, dept);
    for (const a of item.assignments) {
      if (a.role === "EXECUTING") add(a.user.id, dept);
    }
  }
  return byUser;
}

export function buildResponsibilityRows(
  items: ActionItemWithRelations[],
  growthByUser: Map<string, GrowthTag[]>,
  now: Date = new Date()
): ResponsibilityRow[] {
  const people: PersonMomentum[] = buildPersonMomentum(items, now);
  const deptsByUser = collectOwnerDepartments(items);

  return people.map((p): ResponsibilityRow => {
    const f = p.momentum.factors;
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      avatarUrl: p.avatarUrl,
      momentum: p.momentum,
      openCount: f.openCount,
      overdue: f.overdue,
      completedRecent: f.completedRecent,
      flagged: f.flagged,
      departments: Array.from(deptsByUser.get(p.id) ?? []).sort(),
      overloaded: p.overloaded,
      underutilized: f.openCount === 0,
      growthTags: growthByUser.get(p.id) ?? [],
    };
  });
}

// ---------------------------------------------------------------------------
// People Risk Radar
// ---------------------------------------------------------------------------

export type RiskSeverity = "high" | "medium" | "low";

export interface RiskEntry {
  id: string;
  name: string;
  role: string | null;
  reason: string;
  severity: RiskSeverity;
}

const RISK_RANK: Record<RiskSeverity, number> = { high: 3, medium: 2, low: 1 };

/** Repeated-overdue threshold before it becomes a standalone risk signal. */
export const REPEATED_OVERDUE_THRESHOLD = 2;

/**
 * The single most important risk reason for a person, or null when nothing is
 * concerning. Order = most urgent first. Growth tags refine the picture: a
 * "ready for more" person sitting idle is an *opportunity* signal, not a
 * problem; an "at risk of disengaging" tag is the loudest flag.
 */
function riskReason(row: ResponsibilityRow): { reason: string; severity: RiskSeverity } | null {
  if (hasDisengagementRisk(row.growthTags)) {
    return { reason: "Tagged at risk of disengaging", severity: "high" };
  }
  if (row.momentum.label === "AT_RISK") {
    return { reason: "At-risk momentum — overdue/flagged with little activity", severity: "high" };
  }
  if (row.overdue >= REPEATED_OVERDUE_THRESHOLD) {
    return { reason: `${row.overdue} overdue items`, severity: "medium" };
  }
  if (row.overloaded) {
    return { reason: `Overloaded — ${row.openCount} open items`, severity: "medium" };
  }
  if (row.openCount > 0 && !row.momentum.factors.hasRecentActivity) {
    return { reason: "No recent activity on open work", severity: "medium" };
  }
  if (row.underutilized && isGrowthOpportunity(row.growthTags)) {
    return { reason: "Ready for more, but holds no current ownership", severity: "low" };
  }
  return null;
}

export function buildPeopleRiskRadar(rows: ResponsibilityRow[]): RiskEntry[] {
  const entries: RiskEntry[] = [];
  for (const row of rows) {
    const reason = riskReason(row);
    if (!reason) continue;
    entries.push({
      id: row.id,
      name: row.name,
      role: row.role,
      reason: reason.reason,
      severity: reason.severity,
    });
  }
  return entries.sort(
    (a, b) => RISK_RANK[b.severity] - RISK_RANK[a.severity] || a.name.localeCompare(b.name)
  );
}
