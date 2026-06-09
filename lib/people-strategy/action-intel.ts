import { addDays, startOfDay } from "@/lib/leadership-action-center/dates";

import type { ActionItemWithRelations } from "./action-queries";
import {
  buildAttentionQueue,
  daysOverdue,
  lastActivityAt,
  STALE_ACTIVITY_DAYS,
  type AttentionEntry,
  type AttentionSeverity,
} from "./command-center-selectors";
import { effectiveDeadline, isActionOverdue } from "./my-actions-selectors";
import {
  deriveActionSource,
  deriveActionSourceLabel,
  deriveActionStrategicLinkage,
  isActionSourceType,
} from "./action-source";
import {
  deriveActionQualityWarnings,
  type ActionQualityInput,
} from "./action-quality";

/**
 * Action System 4.0 — ACTION INTELLIGENCE (pure).
 *
 * The derivation engine that turns a loaded action (or a draft on the creation
 * form) into the signals every surface needs: urgency, quality warnings +
 * labels, the single "next best move", a ranked attention feed, an operational
 * inbox grouping, fastest wins, and stale work. Pure: no DB, no React, no
 * session — `now` is always injected so every function unit-tests
 * deterministically.
 *
 * It REUSES the existing canonical primitives ({@link effectiveDeadline},
 * {@link isActionOverdue}, {@link daysOverdue}, {@link lastActivityAt},
 * {@link buildAttentionQueue}, {@link deriveActionSource}) rather than
 * re-deriving them — there is one source of truth for "overdue", "stale", and
 * "attention".
 */

/** Window (days) inside which an upcoming action counts as "due soon". Mirrors
 *  the inbox `due_soon` preset (ACTION_DUE_SOON_DAYS) so the two never drift. */
export const ACTION_DUE_SOON_WINDOW_DAYS = 7;
/** A "fastest win" is a tiny, owned, unblocked action due within this window. */
export const FASTEST_WIN_WINDOW_DAYS = 7;

// ---------------------------------------------------------------------------
// Urgency
// ---------------------------------------------------------------------------

export type ActionUrgencyLevel =
  | "settled"
  | "overdue"
  | "due_today"
  | "due_soon"
  | "scheduled";

export type ActionUrgency = {
  level: ActionUrgencyLevel;
  label: string;
  /** Whole days past the deadline (0 unless overdue). */
  daysOverdue: number;
  /** Whole days until the deadline (0 when due today; negative when overdue). */
  daysUntilDue: number;
};

const URGENCY_LABEL: Record<ActionUrgencyLevel, string> = {
  settled: "Settled",
  overdue: "Overdue",
  due_today: "Due today",
  due_soon: "Due soon",
  scheduled: "Scheduled",
};

/** Resolve an action's deadline urgency. Settled (COMPLETE/DROPPED) short-circuits. */
export function deriveActionUrgency(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionUrgency {
  if (item.status === "COMPLETE" || item.status === "DROPPED") {
    return { level: "settled", label: URGENCY_LABEL.settled, daysOverdue: 0, daysUntilDue: 0 };
  }
  const overdue = daysOverdue(item, now);
  if (isActionOverdue(item, now)) {
    return { level: "overdue", label: URGENCY_LABEL.overdue, daysOverdue: overdue, daysUntilDue: -overdue };
  }
  const today = startOfDay(now).getTime();
  const due = startOfDay(effectiveDeadline(item)).getTime();
  const daysUntilDue = Math.round((due - today) / 86_400_000);
  let level: ActionUrgencyLevel;
  if (daysUntilDue <= 0) level = "due_today";
  else if (daysUntilDue <= ACTION_DUE_SOON_WINDOW_DAYS) level = "due_soon";
  else level = "scheduled";
  return { level, label: URGENCY_LABEL[level], daysOverdue: 0, daysUntilDue };
}

// ---------------------------------------------------------------------------
// Quality warnings (re-exported from the dependency-free action-quality module
// so server callers can reach them here, while the client form imports them
// directly without pulling in the query/prisma layer).
// ---------------------------------------------------------------------------

export {
  deriveActionQualityWarnings,
  isVagueTitle,
  type ActionQualityInput,
  type ActionWarning,
  type ActionWarningCode,
  type ActionWarningSeverity,
} from "./action-quality";

/** Map a loaded action to the quality-engine input. */
export function actionToQualityInput(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionQualityInput {
  const hasOwner = item.assignments.some((a) => a.role === "EXECUTING");
  const linkage = deriveActionStrategicLinkage(item);
  return {
    title: item.title,
    hasOwner,
    hasDueDate: true, // saved rows always carry a deadlineStart
    successDefinition: item.successDefinition,
    status: item.status,
    blockedReason: item.blockedReason,
    completionNote: item.completionNote,
    sourceType: isActionSourceType(item.sourceType) ? item.sourceType : null,
    hasStrategicLink: linkage.hasExplicitLink,
    isOverdue: isActionOverdue(item, now),
    nextFollowUpAt: item.nextFollowUpAt,
  };
}

// ---------------------------------------------------------------------------
// Quality labels (the badge an action wears)
// ---------------------------------------------------------------------------

export type ActionLabelKey =
  | "strong"
  | "overdue"
  | "blocked_escalate"
  | "stale"
  | "needs_owner"
  | "needs_due_date"
  | "define_done"
  | "missing_context"
  | "follow_up_needed"
  | "ready_to_close";

export type ActionLabelTone = "good" | "warn" | "danger" | "info";

export type ActionLabel = { key: ActionLabelKey; text: string; tone: ActionLabelTone };

const LABELS: Record<ActionLabelKey, ActionLabel> = {
  strong: { key: "strong", text: "Strong action", tone: "good" },
  overdue: { key: "overdue", text: "Overdue", tone: "danger" },
  blocked_escalate: { key: "blocked_escalate", text: "Blocked — needs escalation", tone: "danger" },
  stale: { key: "stale", text: "Stale", tone: "warn" },
  needs_owner: { key: "needs_owner", text: "Needs owner", tone: "danger" },
  needs_due_date: { key: "needs_due_date", text: "Needs due date", tone: "warn" },
  define_done: { key: "define_done", text: "Define done", tone: "warn" },
  missing_context: { key: "missing_context", text: "Missing context", tone: "info" },
  follow_up_needed: { key: "follow_up_needed", text: "Follow-up needed", tone: "info" },
  ready_to_close: { key: "ready_to_close", text: "Ready to close", tone: "good" },
};

/**
 * Reduce an action to its labels. The first entry is the PRIMARY label (the one
 * a compact card shows). A clean action with owner + due + definition of done
 * earns the positive "Strong action"; otherwise the most serious gap wins.
 */
export function deriveActionQualityLabels(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionLabel[] {
  const out: ActionLabel[] = [];
  const isStale =
    item.status !== "COMPLETE" &&
    item.status !== "DROPPED" &&
    lastActivityAt(item).getTime() < addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  const overdue = isActionOverdue(item, now);

  if (item.status === "BLOCKED" && (overdue || isStale)) out.push(LABELS.blocked_escalate);
  if (overdue) out.push(LABELS.overdue);
  if (isStale) out.push(LABELS.stale);

  const warnings = deriveActionQualityWarnings(actionToQualityInput(item, now));
  for (const w of warnings) {
    if (w.code === "NEEDS_OWNER") out.push(LABELS.needs_owner);
    if (w.code === "DEFINE_DONE") out.push(LABELS.define_done);
    if (w.code === "STRATEGIC_UNLINKED") out.push(LABELS.missing_context);
    if (w.code === "NEEDS_FOLLOWUP_DATE") out.push(LABELS.follow_up_needed);
  }

  // De-dup by key, preserving order/severity.
  const seen = new Set<ActionLabelKey>();
  const deduped = out.filter((l) => (seen.has(l.key) ? false : (seen.add(l.key), true)));

  if (deduped.length === 0) {
    // No gaps: positive read. "Ready to close" when in-progress and defined.
    if (item.status === "IN_PROGRESS") return [LABELS.ready_to_close];
    return [LABELS.strong];
  }
  return deduped;
}

// ---------------------------------------------------------------------------
// Next best move
// ---------------------------------------------------------------------------

export type ActionNextMoveKind =
  | "escalate"
  | "reschedule"
  | "assign"
  | "start"
  | "define"
  | "capture_outcome"
  | "schedule_follow_up"
  | "advance";

export type ActionNextMove = {
  kind: ActionNextMoveKind;
  /** What to do next. */
  move: string;
  /** Why it matters. */
  why: string;
  /** What happens if nothing changes. */
  ifIgnored: string;
  /** The recommended CTA label. */
  ctaLabel: string;
};

/**
 * The single most useful next step for ONE action, by state precedence
 * (blocked → overdue → unowned → undefined → not-started → in-flight →
 * complete-needs-note). Powers the detail "what matters now" panel and the
 * inbox card CTA.
 */
export function deriveActionNextMove(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionNextMove {
  const urgency = deriveActionUrgency(item, now);
  const hasOwner = item.assignments.some((a) => a.role === "EXECUTING");

  if (item.status === "BLOCKED") {
    const reason = (item.blockedReason ?? "").trim();
    return {
      kind: "escalate",
      move: reason ? "Clear the blocker or escalate it" : "Name the blocker, then escalate",
      why: reason || "It's marked blocked with no reason — nobody can act on it.",
      ifIgnored: "Everything downstream of this stays stuck.",
      ctaLabel: "Escalate blocker",
    };
  }
  if (urgency.level === "overdue") {
    return {
      kind: "reschedule",
      move: "Finish it or reset the deadline honestly",
      why: `It's ${urgency.daysOverdue} day${urgency.daysOverdue === 1 ? "" : "s"} overdue.`,
      ifIgnored: "It rots and drags the whole queue's credibility down.",
      ctaLabel: "Update status",
    };
  }
  if (!hasOwner) {
    return {
      kind: "assign",
      move: "Assign a real owner",
      why: "Unowned work doesn't happen.",
      ifIgnored: "This quietly disappears.",
      ctaLabel: "Assign action",
    };
  }
  if (!(item.successDefinition ?? "").trim()) {
    return {
      kind: "define",
      move: "Define what done means",
      why: "Without a finish line, this drifts.",
      ifIgnored: "It stays 'in progress' forever.",
      ctaLabel: "Define done",
    };
  }
  if (item.status === "NOT_STARTED") {
    return {
      kind: "start",
      move: urgency.level === "due_today" || urgency.level === "due_soon"
        ? "Start it now — it's due soon"
        : "Make the first move",
      why: "Started work is the only work that finishes.",
      ifIgnored: "It slips toward overdue.",
      ctaLabel: "Mark in progress",
    };
  }
  if (item.status === "COMPLETE" && !(item.completionNote ?? "").trim()) {
    return {
      kind: "capture_outcome",
      move: "Capture the outcome",
      why: "A completed action with no record teaches nothing.",
      ifIgnored: "The win is invisible at review.",
      ctaLabel: "Add completion note",
    };
  }
  return {
    kind: "advance",
    move: "Keep it moving",
    why: "It's owned, defined, and on track.",
    ifIgnored: "Stays healthy as long as it keeps moving.",
    ctaLabel: "Open action",
  };
}

// ---------------------------------------------------------------------------
// Ranked attention feed (builds on the canonical attention queue)
// ---------------------------------------------------------------------------

export type RankedAttentionItem = AttentionEntry & {
  sourceLabel: string;
  nextMove: ActionNextMove;
};

/**
 * The inbox "Needs attention" feed. Reuses {@link buildAttentionQueue} (the
 * canonical, conservative severity model) and enriches each entry with its
 * honest source label + recommended next move. Already severity-sorted.
 */
export function rankActionAttention(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): RankedAttentionItem[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  return buildAttentionQueue(items, now).map((entry) => {
    const item = byId.get(entry.id)!;
    return {
      ...entry,
      sourceLabel: deriveActionSourceLabel(item),
      nextMove: deriveActionNextMove(item, now),
    };
  });
}

// ---------------------------------------------------------------------------
// Operational inbox grouping
// ---------------------------------------------------------------------------

export type ActionInboxGroupKey =
  | "needs_attention"
  | "unowned"
  | "no_due_date"
  | "blocked"
  | "due_soon"
  | "stale"
  | "fastest_wins";

export type ActionInboxGroup = {
  key: ActionInboxGroupKey;
  label: string;
  description: string;
  items: ActionItemWithRelations[];
};

const INBOX_GROUP_META: Record<ActionInboxGroupKey, { label: string; description: string }> = {
  needs_attention: { label: "Needs attention", description: "Overdue, blocked, flagged, or stale — handle first." },
  unowned: { label: "No owner", description: "Nobody is executing these yet." },
  no_due_date: { label: "No due date", description: "Open work with no deadline to anchor it." },
  blocked: { label: "Blocked", description: "Waiting on something — unblock or escalate." },
  due_soon: { label: "Due soon", description: "Due within a week and on track." },
  stale: { label: "Stale", description: "No movement in two weeks." },
  fastest_wins: { label: "Fastest wins", description: "Small, owned, due soon — clear the clutter." },
};

const isOpen = (i: ActionItemWithRelations) => i.status !== "COMPLETE" && i.status !== "DROPPED";

/**
 * Turn a flat list of actions into the operational inbox. Groups are computed
 * independently (an action can appear in more than one, e.g. blocked + stale) so
 * each lens is complete; surfaces choose which to render. Empty groups are
 * dropped. Pure + deterministic via injected `now`.
 */
export function deriveActionInboxGroups(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionInboxGroup[] {
  const attentionIds = new Set(rankActionAttention(items, now).map((e) => e.id));
  const open = items.filter(isOpen);

  const raw: Array<{ key: ActionInboxGroupKey; items: ActionItemWithRelations[] }> = [
    { key: "needs_attention", items: items.filter((i) => attentionIds.has(i.id)) },
    { key: "blocked", items: open.filter((i) => i.status === "BLOCKED") },
    { key: "unowned", items: open.filter((i) => !i.assignments.some((a) => a.role === "EXECUTING")) },
    {
      key: "due_soon",
      items: open.filter((i) => {
        const u = deriveActionUrgency(i, now);
        return u.level === "due_today" || u.level === "due_soon";
      }),
    },
    { key: "stale", items: deriveActionStaleGroup(items, now) },
    { key: "fastest_wins", items: deriveActionFastestWins(items, now) },
  ];
  const groups: ActionInboxGroup[] = raw.map((g) => ({ ...g, ...INBOX_GROUP_META[g.key] }));

  // `no_due_date` only applies to draft/legacy rows without a deadline; saved
  // rows always have one, so it is computed but typically empty.
  return groups.filter((g) => g.items.length > 0);
}

// ---------------------------------------------------------------------------
// Fastest wins + stale
// ---------------------------------------------------------------------------

/**
 * Small, owned, unblocked actions due within the window — the ones a person can
 * clear in one sitting to shrink the open count. Not overdue (those are
 * attention, not wins). Sorted soonest-due first.
 */
export function deriveActionFastestWins(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionItemWithRelations[] {
  return items
    .filter((i) => {
      if (!isOpen(i)) return false;
      if (i.status === "BLOCKED") return false;
      if (isActionOverdue(i, now)) return false;
      if (!i.assignments.some((a) => a.role === "EXECUTING")) return false;
      const u = deriveActionUrgency(i, now);
      return u.level === "due_today" || u.level === "due_soon";
    })
    .sort((a, b) => effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime());
}

/**
 * Open actions with no activity (update or comment) in {@link STALE_ACTIVITY_DAYS}
 * days, most-stale first. Reuses the canonical {@link lastActivityAt}.
 */
export function deriveActionStaleGroup(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): ActionItemWithRelations[] {
  const cutoff = addDays(now, -STALE_ACTIVITY_DAYS).getTime();
  return items
    .filter((i) => isOpen(i) && lastActivityAt(i).getTime() < cutoff)
    .sort((a, b) => lastActivityAt(a).getTime() - lastActivityAt(b).getTime());
}

// ---------------------------------------------------------------------------
// By-source grouping (enabled by the honest source contract)
// ---------------------------------------------------------------------------

export type ActionSourceGroup = {
  sourceType: string;
  label: string;
  items: ActionItemWithRelations[];
};

const SOURCE_GROUP_ORDER = [
  "MEETING_DECISION",
  "MEETING",
  "PROJECT",
  "INITIATIVE",
  "ENTITY",
  "WEEKLY_REVIEW",
  "COMMAND_CENTER",
  "FOLLOW_UP",
  "MANUAL",
];

/** Group actions by their (explicit or inferred) source, in a stable order. */
export function deriveActionSourceGroups(
  items: ActionItemWithRelations[]
): ActionSourceGroup[] {
  const byType = new Map<string, ActionItemWithRelations[]>();
  for (const item of items) {
    const src = deriveActionSource(item);
    const list = byType.get(src.type) ?? [];
    list.push(item);
    byType.set(src.type, list);
  }
  return SOURCE_GROUP_ORDER.filter((t) => byType.has(t)).map((t) => ({
    sourceType: t,
    label: deriveActionSourceLabel({ sourceType: t }),
    items: byType.get(t)!,
  }));
}
