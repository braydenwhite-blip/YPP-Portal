import { addDays, startOfDay } from "@/lib/leadership-action-center/dates";

import type { ActionItemWithRelations } from "./action-queries";
import {
  lastActivityAt,
  STALE_ACTIVITY_DAYS,
} from "./command-center-selectors";
import { isActionOverdue, effectiveDeadline } from "./my-actions-selectors";
import {
  deriveActionNextMove,
  rankActionAttention,
  type ActionNextMove,
} from "./action-intel";

/**
 * Action System 4.0 — OPERATIONS INTELLIGENCE (pure).
 *
 * Cross-surface derivations that fuse actions with their source context for the
 * Meeting Follow-Up Pack, Weekly Review, Command Center action queue, owner
 * accountability, and the per-entity Action Operating Panel. Pure: no DB, no
 * React, `now` injected. Built on the per-action engine in {@link ./action-intel}.
 */

const isOpen = (i: ActionItemWithRelations) =>
  i.status !== "COMPLETE" && i.status !== "DROPPED";

/** Monday 00:00 of the operating week containing `now` (local). */
export function mondayOf(now: Date): Date {
  const d = startOfDay(now);
  const offset = (d.getDay() + 6) % 7; // 0 = Monday
  return addDays(d, -offset);
}

// ---------------------------------------------------------------------------
// Meeting → action follow-up pack
// ---------------------------------------------------------------------------

/** The minimal decision shape the pack needs (from a meeting's decisions). */
export type DecisionLite = {
  id: string;
  decision: string;
  /** The tracked ActionItem this decision became, or null when not yet acted on. */
  linkedActionId: string | null;
};

export type MeetingFollowUpPack = {
  /** Decisions that have not been turned into a tracked action yet. */
  decisionsWithoutActions: DecisionLite[];
  /** Open actions created from this meeting. */
  openActions: ActionItemWithRelations[];
  /** Overdue actions from this meeting. */
  overdueActions: ActionItemWithRelations[];
  /** Actions from this meeting completed within the recent window. */
  recentlyCompleted: ActionItemWithRelations[];
  /** True when there's nothing to follow up on (clean meeting). */
  isClear: boolean;
};

/** Decisions a meeting made that have NOT become tracked actions yet. */
export function deriveMeetingDecisionsWithoutActions(
  decisions: DecisionLite[]
): DecisionLite[] {
  return decisions.filter((d) => !d.linkedActionId);
}

/**
 * The post-meeting follow-up pack: what still needs to happen after a meeting.
 * `actions` should already be scoped to the meeting (e.g. via
 * getActionsForMeeting). `recentWindowDays` defaults to 14.
 */
export function deriveMeetingFollowUpPack(
  input: { decisions: DecisionLite[]; actions: ActionItemWithRelations[] },
  now: Date = new Date(),
  recentWindowDays = 14
): MeetingFollowUpPack {
  const decisionsWithoutActions = deriveMeetingDecisionsWithoutActions(input.decisions);
  const openActions = input.actions.filter(isOpen);
  const overdueActions = input.actions.filter((a) => isActionOverdue(a, now));
  const recentCutoff = addDays(now, -recentWindowDays).getTime();
  const recentlyCompleted = input.actions.filter(
    (a) =>
      a.status === "COMPLETE" &&
      (a.completedAt ?? a.updatedAt).getTime() >= recentCutoff
  );
  return {
    decisionsWithoutActions,
    openActions,
    overdueActions,
    recentlyCompleted,
    isClear:
      decisionsWithoutActions.length === 0 &&
      openActions.length === 0 &&
      overdueActions.length === 0,
  };
}

// ---------------------------------------------------------------------------
// Weekly review
// ---------------------------------------------------------------------------

export type WeeklyActionReview = {
  weekStart: Date;
  completedThisWeek: ActionItemWithRelations[];
  overdue: ActionItemWithRelations[];
  createdThisWeek: ActionItemWithRelations[];
  fromMeetingsThisWeek: ActionItemWithRelations[];
  unowned: ActionItemWithRelations[];
  blockedNeedingEscalation: ActionItemWithRelations[];
};

/**
 * The action half of weekly review: what got done, what's overdue, what was
 * created (and how much of it came from meetings), what's still unowned, and
 * which blocked work needs escalation. `weekStart` defaults to this Monday.
 */
export function deriveWeeklyActionReview(
  items: ActionItemWithRelations[],
  now: Date = new Date(),
  weekStart: Date = mondayOf(now)
): WeeklyActionReview {
  const ws = weekStart.getTime();
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  return {
    weekStart,
    completedThisWeek: items.filter(
      (i) => i.status === "COMPLETE" && (i.completedAt ?? i.updatedAt).getTime() >= ws
    ),
    overdue: items.filter((i) => isActionOverdue(i, now)),
    createdThisWeek: items.filter((i) => i.createdAt.getTime() >= ws),
    fromMeetingsThisWeek: items.filter(
      (i) => i.createdAt.getTime() >= ws && Boolean(i.officerMeetingId)
    ),
    unowned: items.filter(
      (i) => isOpen(i) && !i.assignments.some((a) => a.role === "EXECUTING")
    ),
    blockedNeedingEscalation: items.filter(
      (i) =>
        i.status === "BLOCKED" &&
        (isActionOverdue(i, now) || lastActivityAt(i).getTime() < staleCutoff)
    ),
  };
}

// ---------------------------------------------------------------------------
// Command center action queue + accountability
// ---------------------------------------------------------------------------

export type OwnerAccountability = {
  ownerId: string;
  ownerName: string;
  open: number;
  overdue: number;
  blocked: number;
  stale: number;
  /** Days the oldest overdue item has been overdue (0 if none). */
  oldestOverdueDays: number;
};

/**
 * Per-owner accountability rows, most-concerning first (overdue, then blocked,
 * then open). Owner = the denormalized lead. Pure.
 */
export function deriveActionAccountabilitySummary(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): OwnerAccountability[] {
  const staleCutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  const byOwner = new Map<string, OwnerAccountability>();
  for (const item of items) {
    if (!isOpen(item)) continue;
    const ownerId = item.leadId;
    const ownerName = item.lead?.name ?? item.lead?.email ?? "Unassigned";
    const row =
      byOwner.get(ownerId) ??
      { ownerId, ownerName, open: 0, overdue: 0, blocked: 0, stale: 0, oldestOverdueDays: 0 };
    row.open += 1;
    if (isActionOverdue(item, now)) {
      row.overdue += 1;
      const days = Math.max(
        0,
        Math.round((startOfDay(now).getTime() - startOfDay(effectiveDeadline(item)).getTime()) / 86_400_000)
      );
      row.oldestOverdueDays = Math.max(row.oldestOverdueDays, days);
    }
    if (item.status === "BLOCKED") row.blocked += 1;
    if (lastActivityAt(item).getTime() < staleCutoff) row.stale += 1;
    byOwner.set(ownerId, row);
  }
  return [...byOwner.values()].sort(
    (a, b) =>
      b.overdue - a.overdue ||
      b.blocked - a.blocked ||
      b.oldestOverdueDays - a.oldestOverdueDays ||
      b.open - a.open ||
      a.ownerName.localeCompare(b.ownerName)
  );
}

export type CommandCenterActionQueue = {
  attention: ReturnType<typeof rankActionAttention>;
  accountability: OwnerAccountability[];
  blocked: ActionItemWithRelations[];
  decisionsWithoutActions: DecisionLite[];
};

/**
 * The Command Center action queue: the ranked attention feed, owner
 * accountability, blocked work, and meeting decisions that never became actions.
 */
export function deriveCommandCenterActionQueue(
  input: { items: ActionItemWithRelations[]; decisions?: DecisionLite[] },
  now: Date = new Date()
): CommandCenterActionQueue {
  return {
    attention: rankActionAttention(input.items, now),
    accountability: deriveActionAccountabilitySummary(input.items, now),
    blocked: input.items.filter((i) => i.status === "BLOCKED"),
    decisionsWithoutActions: deriveMeetingDecisionsWithoutActions(input.decisions ?? []),
  };
}

// ---------------------------------------------------------------------------
// Entity action operating panel
// ---------------------------------------------------------------------------

export type EntityActionPanel = {
  open: ActionItemWithRelations[];
  overdue: ActionItemWithRelations[];
  blocked: ActionItemWithRelations[];
  lastCompleted: ActionItemWithRelations | null;
  /** The single action whose next move matters most for this entity. */
  suggestedNext: { action: ActionItemWithRelations; move: ActionNextMove } | null;
  /** Decisions about this entity that never became actions. */
  decisionsWithoutActions: DecisionLite[];
  /** True when this entity has no live action work at all. */
  isClear: boolean;
};

/**
 * The Action Operating Panel for ONE entity (person / class / partner /
 * instructor / mentorship). `actions` should already be scoped to the entity
 * (e.g. via getActionsForEntity). The suggested next action is the highest
 * attention item, else the soonest-due open one.
 */
export function deriveEntityActionPanel(
  input: { actions: ActionItemWithRelations[]; decisions?: DecisionLite[] },
  now: Date = new Date()
): EntityActionPanel {
  const open = input.actions
    .filter(isOpen)
    .sort((a, b) => effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime());
  const overdue = input.actions.filter((a) => isActionOverdue(a, now));
  const blocked = input.actions.filter((a) => a.status === "BLOCKED");
  const completed = input.actions
    .filter((a) => a.status === "COMPLETE")
    .sort((a, b) => (b.completedAt ?? b.updatedAt).getTime() - (a.completedAt ?? a.updatedAt).getTime());

  const ranked = rankActionAttention(input.actions, now);
  const topId = ranked[0]?.id;
  const suggestedAction =
    (topId ? open.find((a) => a.id === topId) : undefined) ?? open[0] ?? null;

  const decisionsWithoutActions = deriveMeetingDecisionsWithoutActions(input.decisions ?? []);

  return {
    open,
    overdue,
    blocked,
    lastCompleted: completed[0] ?? null,
    suggestedNext: suggestedAction
      ? { action: suggestedAction, move: deriveActionNextMove(suggestedAction, now) }
      : null,
    decisionsWithoutActions,
    isClear: open.length === 0 && decisionsWithoutActions.length === 0,
  };
}
