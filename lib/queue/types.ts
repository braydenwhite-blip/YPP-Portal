import type { Entity360Type } from "@/lib/operations/entity-360";

/**
 * Queue Engine — the canonical operating-loop model (Leadership OS).
 *
 * The portal already tracks "someone has to do something" in many shapes:
 * tracker actions, meeting follow-ups, partner requests, advisor check-ins,
 * applications, mentorships, meeting decisions, and strategic initiatives. The
 * Queue Engine folds every one of those into a SINGLE serializable `QueueItem`
 * — an open loop with a reason, a recommended next move, and a small set of
 * resolution choices (Resolve / Delegate / Discuss / Defer). Pages stop being
 * piles of records and become queues of loops to close.
 *
 * The engine is fully deterministic: the same inputs always produce the same
 * queue in the same order. No AI, no randomness, no clock reads except the
 * `now` the caller injects. Folding lives in `from-*.ts`, ranking in
 * `ranking.ts`, the named queues in `selectors.ts`, and assembly in
 * `engine.ts`. Everything here is pure types + label tables.
 */

/** The four operating resolutions every loop can be closed with. */
export const QUEUE_RESOLUTIONS = ["resolve", "delegate", "discuss", "defer"] as const;
export type QueueResolution = (typeof QUEUE_RESOLUTIONS)[number];

export const QUEUE_RESOLUTION_LABELS: Record<QueueResolution, string> = {
  resolve: "Resolve",
  delegate: "Delegate",
  discuss: "Discuss",
  defer: "Defer",
};

export const QUEUE_RESOLUTION_HINTS: Record<QueueResolution, string> = {
  resolve: "Mark done",
  delegate: "Assign to someone",
  discuss: "Talk it through",
  defer: "Schedule for later",
};

/** Reasons a loop can be deferred — deferring always requires one. */
export const QUEUE_DEFER_REASONS = [
  "waiting_on_someone",
  "needs_meeting_first",
  "needs_more_info",
  "not_important_this_week",
  "owner_unavailable",
  "duplicate_or_irrelevant",
] as const;
export type QueueDeferReason = (typeof QUEUE_DEFER_REASONS)[number];

export const QUEUE_DEFER_REASON_LABELS: Record<QueueDeferReason, string> = {
  waiting_on_someone: "Waiting on someone",
  needs_meeting_first: "Needs a meeting first",
  needs_more_info: "Needs more info",
  not_important_this_week: "Not important this week",
  owner_unavailable: "Owner unavailable",
  duplicate_or_irrelevant: "Duplicate / irrelevant",
};

/**
 * What kind of loop this is — a superset across every source domain. The type
 * drives the icon and the default copy, never the ranking (ranking reads the
 * concrete `signals`).
 */
export const QUEUE_ITEM_TYPES = [
  "action",
  "follow_up",
  "meeting",
  "meeting_prep",
  "decision",
  "initiative",
  "partner_request",
  "partner_follow_up",
  "advisor_check_in",
  "application",
  "mentorship",
  "class_setup",
  "person",
] as const;
export type QueueItemType = (typeof QUEUE_ITEM_TYPES)[number];

export const QUEUE_ITEM_TYPE_LABELS: Record<QueueItemType, string> = {
  action: "Action",
  follow_up: "Meeting follow-up",
  meeting: "Meeting",
  meeting_prep: "Meeting prep",
  decision: "Decision",
  initiative: "Initiative",
  partner_request: "Partner request",
  partner_follow_up: "Partner follow-up",
  advisor_check_in: "Advisor check-in",
  application: "Application",
  mentorship: "Mentorship",
  class_setup: "Class setup",
  person: "Person",
};

/** Calm → on-fire. Used for tone and as the ranking base weight. */
export const QUEUE_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type QueueSeverity = (typeof QUEUE_SEVERITIES)[number];

export type QueueTone = "danger" | "warning" | "info" | "brand" | "neutral" | "success";

/**
 * The deterministic signal set behind a loop. Ranking reads ONLY these (plus
 * severity and timing) so the order is explainable and unit-tested. Each flag
 * maps to a concrete fact about the underlying record.
 */
export type QueueSignals = {
  /** Past its due date. */
  overdue: boolean;
  /** Blocked / blocking other work. */
  blocking: boolean;
  /** No owner / unassigned. */
  missingOwner: boolean;
  /** Decided or discussed, but no concrete next step recorded. */
  missingNextStep: boolean;
  /** Tied to a meeting that is coming up (prep) or just happened (follow-up). */
  connectedToMeeting: boolean;
  /** Tied to a flagship / high-priority initiative. */
  flagshipInitiative: boolean;
  /** Escalated to leadership. */
  escalated: boolean;
  /** Drifting — no movement for a while. */
  stale: boolean;
  /** Owned by / assigned to the current viewer. */
  mine: boolean;
  /** Created recently and still open (fresh debt). */
  recentlyCreated: boolean;
  /** A decision is required by a leader. */
  needsDecision: boolean;
  /** Waiting on another person before it can move. */
  waitingOn: boolean;
  /** Small, fast to clear — a quick win. */
  quickWin: boolean;
};

export function emptyQueueSignals(): QueueSignals {
  return {
    overdue: false,
    blocking: false,
    missingOwner: false,
    missingNextStep: false,
    connectedToMeeting: false,
    flagshipInitiative: false,
    escalated: false,
    stale: false,
    mine: false,
    recentlyCreated: false,
    needsDecision: false,
    waitingOn: false,
    quickWin: false,
  };
}

/** A concrete route forward. `href` opens the workflow that owns the mutation. */
export type QueueAction = {
  /** Which resolution this action enacts (drives icon / styling). */
  resolution: QueueResolution | "open";
  label: string;
  /** The workflow this routes into (record page, scheduler, agenda, …). */
  href: string;
  /** One sentence: what doing this accomplishes. */
  hint?: string;
};

/** A connected record, rendered as a chip that can open its 360 drawer. */
export type QueueEntityRef = {
  type: Entity360Type;
  id: string;
  label: string;
};

/**
 * The real, inline-completable workflow behind a loop — the thing that lets My
 * Queue be a work surface, not an inbox. Each variant carries the actual record
 * id and maps to an EXISTING domain mutation (re-checked server-side); the
 * runner renders the matching panel. When this is null the loop has no safe
 * inline action and the runner routes to its full record instead. Serializable
 * end-to-end so it can ride from the server engine to the client runner.
 */
export type QueueInline =
  | {
      kind: "action";
      /** ActionItem id — `captureActionCompletion` / `captureActionBlocker`. */
      actionId: string;
      blockedReason: string | null;
      completionNote: string | null;
      completionOutcome: string | null;
      nextFollowUpISO: string | null;
    }
  | {
      kind: "decision";
      /** MeetingDecision id — `convertDecisionToAction`. */
      decisionId: string;
    }
  | {
      kind: "follow_up";
      /** MeetingFollowUp id — `setFollowUpStatus` / `convertFollowUpToAction`. */
      followUpId: string;
    }
  | {
      kind: "mentorship_commitment";
      /** MentorshipActionItem id — `updateMentorshipActionItemStatus` (→ COMPLETE). */
      actionItemId: string;
      /** The mentee the commitment belongs to (re-checked server-side for access). */
      menteeId: string;
      /** Shown in the panel so the mentor confirms the right commitment. */
      title: string;
    };

/**
 * The canonical open loop. Every queue across the portal is a list of these,
 * ranked deterministically. Serializable end-to-end (server → client).
 */
export type QueueItem = {
  /** Globally unique, source-namespaced (`wh:action:…`, `att:…`, `dec:…`). */
  id: string;
  type: QueueItemType;
  typeLabel: string;
  title: string;
  severity: QueueSeverity;
  tone: QueueTone;

  /** The record this loop came from (opens its 360 drawer). */
  source: QueueEntityRef | null;
  /** Who owns / is accountable for it. */
  ownerName: string | null;
  ownerId: string | null;
  /** The meeting it came from / is headed into. */
  relatedMeeting: { id: string; title: string } | null;
  /** The strategic initiative it rolls up to. */
  relatedInitiative: { id: string; title: string } | null;
  /** The person it concerns (mentee, advisee, applicant). */
  relatedPerson: QueueEntityRef | null;

  /** One sentence: why this matters / what is at stake. */
  why: string;
  /** The concrete next move, phrased as an instruction. */
  recommendedMove: string | null;

  /** The single dominant action. */
  primaryAction: QueueAction;
  /** Everything else available (the resolution dock derives from these). */
  secondaryActions: QueueAction[];
  /** Which of the four resolutions apply to this loop. */
  resolutions: QueueResolution[];

  /**
   * The real inline workflow, when one exists — lets the runner close the loop
   * in place (complete an action, convert a decision, handle a follow-up)
   * instead of just routing away. Null → no safe inline action; open the record.
   */
  inline: QueueInline | null;

  /** Display status ("Overdue 3d", "Decision needed", "Due Jun 12"). */
  statusLabel: string;
  /** Compact recency/urgency read ("6 days overdue", "quiet 60 days"). */
  ageLabel: string | null;

  dueISO: string | null;
  createdISO: string | null;
  updatedISO: string | null;

  signals: QueueSignals;
  /** Deterministic, stable reason string ("overdue:3d|blocking|unowned"). */
  reason: string;
  /** Precomputed ranking score (higher = sooner). Set by the engine. */
  score: number;

  /** The full record page (drawer "open full record" link). */
  href: string;
};

/** The named queues the engine assembles. */
export const QUEUE_KEYS = [
  "my",
  "leadership",
  "quick-wins",
  "decisions",
  "meeting-prep",
  "post-meeting",
  "unblock",
  "owner-accountability",
  "initiative-cleanup",
  "weekly-review",
  "waiting",
] as const;
export type QueueKey = (typeof QUEUE_KEYS)[number];

export type QueueDescriptor = {
  key: QueueKey;
  label: string;
  /** One line: what closing this queue accomplishes. */
  tagline: string;
  /** The operating verb shown on the cockpit rail. */
  accent: QueueTone;
};

export const QUEUE_DESCRIPTORS: Record<QueueKey, QueueDescriptor> = {
  my: {
    key: "my",
    label: "My queue",
    tagline: "Loops you own that are open right now.",
    accent: "brand",
  },
  leadership: {
    key: "leadership",
    label: "Leadership queue",
    tagline: "The highest-leverage loops across the org.",
    accent: "danger",
  },
  "quick-wins": {
    key: "quick-wins",
    label: "Quick wins",
    tagline: "Small loops you can clear in one pass.",
    accent: "success",
  },
  decisions: {
    key: "decisions",
    label: "Decisions needed",
    tagline: "Loops waiting on a leadership call.",
    accent: "warning",
  },
  "meeting-prep": {
    key: "meeting-prep",
    label: "Meeting prep",
    tagline: "What to review before the next meetings.",
    accent: "info",
  },
  "post-meeting": {
    key: "post-meeting",
    label: "Post-meeting",
    tagline: "Follow-ups still open from past meetings.",
    accent: "warning",
  },
  unblock: {
    key: "unblock",
    label: "Unblock",
    tagline: "Blocked work holding up everything downstream.",
    accent: "danger",
  },
  "owner-accountability": {
    key: "owner-accountability",
    label: "Owner Needed",
    tagline: "Active work with no eligible accountable Lead.",
    accent: "warning",
  },
  "initiative-cleanup": {
    key: "initiative-cleanup",
    label: "Initiative cleanup",
    tagline: "Initiatives drifting without a next move.",
    accent: "info",
  },
  "weekly-review": {
    key: "weekly-review",
    label: "Weekly review",
    tagline: "Everything to close before the week resets.",
    accent: "brand",
  },
  waiting: {
    key: "waiting",
    label: "Waiting on",
    tagline: "Loops parked on someone else.",
    accent: "neutral",
  },
};

export function isQueueKey(value: string | undefined | null): value is QueueKey {
  return (QUEUE_KEYS as readonly string[]).includes(value ?? "");
}

/** A live count + a preview for a named queue (cockpit rail / stat header). */
export type QueueLane = {
  descriptor: QueueDescriptor;
  count: number;
  /** Worst-first preview (the rail shows the top few). */
  items: QueueItem[];
};

/** One owner's open-loop load (the Owner Accountability lane). */
export type OwnerLane = {
  ownerId: string | null;
  ownerName: string;
  open: number;
  overdue: number;
  blocked: number;
  unowned: boolean;
  items: QueueItem[];
};

/** The headline counts shown atop Mission Control. */
export type QueueSummary = {
  openLoops: number;
  mine: number;
  overdue: number;
  blocked: number;
  unowned: number;
  needsDecision: number;
  quickWins: number;
  upcomingMeetings: number;
  /** Concrete "cleared this week" counts (from the weekly review). */
  clearedThisWeek: number;
};
