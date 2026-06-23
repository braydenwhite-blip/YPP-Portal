import { startOfDay } from "@/lib/leadership-action-center/dates";

import type { EffectiveMeetingStatus } from "./meetings-status";
import type { MeetingCardDTO, MeetingDetailDTO } from "./meetings-queries";

/**
 * People Strategy Execution OS — Meeting OUTCOME quality.
 *
 * A meeting existing is not the same as a meeting being useful. This pure,
 * deterministic derivation classifies whether a meeting actually produced
 * operational output — decisions, tracked actions, resolved follow-ups — or
 * whether it came and went without moving anything. Never AI-generated: the same
 * inputs always yield the same level + words, so the badge is trustworthy.
 *
 * Levels (worst-rank first for sorting):
 *   - stale               — a past meeting gone cold: old, with open follow-ups
 *                           or no execution to show for it.
 *   - needs_follow_through — produced decisions / open follow-ups that haven't
 *                           become resolved action yet.
 *   - empty               — produced nothing (no decisions / actions / follow-ups
 *                           / notes), or an upcoming meeting with no agenda.
 *   - adequate            — some real output, nothing left hanging.
 *   - strong              — decisions converted to action, attendees + a record,
 *                           and everything followed through.
 */

export type MeetingOutcomeLevel =
  | "strong"
  | "adequate"
  | "needs_follow_through"
  | "empty"
  | "stale";

export type MeetingOutcomeTone = "success" | "info" | "warning" | "neutral" | "overdue";

export type MeetingOutcomeMeta = {
  label: string;
  tone: MeetingOutcomeTone;
  /** Higher = more concerning, for worst-first sorting. */
  rank: number;
};

export const MEETING_OUTCOME_META: Record<MeetingOutcomeLevel, MeetingOutcomeMeta> = {
  stale: { label: "Stale", tone: "overdue", rank: 4 },
  needs_follow_through: { label: "Needs follow-through", tone: "warning", rank: 3 },
  empty: { label: "No outcome yet", tone: "neutral", rank: 2 },
  adequate: { label: "Adequate", tone: "info", rank: 1 },
  strong: { label: "Strong outcome", tone: "success", rank: 0 },
};

export type MeetingOutcomeQuality = {
  level: MeetingOutcomeLevel;
  headline: string;
  reasons: string[];
  suggestedNextSteps: string[];
};

/** Days after which an unresolved past meeting reads as "stale". */
export const STALE_MEETING_DAYS = 21;

export type MeetingOutcomeInput = {
  effectiveStatus: EffectiveMeetingStatus;
  start: Date;
  decisionCount?: number;
  /** Actions created from / linked to this meeting. */
  linkedActionCount?: number;
  /** Total follow-ups (defaults to openFollowUps when only that is known). */
  followUpCount?: number;
  openFollowUps?: number;
  attendeeCount?: number;
  agendaCount?: number;
  hasNotes?: boolean;
  hasRelatedEntity?: boolean;
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function meta(level: MeetingOutcomeLevel): MeetingOutcomeMeta {
  return MEETING_OUTCOME_META[level];
}

/**
 * Classify a meeting's operational outcome. Pure — `now` is injected. Handles
 * upcoming / in-progress meetings (output not produced yet → preparedness read),
 * canceled meetings, and the full past-meeting follow-through ladder.
 */
export function deriveMeetingOutcomeQuality(
  input: MeetingOutcomeInput,
  now: Date = new Date()
): MeetingOutcomeQuality {
  const decisions = Math.max(0, input.decisionCount ?? 0);
  const actions = Math.max(0, input.linkedActionCount ?? 0);
  const open = Math.max(0, input.openFollowUps ?? 0);
  const followUps = Math.max(open, Math.max(0, input.followUpCount ?? 0));
  const attendees = Math.max(0, input.attendeeCount ?? 0);
  const agenda = Math.max(0, input.agendaCount ?? 0);
  const hasNotes = !!input.hasNotes;

  const status = input.effectiveStatus;

  // Canceled — there is no outcome to grade.
  if (status === "canceled") {
    return {
      level: "empty",
      headline: "Canceled — no outcome.",
      reasons: ["The meeting was canceled."],
      suggestedNextSteps: ["Reschedule if the work still needs a conversation."],
    };
  }

  const isUpcoming =
    status === "upcoming" || status === "today" || status === "in_progress";

  if (isUpcoming) {
    if (agenda > 0 || attendees > 0) {
      return {
        level: "adequate",
        headline: "Scheduled and prepared.",
        reasons: [
          agenda > 0 ? `${plural(agenda, "agenda item")}` : `${plural(attendees, "attendee")}`,
        ],
        suggestedNextSteps: ["Capture decisions and assign follow-ups during the meeting."],
      };
    }
    return {
      level: "empty",
      headline: "Scheduled, but not set up yet.",
      reasons: ["No agenda or attendees yet."],
      suggestedNextSteps: ["Add an agenda and invite attendees before it starts."],
    };
  }

  // Past meeting (completed / needs_follow_up / past-scheduled).
  const ageDays = Math.max(
    0,
    Math.round((startOfDay(now).getTime() - startOfDay(input.start).getTime()) / 86_400_000)
  );
  const isOld = ageDays > STALE_MEETING_DAYS;
  const producedNothing = decisions === 0 && actions === 0 && followUps === 0 && !hasNotes;

  if (producedNothing) {
    return {
      level: isOld ? "stale" : "empty",
      headline: isOld
        ? `Stale — ${ageDays} days on with nothing logged.`
        : "Happened, but produced no output.",
      reasons: ["No decisions, actions, follow-ups, or notes were logged."],
      suggestedNextSteps: [
        "Log what was decided, or convert the discussion into a tracked action.",
      ],
    };
  }

  if (open > 0) {
    const reasons = [`${plural(open, "open follow-up")}`];
    return {
      level: isOld ? "stale" : "needs_follow_through",
      headline: isOld
        ? `Stale — open follow-ups ${ageDays} days later.`
        : "Needs follow-through on open items.",
      reasons,
      suggestedNextSteps: ["Close out or convert the open follow-ups into tracked actions."],
    };
  }

  if (decisions > 0 && actions === 0) {
    return {
      level: "needs_follow_through",
      headline: "Decisions made, but no action assigned.",
      reasons: [`${plural(decisions, "decision")} with no linked action`],
      suggestedNextSteps: ["Convert the decisions into tracked actions so they get done."],
    };
  }

  // Has output, nothing left hanging. Strong when it was a real working meeting
  // that converted into execution; adequate otherwise.
  const signals = (actions > 0 ? 1 : 0) + (decisions > 0 ? 1 : 0) + (hasNotes ? 1 : 0) + (attendees > 0 ? 1 : 0);
  if (actions > 0 && signals >= 3) {
    const reasons: string[] = [];
    if (decisions > 0) reasons.push(`${plural(decisions, "decision")}`);
    reasons.push(`${plural(actions, "linked action")}`);
    if (attendees > 0) reasons.push(`${plural(attendees, "attendee")}`);
    return {
      level: "strong",
      headline: "Strong — decisions turned into tracked action.",
      reasons,
      suggestedNextSteps: ["Keep the rhythm — this is what a productive meeting looks like."],
    };
  }

  const reasons: string[] = [];
  if (decisions > 0) reasons.push(`${plural(decisions, "decision")}`);
  if (actions > 0) reasons.push(`${plural(actions, "linked action")}`);
  if (hasNotes && reasons.length === 0) reasons.push("notes captured");
  return {
    level: "adequate",
    headline: "Adequate — some output, nothing left hanging.",
    reasons: reasons.length ? reasons : ["Output logged."],
    suggestedNextSteps: ["Convert key discussion points into tracked actions to make it strong."],
  };
}

export function meetingOutcomeMeta(level: MeetingOutcomeLevel): MeetingOutcomeMeta {
  return meta(level);
}

// --- builders from the shipped DTOs -----------------------------------------

/** Build the outcome from a card DTO (lists / digest). Notes are unknown here. */
export function meetingOutcomeFromCard(
  card: MeetingCardDTO,
  now: Date = new Date()
): MeetingOutcomeQuality {
  return deriveMeetingOutcomeQuality(
    {
      effectiveStatus: card.effectiveStatus,
      start: new Date(card.startISO),
      decisionCount: card.decisionCount,
      linkedActionCount: card.linkedActionCount,
      openFollowUps: card.openFollowUps,
      attendeeCount: card.attendeeCount,
      agendaCount: card.agendaCount,
      hasRelatedEntity: !!card.relatedEntityType && !!card.relatedEntityId,
    },
    now
  );
}

/** Build the outcome from a detail DTO — the richest read (notes + totals). */
export function meetingOutcomeFromDetail(
  detail: MeetingDetailDTO,
  now: Date = new Date()
): MeetingOutcomeQuality {
  return deriveMeetingOutcomeQuality(
    {
      effectiveStatus: detail.effectiveStatus,
      start: new Date(detail.startISO),
      decisionCount: detail.decisions.length,
      linkedActionCount: detail.linkedActions.length,
      followUpCount: detail.followUps.length,
      openFollowUps: detail.openFollowUps,
      attendeeCount: detail.attendees.length,
      agendaCount: detail.agenda.length,
      hasNotes: !!detail.notesText && detail.notesText.trim().length > 0,
      hasRelatedEntity: !!detail.relatedEntityType && !!detail.relatedEntityId,
    },
    now
  );
}
