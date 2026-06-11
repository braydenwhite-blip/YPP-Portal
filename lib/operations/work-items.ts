import type { ActionPriority } from "@prisma/client";

import {
  actionPrefillToQuery,
  buildActionPrefillFromMeetingFollowUp,
} from "@/lib/people-strategy/action-prefill";
import type { RelatedEntityType } from "@/lib/people-strategy/constants";
import type {
  ActionLite,
  MeetingFollowUpLite,
} from "@/lib/people-strategy/operational-digest";

/**
 * Data 360 — the unified Work Item.
 *
 * The portal tracks "things someone has to do" in two stores: tracker actions
 * (`ActionItem`) and meeting follow-ups (`MeetingFollowUp`). Leaders should not
 * have to know which store a piece of work lives in, so this module folds both
 * into ONE serializable shape and ONE grouping rule. It consumes the digest's
 * existing lite projections (`ActionLite` / `MeetingFollowUpLite`) — the same
 * inputs the Command Center renders — so "overdue" and "blocked" can never mean
 * different things on different pages. Every function here is PURE (no DB, no
 * session; callers inject `now`) and unit-tested with plain fixtures.
 */

export type WorkItemKind = "action" | "follow_up";

export type WorkItemTone = "danger" | "warning" | "info" | "success" | "neutral";

/**
 * The board lanes, in triage order. Lanes are MUTUALLY EXCLUSIVE — an item
 * lands in exactly one, decided by the first rule that matches (overdue beats
 * blocked beats ownerless …), so the board never shows the same work twice.
 */
export const WORK_LANES = [
  "overdue",
  "blocked",
  "needs_owner",
  "due_soon",
  "in_progress",
  "not_started",
  "done_recently",
] as const;
export type WorkLane = (typeof WORK_LANES)[number];

export const WORK_LANE_LABELS: Record<WorkLane, string> = {
  overdue: "Overdue",
  blocked: "Blocked",
  needs_owner: "Needs an owner",
  due_soon: "Due soon",
  in_progress: "In progress",
  not_started: "Not started",
  done_recently: "Done recently",
};

/** What each lane means — rendered as the lane hint so the board teaches itself. */
export const WORK_LANE_HINTS: Record<WorkLane, string> = {
  overdue: "Past the deadline — rescue or reschedule",
  blocked: "Stuck until someone unblocks it",
  needs_owner: "Nobody is on the hook yet",
  due_soon: "Due within the week",
  in_progress: "Moving — keep it moving",
  not_started: "Scheduled but untouched",
  done_recently: "Completed in the last week",
};

export const WORK_SOURCE_LABELS: Record<WorkItemKind, string> = {
  action: "Action",
  follow_up: "Meeting follow-up",
};

export type WorkItem = {
  /** Globally unique across kinds (`action:…` / `follow_up:…`). */
  id: string;
  kind: WorkItemKind;
  title: string;
  /** Display status ("Overdue 3d", "Blocked", "Due Jun 12", …). */
  status: string;
  tone: WorkItemTone;
  ownerName: string | null;
  dueISO: string | null;
  priority: ActionPriority;
  /** Where this work came from ("Action" / "Meeting follow-up"). */
  sourceLabel: string;
  /** The meeting this came out of, when it did. */
  meetingTitle: string | null;
  relatedType: RelatedEntityType | null;
  relatedId: string | null;
  relatedLabel: string | null;
  nextStep: string | null;
  overdue: boolean;
  blocked: boolean;
  unassigned: boolean;
  completedISO: string | null;
  href: string;
  /** Prefilled `/actions/new` link for follow-ups not yet in the tracker. */
  convertHref: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days ahead a due date counts as "due soon" (mirrors the digest's window). */
export const WORK_DUE_SOON_DAYS = 7;
/** Days back a completed item still shows in "Done recently". */
export const WORK_DONE_RECENTLY_DAYS = 7;

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// --- converters ----------------------------------------------------------------

/** Fold a tracker action into the unified work-item shape. */
export function workItemFromAction(action: ActionLite): WorkItem {
  let status: string;
  let tone: WorkItemTone;
  if (action.status === "COMPLETE") {
    status = "Completed";
    tone = "success";
  } else if (action.status === "DROPPED") {
    status = "Dropped";
    tone = "neutral";
  } else if (action.overdue) {
    status = `Overdue ${action.daysOverdue}d`;
    tone = "danger";
  } else if (action.blocked) {
    status = "Blocked";
    tone = "warning";
  } else {
    status = `Due ${shortDate(action.dueISO)}`;
    tone = action.status === "IN_PROGRESS" ? "info" : "neutral";
  }
  return {
    id: `action:${action.id}`,
    kind: "action",
    title: action.title,
    status,
    tone,
    ownerName: action.ownerName,
    dueISO: action.dueISO,
    priority: action.priority,
    sourceLabel: action.sourceMeetingTitle
      ? WORK_SOURCE_LABELS.follow_up
      : WORK_SOURCE_LABELS.action,
    meetingTitle: action.sourceMeetingTitle,
    relatedType: action.relatedType,
    relatedId: action.relatedId,
    relatedLabel: action.relatedLabel,
    nextStep: action.nextStep,
    overdue: action.overdue,
    blocked: action.blocked,
    unassigned: action.unassigned,
    completedISO: action.completedISO ?? null,
    href: action.href,
    convertHref: null,
  };
}

/**
 * Fold an UNCONVERTED meeting follow-up into the unified shape. Converted
 * follow-ups already live in the tracker as actions, so callers must pass only
 * the unconverted ones (the digest's `unconvertedFollowUps` does exactly that)
 * — otherwise the same work would appear twice.
 */
export function workItemFromFollowUp(
  followUp: MeetingFollowUpLite,
  now: Date = new Date()
): WorkItem {
  const due = followUp.dueISO ? new Date(followUp.dueISO) : null;
  const completed = followUp.status === "completed";
  const overdue = followUp.status === "overdue";
  let status: string;
  let tone: WorkItemTone;
  if (completed) {
    status = "Completed";
    tone = "success";
  } else if (overdue && due) {
    const days = Math.max(1, Math.floor((now.getTime() - due.getTime()) / DAY_MS));
    status = `Overdue ${days}d`;
    tone = "danger";
  } else if (due) {
    status = `Due ${shortDate(followUp.dueISO as string)}`;
    tone = followUp.status === "in_progress" ? "info" : "neutral";
  } else {
    status = "No due date";
    tone = "warning";
  }
  return {
    id: `follow_up:${followUp.id}`,
    kind: "follow_up",
    title: followUp.title,
    status,
    tone,
    ownerName: followUp.ownerName,
    dueISO: followUp.dueISO,
    priority: followUp.priority,
    sourceLabel: WORK_SOURCE_LABELS.follow_up,
    meetingTitle: followUp.meetingTitle,
    relatedType: followUp.relatedType,
    relatedId: followUp.relatedId,
    relatedLabel: followUp.relatedLabel,
    nextStep: followUp.description,
    overdue,
    blocked: false,
    unassigned: !followUp.ownerName,
    completedISO: null,
    href: followUp.href,
    convertHref: actionPrefillToQuery(
      buildActionPrefillFromMeetingFollowUp({
        followUpId: followUp.id,
        title: followUp.title,
        description: followUp.description,
        meetingId: followUp.meetingId,
        meetingTitle: followUp.meetingTitle,
        meetingCategory: followUp.meetingCategory,
        relatedEntityType: followUp.relatedType,
        relatedEntityId: followUp.relatedId,
        suggestedOwnerId: followUp.ownerId,
        dueDate: followUp.dueISO ? followUp.dueISO.slice(0, 10) : null,
      })
    ),
  };
}

/**
 * The unified work list: every visible tracker action plus every unconverted
 * meeting follow-up, as one deduped list. DROPPED actions are noise (work that
 * was intentionally abandoned) and are excluded.
 */
export function buildUnifiedWorkItems(input: {
  actions: ActionLite[];
  followUps: MeetingFollowUpLite[];
  now?: Date;
}): WorkItem[] {
  const now = input.now ?? new Date();
  const items: WorkItem[] = [];
  for (const action of input.actions) {
    if (action.status === "DROPPED") continue;
    items.push(workItemFromAction(action));
  }
  for (const followUp of input.followUps) {
    items.push(workItemFromFollowUp(followUp, now));
  }
  return items;
}

// --- grouping --------------------------------------------------------------------

export type WorkBoard = Record<WorkLane, WorkItem[]>;

/** Which single lane does this item belong to? First matching rule wins. */
export function laneForWorkItem(item: WorkItem, now: Date = new Date()): WorkLane | null {
  if (item.completedISO || item.status === "Completed") {
    const completedAt = item.completedISO ? new Date(item.completedISO).getTime() : null;
    const cutoff = now.getTime() - WORK_DONE_RECENTLY_DAYS * DAY_MS;
    if (completedAt == null || completedAt >= cutoff) return "done_recently";
    return null; // Old completions fall off the board entirely.
  }
  if (item.overdue) return "overdue";
  if (item.blocked) return "blocked";
  if (item.unassigned) return "needs_owner";
  if (item.dueISO) {
    const due = new Date(item.dueISO).getTime();
    if (due <= now.getTime() + WORK_DUE_SOON_DAYS * DAY_MS) return "due_soon";
  }
  if (item.tone === "info") return "in_progress";
  return "not_started";
}

const PRIORITY_WEIGHT: Record<ActionPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

/**
 * Group unified work items into the board lanes. Within a lane, the most
 * urgent work sorts first: higher priority, then earlier due date, then title
 * (a stable, deterministic order — same inputs, same board).
 */
export function groupWorkItems(items: WorkItem[], now: Date = new Date()): WorkBoard {
  const board: WorkBoard = {
    overdue: [],
    blocked: [],
    needs_owner: [],
    due_soon: [],
    in_progress: [],
    not_started: [],
    done_recently: [],
  };
  for (const item of items) {
    const lane = laneForWorkItem(item, now);
    if (lane) board[lane].push(item);
  }
  const byUrgency = (a: WorkItem, b: WorkItem) => {
    const priority = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (priority !== 0) return priority;
    const aDue = a.dueISO ? new Date(a.dueISO).getTime() : Number.POSITIVE_INFINITY;
    const bDue = b.dueISO ? new Date(b.dueISO).getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue || a.title.localeCompare(b.title);
  };
  for (const lane of WORK_LANES) {
    if (lane === "done_recently") {
      board[lane].sort((a, b) => {
        const aDone = a.completedISO ? new Date(a.completedISO).getTime() : 0;
        const bDone = b.completedISO ? new Date(b.completedISO).getTime() : 0;
        return bDone - aDone || a.title.localeCompare(b.title);
      });
    } else {
      board[lane].sort(byUrgency);
    }
  }
  return board;
}

/** Open (not done) item count across the board — the "how much is in flight" read. */
export function countOpenWorkItems(board: WorkBoard): number {
  return WORK_LANES.filter((lane) => lane !== "done_recently").reduce(
    (sum, lane) => sum + board[lane].length,
    0
  );
}
