import type { EffectiveMeetingStatus } from "./meetings-status";

/**
 * People Strategy — Meeting Command Center selectors (PURE).
 *
 * The workflow brain behind the redesigned Meetings page. Every function here is
 * a pure function of the data passed in (`now` is injected, never read from the
 * clock implicitly) so the whole module is unit-testable with plain fixtures —
 * mirroring `meetings-status.ts` / `meeting-outcome.ts`.
 *
 * It answers the four questions the page is built around:
 *   1. What meeting matters RIGHT NOW?            → {@link selectPrimaryMeeting}
 *   2. What is the ONE next action for a meeting? → {@link meetingNextAction}
 *   3. Is a finished meeting actually wrapped up? → {@link computeWrapUpState}
 *   4. Which past meetings still need wrap-up?    → {@link needsWrapUp}
 *
 * It deliberately consumes the light, serializable shapes the Meetings page
 * already ships (a subset of `MeetingCardDTO`) so the React tree can call these
 * directly without re-querying or touching a Date/Prisma type.
 */

// --- input shapes -----------------------------------------------------------

/**
 * The meeting fields the command-center selectors read. A structural subset of
 * `MeetingCardDTO` so a card can be passed straight in. Optional fields default
 * to the most conservative reading (absent = 0 / false / "not yet").
 */
export interface MeetingWorkflowInput {
  id: string;
  title?: string;
  startISO: string;
  effectiveStatus: EffectiveMeetingStatus;
  agendaCount: number;
  decisionCount: number;
  /** Tracked Action Items created from / linked to this meeting. */
  linkedActionCount: number;
  /** Loose follow-up commitments captured at the meeting (any status). */
  followUpCount?: number;
  openFollowUps?: number;
  overdueFollowUps: number;
  /** Follow-ups still missing an owner (the work that would slip). */
  followUpsNeedingOwner?: number;
  /** Follow-ups still missing a due date. */
  followUpsNeedingDueDate?: number;
  hasNotes?: boolean;
  /** True when the meeting is tied to a concrete YPP record (class, partner …). */
  hasRelatedEntity?: boolean;
}

// --- next-action helper (spec §10) ------------------------------------------

export type MeetingNextActionKey =
  | "open" // a live meeting → jump in
  | "add_agenda" // upcoming, nothing planned yet
  | "prepare" // upcoming, has context worth reviewing first
  | "add_notes" // finished, nothing written down
  | "add_decisions" // finished + notes, but no decisions logged
  | "create_actions" // finished + decisions, but nothing tracked
  | "assign_owners" // work exists but someone needs to own it
  | "set_due_dates" // work exists but has no date
  | "review_actions" // something is overdue
  | "view"; // everything is current → just look

export interface MeetingNextAction {
  key: MeetingNextActionKey;
  /** Plain-English button label, e.g. "Add notes". */
  label: string;
  /**
   * The exact reason this is the next move, in plain English with real numbers
   * ("No notes written yet.", "2 actions need an owner."). Shown beside the
   * action so meetings match People / Actions / Classes, where every primary
   * action explains itself.
   */
  reason: string;
  /** Where the primary button points (the meeting workspace, optionally focused). */
  href: string;
  /** The workspace section to scroll to, when the action targets one. */
  focus: "agenda" | "notes" | "decisions" | "actions" | null;
}

const NEXT_ACTION_LABELS: Record<MeetingNextActionKey, string> = {
  open: "Open meeting",
  add_agenda: "Add agenda",
  prepare: "Prepare",
  add_notes: "Add notes",
  add_decisions: "Add decisions",
  create_actions: "Create actions",
  assign_owners: "Assign owners",
  set_due_dates: "Set due dates",
  review_actions: "Review actions",
  view: "View meeting",
};

const NEXT_ACTION_FOCUS: Record<MeetingNextActionKey, MeetingNextAction["focus"]> = {
  open: null,
  add_agenda: "agenda",
  prepare: null,
  add_notes: "notes",
  add_decisions: "decisions",
  create_actions: "actions",
  assign_owners: "actions",
  set_due_dates: "actions",
  review_actions: "actions",
  view: null,
};

function isPastStatus(status: EffectiveMeetingStatus): boolean {
  return status === "completed" || status === "needs_follow_up";
}

/**
 * The single best primary action for a meeting, in the spec's priority order.
 * Live meetings open; un-prepped upcoming meetings get an agenda; finished
 * meetings climb the wrap-up ladder (notes → decisions → actions → owners →
 * dates → overdue) before settling on "View meeting" when nothing is missing.
 */
export function meetingNextAction(m: MeetingWorkflowInput): MeetingNextAction {
  const { key, reason } = resolveMeetingNextAction(m);
  const focus = NEXT_ACTION_FOCUS[key];
  const href = focus ? `/actions/meetings/${m.id}#${focus}` : `/actions/meetings/${m.id}`;
  return { key, label: NEXT_ACTION_LABELS[key], reason, href, focus };
}

/**
 * The single best next action for a meeting AND the exact reason it is next,
 * resolved together so the label and its "why" can never drift. Same priority
 * ladder as the spec: live meetings open; un-prepped upcoming meetings get an
 * agenda; finished meetings climb the wrap-up ladder (notes → decisions →
 * actions → owners → dates → overdue) before settling on "View meeting".
 */
function resolveMeetingNextAction(m: MeetingWorkflowInput): {
  key: MeetingNextActionKey;
  reason: string;
} {
  const followUpCount = m.followUpCount ?? 0;
  const needOwner = m.followUpsNeedingOwner ?? 0;
  const needDue = m.followUpsNeedingDueDate ?? 0;
  const openFollowUps = m.openFollowUps ?? 0;
  const actionsCreated = m.linkedActionCount + followUpCount;

  // 1. Live meeting — get into the room.
  if (m.effectiveStatus === "in_progress") {
    return { key: "open", reason: "It's happening now." };
  }

  // 2–3. Upcoming / today (not started yet) — set it up, then prep.
  if (m.effectiveStatus === "upcoming" || m.effectiveStatus === "today") {
    if (m.agendaCount === 0) return { key: "add_agenda", reason: "No agenda set yet." };
    if (m.hasRelatedEntity || openFollowUps > 0) {
      return {
        key: "prepare",
        reason:
          openFollowUps > 0
            ? `${plural(openFollowUps, "open follow-up")} to review first.`
            : "Connected context to review first.",
      };
    }
    return { key: "view", reason: "Agenda's set — you're prepped." };
  }

  // Canceled — nothing to wrap up.
  if (m.effectiveStatus === "canceled") {
    return { key: "view", reason: "This meeting was canceled." };
  }

  // 4–9. Finished meeting — walk the wrap-up ladder.
  if (isPastStatus(m.effectiveStatus)) {
    if (!m.hasNotes) return { key: "add_notes", reason: "No notes written yet." };
    if (m.decisionCount === 0) {
      return { key: "add_decisions", reason: "No decisions recorded yet." };
    }
    if (actionsCreated === 0) {
      return { key: "create_actions", reason: "No follow-up actions created yet." };
    }
    if (needOwner > 0) {
      return {
        key: "assign_owners",
        reason: `${plural(needOwner, "action")} ${needOwner === 1 ? "needs" : "need"} an owner.`,
      };
    }
    if (needDue > 0) {
      return {
        key: "set_due_dates",
        reason: `${plural(needDue, "action")} ${needDue === 1 ? "needs" : "need"} a due date.`,
      };
    }
    if (m.overdueFollowUps > 0) {
      return {
        key: "review_actions",
        reason: `${plural(m.overdueFollowUps, "follow-up")} overdue.`,
      };
    }
    return { key: "view", reason: "Wrapped up — nothing outstanding." };
  }

  return { key: "view", reason: "Nothing needs attention." };
}

// --- wrap-up state (spec §5) ------------------------------------------------

export interface WrapUpItem {
  key: "notes" | "decisions" | "actions" | "owners" | "due_dates";
  /** Plain-English line, e.g. "Notes missing" or "2 decisions recorded". */
  label: string;
  /** True = this piece is handled; false = it is missing and named exactly. */
  ok: boolean;
}

export interface WrapUpState {
  items: WrapUpItem[];
  /** Every piece handled — safe to mark the meeting wrapped up. */
  readyToWrapUp: boolean;
  /**
   * One honest line. "Ready to wrap up" when nothing is missing; otherwise the
   * exact missing pieces, never hidden ("Notes missing · 1 action needs owner").
   */
  summaryLine: string;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The lightweight wrap-up checklist for a finished meeting. Says, in plain
 * English, whether notes / decisions / follow-up actions exist and whether every
 * action has an owner and a due date. Pure; the page renders the items verbatim
 * and the wrap-up button is enabled only when {@link WrapUpState.readyToWrapUp}.
 */
export function computeWrapUpState(m: MeetingWorkflowInput): WrapUpState {
  const followUpCount = m.followUpCount ?? 0;
  const needOwner = m.followUpsNeedingOwner ?? 0;
  const needDue = m.followUpsNeedingDueDate ?? 0;
  const actionsCreated = m.linkedActionCount + followUpCount;
  const hasNotes = !!m.hasNotes;

  const items: WrapUpItem[] = [
    {
      key: "notes",
      ok: hasNotes,
      label: hasNotes ? "Notes added" : "Notes missing",
    },
    {
      key: "decisions",
      ok: m.decisionCount > 0,
      label:
        m.decisionCount > 0
          ? `${plural(m.decisionCount, "decision")} recorded`
          : "No decisions recorded",
    },
    {
      key: "actions",
      ok: actionsCreated > 0,
      label:
        actionsCreated > 0
          ? `${plural(actionsCreated, "action")} created`
          : "No follow-up actions created",
    },
  ];

  // Owner / due-date checks only make sense once there is work to own.
  if (actionsCreated > 0) {
    items.push({
      key: "owners",
      ok: needOwner === 0,
      label:
        needOwner === 0
          ? "Every action has an owner"
          : `${plural(needOwner, "action")} ${needOwner === 1 ? "needs" : "need"} owner`,
    });
    items.push({
      key: "due_dates",
      ok: needDue === 0,
      label:
        needDue === 0
          ? "Every action has a due date"
          : `${plural(needDue, "action")} ${needDue === 1 ? "needs" : "need"} due date`,
    });
  }

  const missing = items.filter((i) => !i.ok);
  const readyToWrapUp = missing.length === 0;
  const summaryLine = readyToWrapUp
    ? "Ready to wrap up"
    : missing.map((i) => i.label).join(" · ");

  return { items, readyToWrapUp, summaryLine };
}

/**
 * Does a finished meeting still need wrap-up? True for any past meeting that is
 * not fully closed out (missing notes / decisions / actions, or actions lacking
 * an owner or due date). Upcoming, live, and canceled meetings never "need
 * wrap-up" — there is nothing to wrap up yet.
 */
export function needsWrapUp(m: MeetingWorkflowInput): boolean {
  if (!isPastStatus(m.effectiveStatus)) return false;
  return !computeWrapUpState(m).readyToWrapUp;
}

// --- primary-meeting selection (spec §1) ------------------------------------

export type PrimaryMeetingMode = "current" | "next" | "wrap_up";

export interface PrimaryMeetingSelection<T extends MeetingWorkflowInput> {
  meeting: T;
  mode: PrimaryMeetingMode;
}

/**
 * Pick the single meeting that matters right now, in priority order:
 *   1. A meeting happening live  → "current".
 *   2. Otherwise the soonest meeting still ahead of `now` → "next".
 *   3. Otherwise the most urgent finished meeting that still needs wrap-up →
 *      "wrap_up" (overdue first, then most recent).
 * Returns null when there are no meetings to surface at all.
 */
export function selectPrimaryMeeting<T extends MeetingWorkflowInput>(
  meetings: T[],
  now: Date = new Date()
): PrimaryMeetingSelection<T> | null {
  // 1. Current — a live meeting wins outright (earliest start if several).
  const live = meetings
    .filter((m) => m.effectiveStatus === "in_progress")
    .sort((a, b) => a.startISO.localeCompare(b.startISO));
  if (live.length > 0) return { meeting: live[0], mode: "current" };

  // 2. Next — the soonest meeting whose start is at or after now.
  const nowISO = now.toISOString();
  const upcoming = meetings
    .filter(
      (m) =>
        (m.effectiveStatus === "upcoming" || m.effectiveStatus === "today") &&
        m.startISO >= nowISO
    )
    .sort((a, b) => a.startISO.localeCompare(b.startISO));
  if (upcoming.length > 0) return { meeting: upcoming[0], mode: "next" };

  // 3. Wrap-up — the most urgent finished meeting still needing closure.
  const wrapUp = meetings
    .filter(needsWrapUp)
    .sort((a, b) => {
      // Overdue follow-ups are the loudest signal; then most-recent first.
      const ao = a.overdueFollowUps > 0 ? 0 : 1;
      const bo = b.overdueFollowUps > 0 ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return b.startISO.localeCompare(a.startISO);
    });
  if (wrapUp.length > 0) return { meeting: wrapUp[0], mode: "wrap_up" };

  return null;
}

/** Heading + tone for the primary card by mode. */
export const PRIMARY_MEETING_MODE_META: Record<
  PrimaryMeetingMode,
  { eyebrow: string; tone: "info" | "purple" | "warning" }
> = {
  current: { eyebrow: "Current meeting", tone: "info" },
  next: { eyebrow: "Next meeting", tone: "purple" },
  wrap_up: { eyebrow: "Needs wrap-up", tone: "warning" },
};
