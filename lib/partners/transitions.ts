/**
 * Deterministic partner stage-transition engine (Partner Automation).
 *
 * Centralizes every "when X happens, set stage/dates and write a timeline note"
 * rule so the CP-facing server actions stay thin and the rules stay testable.
 * Each `plan*` function is PURE: it takes the partner's current shape + `now`
 * and returns a `TransitionPlan` describing the field patch and the timeline
 * note to append. The server action applies the plan inside one transaction.
 *
 * No prisma, no `server-only` — safe to unit test directly.
 */

import { asPartnerStage, type PartnerNoteKind, type PartnerStage } from "@/lib/partners-constants";
import {
  addBusinessDays,
  nextOutreachFollowUp,
  nextMeetingFollowUp,
  FINAL_DECISION_FOLLOW_UP_BUSINESS_DAYS,
} from "@/lib/partners/follow-up";

/** The fields a transition may patch on the Partner row. */
export type PartnerTransitionPatch = {
  stage?: PartnerStage;
  lastContactedAt?: Date | null;
  nextFollowUpAt?: Date | null;
  meetingDate?: Date | null;
};

/** The timeline note a transition appends. */
export type PartnerTransitionNote = {
  kind: PartnerNoteKind;
  body: string;
  /** Structured detail persisted to PartnerNote.metadata (outcome, reason…). */
  metadata?: Record<string, unknown>;
};

export type TransitionPlan = {
  patch: PartnerTransitionPatch;
  note: PartnerTransitionNote;
  /** Human one-liner describing what changed (for toasts / logs). */
  summary: string;
};

type PartnerLike = {
  name: string;
  stage: string | null;
  contactName?: string | null;
};

function contactLabel(p: PartnerLike): string {
  return p.contactName?.trim() || "the contact";
}

// --- Outreach ---------------------------------------------------------------

/**
 * Mark an initial outreach email as sent: advance to REACHED_OUT, stamp
 * lastContactedAt = now, and auto-schedule the 5-business-day follow-up.
 */
export function planEmailSent(p: PartnerLike, now: Date): TransitionPlan {
  const nextFollowUpAt = nextOutreachFollowUp(now);
  // Only the first outreach advances the stage. Marking a later email "sent" on
  // an already-advanced partner must never demote it back to REACHED_OUT — it is
  // just another touch (re-stamp contact + re-arm the follow-up clock).
  const stage = asPartnerStage(p.stage);
  const isFirstOutreach = stage === "NOT_STARTED" || stage === "RESEARCHING";
  return {
    patch: isFirstOutreach
      ? { stage: "REACHED_OUT", lastContactedAt: now, nextFollowUpAt }
      : { lastContactedAt: now, nextFollowUpAt },
    note: {
      kind: "OUTREACH_SENT",
      body: `Outreach email sent to ${contactLabel(p)}. Follow-up set for ${fmt(nextFollowUpAt)} (5 business days).`,
      metadata: { followUpAt: nextFollowUpAt.toISOString() },
    },
    summary: "Email marked sent · follow-up in 5 business days",
  };
}

/** Mark a follow-up email as sent: re-stamp contact + re-arm the follow-up clock. */
export function planFollowUpSent(p: PartnerLike, now: Date): TransitionPlan {
  const nextFollowUpAt = nextOutreachFollowUp(now);
  return {
    patch: { lastContactedAt: now, nextFollowUpAt },
    note: {
      kind: "FOLLOW_UP_SENT",
      body: `Follow-up email sent to ${contactLabel(p)}. Next follow-up ${fmt(nextFollowUpAt)}.`,
      metadata: { followUpAt: nextFollowUpAt.toISOString() },
    },
    summary: "Follow-up sent · clock reset",
  };
}

/** A partner replied. Move to RESPONDED and clear the auto follow-up clock. */
export function planResponseLogged(p: PartnerLike, body: string | null, now: Date): TransitionPlan {
  return {
    patch: { stage: "RESPONDED", lastContactedAt: now, nextFollowUpAt: null },
    note: {
      kind: "RESPONSE_RECEIVED",
      body: body?.trim() || `${p.name} responded. Get a meeting on the calendar.`,
    },
    summary: "Response logged · ready to schedule a meeting",
  };
}

// --- Meetings ---------------------------------------------------------------

/**
 * Schedule a meeting: set meetingDate + MEETING_SCHEDULED. The follow-up clock
 * is pointed at the meeting date itself so it surfaces as "coming up".
 */
export function planMeetingScheduled(p: PartnerLike, meetingDate: Date, now: Date): TransitionPlan {
  return {
    patch: { stage: "MEETING_SCHEDULED", meetingDate, nextFollowUpAt: meetingDate },
    note: {
      kind: "MEETING_SCHEDULED",
      body: `Meeting scheduled with ${contactLabel(p)} for ${fmt(meetingDate)}.`,
      metadata: { meetingDate: meetingDate.toISOString() },
    },
    summary: `Meeting set for ${fmt(meetingDate)}`,
  };
}

export const MEETING_OUTCOMES = [
  "CONFIRMED_YES",
  "NEEDS_APPROVAL",
  "WANTS_PROPOSAL",
  "NEEDS_FOLLOW_UP",
  "NOT_A_FIT",
  "INTRO_TO_OTHER",
  "PAID_SPACE_ONLY",
  "OTHER",
] as const;
export type MeetingOutcome = (typeof MEETING_OUTCOMES)[number];

export const MEETING_OUTCOME_LABELS: Record<MeetingOutcome, string> = {
  CONFIRMED_YES: "Confirmed yes",
  NEEDS_APPROVAL: "Interested, needs internal approval",
  WANTS_PROPOSAL: "Wants a proposal",
  NEEDS_FOLLOW_UP: "Needs follow-up",
  NOT_A_FIT: "Not a fit",
  INTRO_TO_OTHER: "Introduced us to someone else",
  PAID_SPACE_ONLY: "Paid space only",
  OTHER: "Other",
};

type OutcomeRule = {
  stage: PartnerStage;
  /** Business days until the next follow-up; null = clear the clock. */
  followUpInDays: number | null;
};

const OUTCOME_RULES: Record<MeetingOutcome, OutcomeRule> = {
  // Confirmed — move to active partnership; logistics tracked separately.
  CONFIRMED_YES: { stage: "ACTIVE_PARTNERSHIP", followUpInDays: 1 },
  // Interested but blocked on their side — chase within a few business days.
  NEEDS_APPROVAL: { stage: "NEGOTIATING", followUpInDays: FINAL_DECISION_FOLLOW_UP_BUSINESS_DAYS },
  // They asked for details — proposal is the next artifact, fast turnaround.
  WANTS_PROPOSAL: { stage: "NEEDS_PROPOSAL", followUpInDays: 1 },
  // Warm but needs another touch — within ~24h per the guide.
  NEEDS_FOLLOW_UP: { stage: "RESPONDED", followUpInDays: 1 },
  NOT_A_FIT: { stage: "NOT_A_FIT", followUpInDays: null },
  INTRO_TO_OTHER: { stage: "RESPONDED", followUpInDays: 2 },
  PAID_SPACE_ONLY: { stage: "NEGOTIATING", followUpInDays: FINAL_DECISION_FOLLOW_UP_BUSINESS_DAYS },
  OTHER: { stage: "RESPONDED", followUpInDays: 2 },
};

/**
 * Log a meeting outcome: update stage, set the follow-up date per the guide's
 * 24h rule, and append a structured MEETING_OUTCOME note. The CP must log every
 * meeting immediately — this is the forced structured flow.
 */
export function planMeetingOutcome(
  p: PartnerLike,
  outcome: MeetingOutcome,
  body: string | null,
  now: Date
): TransitionPlan {
  const rule = OUTCOME_RULES[outcome];
  const nextFollowUpAt = rule.followUpInDays == null ? null : addBusinessDays(now, rule.followUpInDays);
  const label = MEETING_OUTCOME_LABELS[outcome];
  return {
    patch: { stage: rule.stage, lastContactedAt: now, nextFollowUpAt },
    note: {
      kind: "MEETING_OUTCOME",
      body: body?.trim() ? `${label} — ${body.trim()}` : `Meeting outcome: ${label}.`,
      metadata: {
        outcome,
        ...(nextFollowUpAt ? { followUpAt: nextFollowUpAt.toISOString() } : {}),
      },
    },
    summary: nextFollowUpAt ? `Outcome logged · follow up by ${fmt(nextFollowUpAt)}` : `Outcome logged · ${label}`,
  };
}

// --- Proposal / confirm / close ---------------------------------------------

export function planProposalSent(p: PartnerLike, now: Date): TransitionPlan {
  const nextFollowUpAt = nextOutreachFollowUp(now);
  return {
    patch: { stage: "PROPOSAL_SENT", lastContactedAt: now, nextFollowUpAt },
    note: {
      kind: "PROPOSAL_SENT",
      body: `Proposal sent to ${contactLabel(p)}. Follow up ${fmt(nextFollowUpAt)} so it doesn't stall.`,
      metadata: { followUpAt: nextFollowUpAt.toISOString() },
    },
    summary: "Proposal sent · follow-up scheduled",
  };
}

/** Confirm a partner. Logistics readiness is tracked separately and surfaced. */
export function planConfirmed(p: PartnerLike, now: Date): TransitionPlan {
  return {
    patch: { stage: "ACTIVE_PARTNERSHIP", nextFollowUpAt: nextMeetingFollowUp(now) },
    note: {
      kind: "MEETING_OUTCOME",
      body: `${p.name} confirmed as a partner. Confirm logistics next.`,
      metadata: { confirmed: true },
    },
    summary: `${p.name} confirmed`,
  };
}

export const CLOSE_REASONS = ["NOT_A_FIT", "NO_RESPONSE", "DECLINED", "PAUSED", "OTHER"] as const;
export type CloseReason = (typeof CLOSE_REASONS)[number];

export const CLOSE_REASON_LABELS: Record<CloseReason, string> = {
  NOT_A_FIT: "Not a fit",
  NO_RESPONSE: "No response after follow-ups",
  DECLINED: "Declined",
  PAUSED: "Paused for now",
  OTHER: "Other",
};

/** Close a partner with a reason. PAUSED is revisitable; the rest are not-a-fit. */
export function planClosed(p: PartnerLike, reason: CloseReason, body: string | null, now: Date): TransitionPlan {
  const stage: PartnerStage = reason === "PAUSED" ? "PAUSED" : "NOT_A_FIT";
  const label = CLOSE_REASON_LABELS[reason];
  return {
    patch: { stage, nextFollowUpAt: null },
    note: {
      kind: "CLOSED",
      body: body?.trim() ? `Closed (${label}) — ${body.trim()}` : `Closed: ${label}.`,
      metadata: { reason },
    },
    summary: `Closed · ${label}`,
  };
}

/** A plain stage move (board drag / dropdown) with a STAGE_CHANGE note. */
export function planStageChange(p: PartnerLike, to: PartnerStage, now: Date): TransitionPlan {
  const from = asPartnerStage(p.stage);
  return {
    patch: { stage: to },
    note: {
      kind: "STAGE_CHANGE",
      body: `Stage moved from "${from}" to "${to}".`,
      metadata: { from, to },
    },
    summary: `Moved to ${to}`,
  };
}

function fmt(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
