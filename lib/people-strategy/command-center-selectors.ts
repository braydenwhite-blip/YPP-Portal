import type { ActionPriority } from "@prisma/client";

import {
  addDays,
  daysUntil,
  formatDueDate,
  isDueThisWeek,
  startOfOperatingWeek,
} from "@/lib/leadership-action-center/dates";

import { ACTION_PRIORITY_WEIGHT } from "./constants";
import type { ActionItemWithRelations } from "./action-queries";
import { effectiveDeadline, isActionOverdue } from "./my-actions-selectors";
import {
  scoreMomentum,
  type MomentumFactors,
  type MomentumResult,
} from "./momentum";

/**
 * People Strategy — Command Center selectors.
 *
 * Pure aggregations over a set of `ActionItemWithRelations` already filtered
 * for the viewer's visibility (mirrors `people-dashboard-selectors.ts`). The
 * Command Center loader (`command-center.ts`) does the single DB read; these
 * functions turn that data into the Weekly Pulse, Leadership Attention Queue,
 * People / Team Momentum, and Win Log — with no further DB or session access,
 * so every signal here is unit-testable.
 *
 * NOTE on "completed this week": the schema has no `completedAt`, so a COMPLETE
 * item's `updatedAt` is used as the completion timestamp. This is exact when an
 * item is marked complete once and not edited afterward (the common case), and
 * a close approximation otherwise. Documented as a known limitation; a dedicated
 * `completedAt` column is tracked in the consolidation plan.
 */

/** Days an open item has gone unreviewed before it counts as "stale". */
export const STALE_ACTIVITY_DAYS = 14;
/** Window used for "recent" completions + activity in momentum scoring. */
export const MOMENTUM_WINDOW_DAYS = 14;
/** Open-item load above which an owner is flagged as potentially overloaded. */
export const OVERLOADED_OPEN_ITEMS = 6;

function isFlaggedUnresolved(item: ActionItemWithRelations): boolean {
  return item.flaggedAt != null && item.resolvedAt == null;
}

/**
 * The completion timestamp: the exact `completedAt` (Phase 7) when present,
 * else a best-effort fallback to `updatedAt` for rows completed before the
 * column existed.
 */
function completionTime(item: ActionItemWithRelations): Date {
  return item.completedAt ?? item.updatedAt;
}

function isEscalatedUnresolved(item: ActionItemWithRelations): boolean {
  return item.escalatedToCpoAt != null && item.resolvedAt == null;
}

/** Positive number of days overdue (0 when not overdue / no past deadline). */
export function daysOverdue(item: ActionItemWithRelations, now: Date): number {
  const remaining = daysUntil(effectiveDeadline(item), now);
  if (remaining == null) return 0;
  return remaining < 0 ? -remaining : 0;
}

/** The most recent timestamp we have any signal of activity on an item. */
function lastActivityAt(item: ActionItemWithRelations): Date {
  let latest = item.updatedAt;
  for (const comment of item.comments) {
    if (comment.createdAt.getTime() > latest.getTime()) latest = comment.createdAt;
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Weekly Leadership Pulse
// ---------------------------------------------------------------------------

export interface WeeklyPulse {
  /** Monday of the current operating week (for the "Week of …" label). */
  weekStart: Date;
  openTotal: number;
  completedThisWeek: number;
  overdue: number;
  flagged: number;
  blocked: number;
  dueThisWeek: number;
  /** Open items with no one assigned to execute them. */
  unowned: number;
}

export function buildWeeklyPulse(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): WeeklyPulse {
  const weekStart = startOfOperatingWeek(now);
  let open = 0;
  let completedThisWeek = 0;
  let overdue = 0;
  let flagged = 0;
  let blocked = 0;
  let dueThisWeek = 0;
  let unowned = 0;

  for (const item of items) {
    if (item.status === "COMPLETE") {
      if (completionTime(item).getTime() >= weekStart.getTime()) completedThisWeek += 1;
      continue;
    }
    // DROPPED items are settled — they don't count toward open work.
    if (item.status === "DROPPED") continue;
    open += 1;
    if (isActionOverdue(item, now)) overdue += 1;
    if (isFlaggedUnresolved(item)) flagged += 1;
    if (item.status === "BLOCKED") blocked += 1;
    if (isDueThisWeek(effectiveDeadline(item), now)) dueThisWeek += 1;
    if (!item.assignments.some((a) => a.role === "EXECUTING")) unowned += 1;
  }

  return { weekStart, openTotal: open, completedThisWeek, overdue, flagged, blocked, dueThisWeek, unowned };
}

// ---------------------------------------------------------------------------
// Leadership Attention Queue
// ---------------------------------------------------------------------------

export type AttentionSeverity = "high" | "medium" | "low";

export interface AttentionEntry {
  id: string;
  title: string;
  reason: string;
  severity: AttentionSeverity;
  priority: ActionPriority;
  ownerName: string;
  departmentName: string | null;
  daysOverdue: number;
  dueLabel: string;
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = { high: 3, medium: 2, low: 1 };

/**
 * Reduce an open item to its single most important attention reason, or null
 * when nothing about it needs leadership's eye. Order = most urgent first.
 * A blocker that has lingered, an escalation, and a deep-overdue item all
 * outrank a freshly-blocked or merely-high-priority item.
 */
function attentionReason(
  item: ActionItemWithRelations,
  now: Date
): { reason: string; severity: AttentionSeverity } | null {
  const overdueDays = daysOverdue(item, now);

  if (isEscalatedUnresolved(item)) {
    return { reason: "Escalated to CPO, unresolved", severity: "high" };
  }
  if (overdueDays >= 7) {
    return { reason: `Overdue ${overdueDays} days`, severity: "high" };
  }
  if (isFlaggedUnresolved(item)) {
    return { reason: "Flagged, needs review", severity: "high" };
  }
  if (item.status === "BLOCKED") {
    return { reason: "Blocked — needs unblocking", severity: "high" };
  }
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS);
  if (lastActivityAt(item).getTime() < staleCutoff.getTime()) {
    return { reason: `No activity in ${STALE_ACTIVITY_DAYS}+ days`, severity: "medium" };
  }
  if (!item.assignments.some((a) => a.role === "EXECUTING")) {
    return { reason: "No executor assigned", severity: "medium" };
  }
  if (overdueDays > 0) {
    return { reason: `Overdue ${overdueDays} ${overdueDays === 1 ? "day" : "days"}`, severity: "medium" };
  }
  if (item.priority === "URGENT") {
    return { reason: "Urgent — keep it moving", severity: "medium" };
  }
  if (item.status === "NOT_STARTED" && isDueThisWeek(effectiveDeadline(item), now)) {
    return { reason: "Due this week, not started", severity: "low" };
  }
  return null;
}

export function buildAttentionQueue(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): AttentionEntry[] {
  const entries: AttentionEntry[] = [];
  for (const item of items) {
    // Completed and dropped items are settled — never in the queue.
    if (item.status === "COMPLETE" || item.status === "DROPPED") continue;
    const reason = attentionReason(item, now);
    if (!reason) continue;
    entries.push({
      id: item.id,
      title: item.title,
      reason: reason.reason,
      severity: reason.severity,
      priority: item.priority,
      ownerName: item.lead?.name ?? item.lead?.email ?? "Unassigned",
      departmentName: item.department?.name ?? null,
      daysOverdue: daysOverdue(item, now),
      dueLabel: formatDueDate(effectiveDeadline(item)),
    });
  }

  // Severity first, then priority (urgent rises within a tier), then most
  // overdue, then a stable title tie-break.
  return entries.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      ACTION_PRIORITY_WEIGHT[b.priority] - ACTION_PRIORITY_WEIGHT[a.priority] ||
      b.daysOverdue - a.daysOverdue ||
      a.title.localeCompare(b.title)
  );
}

// ---------------------------------------------------------------------------
// People Momentum
// ---------------------------------------------------------------------------

export interface PersonMomentum {
  id: string;
  name: string;
  email: string;
  role: string | null;
  avatarUrl: string | null;
  momentum: MomentumResult;
  /** True when open load is high enough to warrant a redistribution look. */
  overloaded: boolean;
}

type OwnerAccumulator = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  avatarUrl: string | null;
  openCount: number;
  completedRecent: number;
  overdue: number;
  flagged: number;
  hasRecentActivity: boolean;
};

function ownerSeed(user: {
  id: string;
  name: string | null;
  email: string;
  primaryRole: string | null;
  profile?: { avatarUrl: string | null } | null;
}): OwnerAccumulator {
  return {
    id: user.id,
    name: user.name ?? user.email,
    email: user.email,
    role: user.primaryRole,
    avatarUrl: user.profile?.avatarUrl ?? null,
    openCount: 0,
    completedRecent: 0,
    overdue: 0,
    flagged: 0,
    hasRecentActivity: false,
  };
}

/**
 * Per-person momentum across the items they OWN (lead or executing). Input-only
 * assignments are excluded — momentum tracks execution accountability, not who
 * was asked a question. People are returned most-concerning first so the UI can
 * lead with who needs support.
 */
export function buildPersonMomentum(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): PersonMomentum[] {
  const windowStart = addDays(now, -MOMENTUM_WINDOW_DAYS);
  const owners = new Map<string, OwnerAccumulator>();

  const ensure = (user: Parameters<typeof ownerSeed>[0]) => {
    let acc = owners.get(user.id);
    if (!acc) {
      acc = ownerSeed(user);
      owners.set(user.id, acc);
    }
    return acc;
  };

  for (const item of items) {
    // Distinct owner users on this item: the lead + every EXECUTING assignee.
    const ownerUsers = new Map<string, Parameters<typeof ownerSeed>[0]>();
    if (item.lead) ownerUsers.set(item.lead.id, item.lead);
    for (const a of item.assignments) {
      if (a.role === "EXECUTING") ownerUsers.set(a.user.id, a.user);
    }

    const complete = item.status === "COMPLETE";
    const dropped = item.status === "DROPPED";
    const completedRecently = complete && completionTime(item).getTime() >= windowStart.getTime();
    const overdue = !complete && !dropped && isActionOverdue(item, now);
    const flagged = !complete && !dropped && isFlaggedUnresolved(item);
    const updatedRecently = item.updatedAt.getTime() >= windowStart.getTime();

    for (const user of ownerUsers.values()) {
      const acc = ensure(user);
      if (complete) {
        if (completedRecently) acc.completedRecent += 1;
      } else if (!dropped) {
        // Dropped work is settled — it neither counts as open nor penalizes.
        acc.openCount += 1;
        if (overdue) acc.overdue += 1;
        if (flagged) acc.flagged += 1;
      }
      if (updatedRecently) acc.hasRecentActivity = true;
    }

    // Authoring a comment in the window also counts as activity for that person.
    for (const comment of item.comments) {
      if (!comment.author) continue;
      if (comment.createdAt.getTime() < windowStart.getTime()) continue;
      const existing = owners.get(comment.author.id);
      if (existing) existing.hasRecentActivity = true;
    }
  }

  const rows = Array.from(owners.values()).map((acc): PersonMomentum => {
    const factors: MomentumFactors = {
      openCount: acc.openCount,
      completedRecent: acc.completedRecent,
      overdue: acc.overdue,
      flagged: acc.flagged,
      hasRecentActivity: acc.hasRecentActivity,
    };
    return {
      id: acc.id,
      name: acc.name,
      email: acc.email,
      role: acc.role,
      avatarUrl: acc.avatarUrl,
      momentum: scoreMomentum(factors),
      overloaded: acc.openCount >= OVERLOADED_OPEN_ITEMS,
    };
  });

  return rows.sort(
    (a, b) => a.momentum.score - b.momentum.score || a.name.localeCompare(b.name)
  );
}

// ---------------------------------------------------------------------------
// Team / Department Momentum
// ---------------------------------------------------------------------------

export interface TeamMomentum {
  id: string;
  name: string;
  open: number;
  overdue: number;
  flagged: number;
  completedThisWeek: number;
  /** Composite risk = overdue + flagged; higher is more concerning. */
  risk: number;
}

export function buildTeamMomentum(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): TeamMomentum[] {
  const weekStart = startOfOperatingWeek(now);
  const teams = new Map<string, TeamMomentum>();

  for (const item of items) {
    const id = item.department?.id ?? "unassigned";
    const name = item.department?.name ?? "Unassigned";
    let team = teams.get(id);
    if (!team) {
      team = { id, name, open: 0, overdue: 0, flagged: 0, completedThisWeek: 0, risk: 0 };
      teams.set(id, team);
    }
    if (item.status === "COMPLETE") {
      if (completionTime(item).getTime() >= weekStart.getTime()) team.completedThisWeek += 1;
      continue;
    }
    if (item.status === "DROPPED") continue;
    team.open += 1;
    if (isActionOverdue(item, now)) team.overdue += 1;
    if (isFlaggedUnresolved(item)) team.flagged += 1;
  }

  for (const team of teams.values()) {
    team.risk = team.overdue + team.flagged;
  }

  return Array.from(teams.values()).sort(
    (a, b) => b.risk - a.risk || b.open - a.open || a.name.localeCompare(b.name)
  );
}

// ---------------------------------------------------------------------------
// Win Log
// ---------------------------------------------------------------------------

export interface WinEntry {
  id: string;
  title: string;
  ownerName: string;
  departmentName: string | null;
  completedLabel: string;
  completedAt: Date;
}

/** Items completed during the current operating week, newest first. */
export function buildWinLog(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): WinEntry[] {
  const weekStart = startOfOperatingWeek(now);
  return items
    .filter(
      (item) =>
        item.status === "COMPLETE" && completionTime(item).getTime() >= weekStart.getTime()
    )
    .map((item) => ({
      id: item.id,
      title: item.title,
      ownerName: item.lead?.name ?? item.lead?.email ?? "—",
      departmentName: item.department?.name ?? null,
      completedLabel: formatDueDate(completionTime(item)),
      completedAt: completionTime(item),
    }))
    .sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
}

/** Top contributors this period, by recent completions (excludes zero). */
export function topContributors(
  people: PersonMomentum[],
  limit = 5
): Array<{ id: string; name: string; completedRecent: number; avatarUrl: string | null }> {
  return people
    .filter((p) => p.momentum.factors.completedRecent > 0)
    .sort(
      (a, b) =>
        b.momentum.factors.completedRecent - a.momentum.factors.completedRecent ||
        a.name.localeCompare(b.name)
    )
    .slice(0, limit)
    .map((p) => ({
      id: p.id,
      name: p.name,
      completedRecent: p.momentum.factors.completedRecent,
      avatarUrl: p.avatarUrl,
    }));
}
