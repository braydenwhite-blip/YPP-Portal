import type { ActionItemStatus } from "@prisma/client";

import { startOfDay } from "@/lib/leadership-action-center/dates";

import type { ProvisionalStatus } from "./provisional";

/**
 * People Strategy — unified "Needs Attention" engine (pure, no DB / no session).
 *
 * One deterministic place that turns the live People Strategy facts (actions,
 * people, mentors, meetings, classes, escalations) into a single, explainable,
 * severity-ranked list of attention items. Pages compose the inputs from their
 * existing loaders and call `computeNeedsAttention` so every surface — My Actions,
 * All Actions, the CPO / Board / SUPER_ADMIN dashboard, Person 360, the meetings
 * tracker, and class integration — agrees on exactly what is "stuck", why, and
 * how urgent it is, instead of each inventing its own urgency definition.
 *
 * Every signal carries a plain-language `reason` and a `confidential` flag so a
 * normal member's view can be filtered down to non-confidential work without a
 * second code path (`filterAttentionForViewer`).
 */

const DAY_MS = 86_400_000;

// --- Thresholds (deterministic; exported so callers/tests can reuse them). ---

/** An open action is "due soon" within this many days of its deadline. */
export const DUE_SOON_DAYS = 3;
/** An open action with no update in this many days is "stale". */
export const STALE_ACTION_DAYS = 14;
/** Mentor kickoff must happen within this many days of the pairing start. */
export const KICKOFF_WINDOW_DAYS = 14;
/** A monthly check-in older than this many days is overdue. */
export const CHECK_IN_OVERDUE_DAYS = 35;
/** The provisional Month-3 decision is "coming up" within this many days. */
export const PROVISIONAL_DECISION_LEAD_DAYS = 14;
/** Carrying at least this many active actions is a "high workload" signal. */
export const HIGH_WORKLOAD_ACTIONS = 5;
/** A mentor with more than this many active mentees is overloaded. */
export const MENTOR_MAX_LOAD = 5;
/** A held meeting still has no notes after this many days. */
export const MEETING_NOTES_GRACE_DAYS = 1;

export type AttentionCategory =
  | "ACTION_OVERDUE"
  | "ACTION_DUE_SOON"
  | "ACTION_BLOCKED"
  | "ACTION_STALE"
  | "ACTION_MISSING_OWNER"
  | "ACTION_MISSING_DUE_DATE"
  | "MEETING_MISSING_AGENDA"
  | "MEETING_MISSING_NOTES"
  | "MEETING_DEFERRED_ITEM"
  | "FEEDBACK_OVERDUE"
  | "CHECK_IN_OVERDUE"
  | "QUARTERLY_REVIEW_DUE"
  | "PROVISIONAL_DECISION_DUE"
  | "PROVISIONAL_DECISION_OVERDUE"
  | "MISSING_MENTOR"
  | "MENTOR_KICKOFF_OVERDUE"
  | "PENDING_MENTOR_RECOMMENDATION"
  | "MENTOR_OVERLOAD"
  | "HIGH_WORKLOAD"
  | "CLASS_MISSING_INSTRUCTOR"
  | "CLASS_BLOCKER"
  | "ESCALATION_AWAITING_REVIEW";

export type AttentionSeverity = "critical" | "high" | "medium" | "low";

export type AttentionSubjectKind = "action" | "person" | "meeting" | "class";

/** One explainable "needs attention" signal. */
export interface AttentionItem {
  category: AttentionCategory;
  severity: AttentionSeverity;
  /** Plain-language explanation, e.g. "Overdue by 3 days". */
  reason: string;
  subjectKind: AttentionSubjectKind;
  subjectId: string;
  subjectLabel: string;
  /**
   * Signed days relative to `now` where meaningful: negative = past / overdue,
   * positive = upcoming, null when not time-based. Used for within-severity
   * sorting (most overdue first).
   */
  daysDelta: number | null;
  /**
   * True when the signal exposes People Strategy / officer-only data and must be
   * hidden from a normal member's view (see `filterAttentionForViewer`).
   */
  confidential: boolean;
}

/** Whole signed days from `now` to `target` (day-aligned, like the overdue sweep). */
function deltaDays(now: Date, target: Date): number {
  return Math.round(
    (startOfDay(target).getTime() - startOfDay(now).getTime()) / DAY_MS
  );
}

/** Whole days elapsed since `date` (never negative). */
function daysSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

function pluralDays(n: number): string {
  const abs = Math.abs(n);
  return `${abs} day${abs === 1 ? "" : "s"}`;
}

// --------------------------------- Actions ---------------------------------

export interface AttentionAction {
  id: string;
  title: string;
  status: ActionItemStatus;
  deadlineStart: Date;
  deadlineEnd: Date | null;
  flaggedAt: Date | null;
  resolvedAt: Date | null;
  updatedAt: Date;
  /** True when the action has an accountable lead (leadId or a LEAD assignment). */
  hasOwner: boolean;
  /** True when visibility is OFFICERS_ONLY (so the signal is confidential). */
  officersOnly?: boolean;
}

function actionDeadline(a: AttentionAction): Date {
  return a.deadlineEnd ?? a.deadlineStart;
}

/**
 * Attention signals for action items. Each open action contributes at most one
 * urgency signal (overdue → blocked → due-soon → stale) plus a structural
 * missing-owner signal. Settled (COMPLETE / DROPPED) or resolved items are skipped.
 */
export function actionAttention(
  actions: AttentionAction[],
  now: Date = new Date()
): AttentionItem[] {
  const out: AttentionItem[] = [];

  for (const a of actions) {
    if (a.status === "COMPLETE" || a.status === "DROPPED" || a.resolvedAt) continue;
    const confidential = a.officersOnly === true;
    const base = {
      subjectKind: "action" as const,
      subjectId: a.id,
      subjectLabel: a.title,
      confidential,
    };

    const delta = deltaDays(now, actionDeadline(a));
    const overdue = a.status === "OVERDUE" || delta < 0;
    const blocked = a.status === "BLOCKED" || a.flaggedAt != null;

    if (overdue) {
      out.push({
        ...base,
        category: "ACTION_OVERDUE",
        severity: "critical",
        reason: delta < 0 ? `Overdue by ${pluralDays(delta)}` : "Marked overdue",
        daysDelta: delta,
      });
    } else if (blocked) {
      out.push({
        ...base,
        category: "ACTION_BLOCKED",
        severity: "high",
        reason: a.flaggedAt ? "Flagged as blocked" : "Blocked — work can't proceed",
        daysDelta: delta,
      });
    } else if (delta <= DUE_SOON_DAYS) {
      out.push({
        ...base,
        category: "ACTION_DUE_SOON",
        severity: "medium",
        reason: delta <= 0 ? "Due today" : `Due in ${pluralDays(delta)}`,
        daysDelta: delta,
      });
    } else if (daysSince(a.updatedAt, now) >= STALE_ACTION_DAYS) {
      out.push({
        ...base,
        category: "ACTION_STALE",
        severity: "low",
        reason: `No update in ${pluralDays(daysSince(a.updatedAt, now))}`,
        daysDelta: -daysSince(a.updatedAt, now),
      });
    }

    if (!a.hasOwner) {
      out.push({
        ...base,
        category: "ACTION_MISSING_OWNER",
        severity: "high",
        reason: "No accountable lead assigned",
        daysDelta: null,
      });
    }
  }

  return out;
}

// --------------------------------- People ----------------------------------

export interface AttentionPerson {
  id: string;
  name: string;
  /** True when this person's role is expected to have a mentor. */
  expectsMentor: boolean;
  hasMentor: boolean;
  /** Active mentorship start date (drives kickoff overdue), or null. */
  mentorshipStartDate: Date | null;
  kickoffCompleted: boolean;
  /** When the last monthly check-in was recorded; null = none on record. */
  lastCheckInAt: Date | null;
  /** When the current cycle's quarterly review is due, or null. */
  quarterlyReviewDueAt: Date | null;
  hasCurrentQuarterReview: boolean;
  /** Provisional clock status (from `computeProvisionalStatus`), or null. */
  provisional: ProvisionalStatus | null;
  activeActionCount: number;
  /** Mentor recommendations awaiting CPO review. */
  pendingMentorRecommendations: number;
}

/**
 * Attention signals for a person on the People Dashboard / Person 360. These are
 * People Strategy facts (mentor coverage, kickoff, check-ins, reviews,
 * provisional confirmation, workload) and are all marked confidential.
 */
export function peopleAttention(
  people: AttentionPerson[],
  now: Date = new Date()
): AttentionItem[] {
  const out: AttentionItem[] = [];

  for (const p of people) {
    const base = {
      subjectKind: "person" as const,
      subjectId: p.id,
      subjectLabel: p.name,
      confidential: true,
    };

    if (p.expectsMentor && !p.hasMentor) {
      out.push({
        ...base,
        category: "MISSING_MENTOR",
        severity: "high",
        reason: "Active member has no mentor assigned",
        daysDelta: null,
      });
    }

    if (p.hasMentor && !p.kickoffCompleted && p.mentorshipStartDate) {
      const since = daysSince(p.mentorshipStartDate, now);
      if (since > KICKOFF_WINDOW_DAYS) {
        out.push({
          ...base,
          category: "MENTOR_KICKOFF_OVERDUE",
          severity: "high",
          reason: `Mentor kickoff not completed (${pluralDays(since)} since start)`,
          daysDelta: KICKOFF_WINDOW_DAYS - since,
        });
      }
    }

    if (p.lastCheckInAt == null && p.hasMentor) {
      out.push({
        ...base,
        category: "CHECK_IN_OVERDUE",
        severity: "medium",
        reason: "No monthly check-in on record",
        daysDelta: null,
      });
    } else if (p.lastCheckInAt && daysSince(p.lastCheckInAt, now) > CHECK_IN_OVERDUE_DAYS) {
      const since = daysSince(p.lastCheckInAt, now);
      out.push({
        ...base,
        category: "CHECK_IN_OVERDUE",
        severity: "medium",
        reason: `No check-in in ${pluralDays(since)}`,
        daysDelta: -since,
      });
    }

    if (p.quarterlyReviewDueAt && !p.hasCurrentQuarterReview) {
      const delta = deltaDays(now, p.quarterlyReviewDueAt);
      if (delta <= 0) {
        out.push({
          ...base,
          category: "QUARTERLY_REVIEW_DUE",
          severity: "medium",
          reason: delta === 0 ? "Quarterly review due today" : `Quarterly review ${pluralDays(delta)} overdue`,
          daysDelta: delta,
        });
      }
    }

    if (p.provisional?.isProvisional) {
      if (p.provisional.atMonthThree) {
        out.push({
          ...base,
          category: "PROVISIONAL_DECISION_OVERDUE",
          severity: "critical",
          reason: "Provisional period ended — confirmation decision overdue",
          daysDelta: p.provisional.daysRemaining,
        });
      } else if (
        p.provisional.daysRemaining != null &&
        p.provisional.daysRemaining <= PROVISIONAL_DECISION_LEAD_DAYS
      ) {
        out.push({
          ...base,
          category: "PROVISIONAL_DECISION_DUE",
          severity: "high",
          reason: `Month-3 confirmation decision due in ${pluralDays(p.provisional.daysRemaining)}`,
          daysDelta: p.provisional.daysRemaining,
        });
      }
    }

    if (p.pendingMentorRecommendations > 0) {
      out.push({
        ...base,
        category: "PENDING_MENTOR_RECOMMENDATION",
        severity: "medium",
        reason: `${p.pendingMentorRecommendations} mentor recommendation${
          p.pendingMentorRecommendations === 1 ? "" : "s"
        } awaiting review`,
        daysDelta: null,
      });
    }

    if (p.activeActionCount >= HIGH_WORKLOAD_ACTIONS) {
      out.push({
        ...base,
        category: "HIGH_WORKLOAD",
        severity: "low",
        reason: `Carrying ${p.activeActionCount} active actions`,
        daysDelta: null,
      });
    }
  }

  return out;
}

// --------------------------------- Mentors ---------------------------------

export interface AttentionMentor {
  id: string;
  name: string;
  activeMenteeCount: number;
}

/** Mentors carrying more than `MENTOR_MAX_LOAD` active mentees. */
export function mentorAttention(mentors: AttentionMentor[]): AttentionItem[] {
  return mentors
    .filter((m) => m.activeMenteeCount > MENTOR_MAX_LOAD)
    .map((m) => ({
      category: "MENTOR_OVERLOAD" as const,
      severity: "medium" as const,
      reason: `Mentor has ${m.activeMenteeCount} active mentees (over capacity)`,
      subjectKind: "person" as const,
      subjectId: m.id,
      subjectLabel: m.name,
      daysDelta: null,
      confidential: true,
    }));
}

// -------------------------------- Meetings ---------------------------------

export interface AttentionMeeting {
  id: string;
  title: string;
  date: Date;
  status: string;
  hasAgenda: boolean;
  hasNotes: boolean;
  deferredItemCount: number;
  officersOnly?: boolean;
}

/** Agenda gaps on upcoming meetings, notes gaps on held meetings, carry-forwards. */
export function meetingAttention(
  meetings: AttentionMeeting[],
  now: Date = new Date()
): AttentionItem[] {
  const out: AttentionItem[] = [];

  for (const m of meetings) {
    if (m.status === "CANCELLED") continue;
    const base = {
      subjectKind: "meeting" as const,
      subjectId: m.id,
      subjectLabel: m.title,
      confidential: m.officersOnly === true,
    };
    const upcoming = m.date.getTime() >= now.getTime();

    if (upcoming && m.status === "SCHEDULED" && !m.hasAgenda) {
      out.push({
        ...base,
        category: "MEETING_MISSING_AGENDA",
        severity: "medium",
        reason: "Upcoming meeting has no agenda",
        daysDelta: deltaDays(now, m.date),
      });
    }

    if (!upcoming && !m.hasNotes && daysSince(m.date, now) >= MEETING_NOTES_GRACE_DAYS) {
      out.push({
        ...base,
        category: "MEETING_MISSING_NOTES",
        severity: "medium",
        reason: "Meeting held without notes",
        daysDelta: -daysSince(m.date, now),
      });
    }

    if (m.deferredItemCount > 0) {
      out.push({
        ...base,
        category: "MEETING_DEFERRED_ITEM",
        severity: "low",
        reason: `${m.deferredItemCount} item${
          m.deferredItemCount === 1 ? "" : "s"
        } deferred to next meeting`,
        daysDelta: null,
      });
    }
  }

  return out;
}

// --------------------------------- Classes ---------------------------------

export interface AttentionClass {
  id: string;
  name: string;
  hasLeadInstructor: boolean;
  hasExecutingInstructor: boolean;
  hasBlocker: boolean;
  blockerReason?: string | null;
}

/** Classes missing a lead/executing instructor, or carrying a blocker. */
export function classAttention(classes: AttentionClass[]): AttentionItem[] {
  const out: AttentionItem[] = [];

  for (const c of classes) {
    const base = {
      subjectKind: "class" as const,
      subjectId: c.id,
      subjectLabel: c.name,
      confidential: false,
    };

    if (!c.hasLeadInstructor) {
      out.push({
        ...base,
        category: "CLASS_MISSING_INSTRUCTOR",
        severity: "high",
        reason: "Class has no lead instructor",
        daysDelta: null,
      });
    } else if (!c.hasExecutingInstructor) {
      out.push({
        ...base,
        category: "CLASS_MISSING_INSTRUCTOR",
        severity: "medium",
        reason: "Class has no executing instructor",
        daysDelta: null,
      });
    }

    if (c.hasBlocker) {
      out.push({
        ...base,
        category: "CLASS_BLOCKER",
        severity: "high",
        reason: c.blockerReason?.trim() || "Class has an unresolved blocker",
        daysDelta: null,
      });
    }
  }

  return out;
}

// ------------------------------- Escalations -------------------------------

export interface AttentionEscalation {
  id: string;
  title: string;
  /** Human age of the escalation, e.g. "3 days". */
  ageLabel: string;
  /** True when this has rolled up to the Board (vs. awaiting leadership). */
  awaitingBoard: boolean;
}

/** Action-tracker escalations awaiting CPO / Board review (always confidential). */
export function escalationAttention(escalations: AttentionEscalation[]): AttentionItem[] {
  return escalations.map((e) => ({
    category: "ESCALATION_AWAITING_REVIEW" as const,
    severity: "critical" as const,
    reason: `Escalated ${e.ageLabel} ago — awaiting ${
      e.awaitingBoard ? "Board" : "leadership"
    } review`,
    subjectKind: "action" as const,
    subjectId: e.id,
    subjectLabel: e.title,
    daysDelta: null,
    confidential: true,
  }));
}

// ------------------------------ Composition --------------------------------

export interface NeedsAttentionInput {
  actions?: AttentionAction[];
  people?: AttentionPerson[];
  mentors?: AttentionMentor[];
  meetings?: AttentionMeeting[];
  classes?: AttentionClass[];
  escalations?: AttentionEscalation[];
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** Stable sort: most severe first, then most overdue / soonest within a tier. */
export function sortAttention(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const sev = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (sev !== 0) return sev;
    return (a.daysDelta ?? 0) - (b.daysDelta ?? 0);
  });
}

/**
 * The unified engine. Pass whichever domains a surface has loaded; the result is
 * one severity-ranked, explainable list. `now` is injected so it is fully
 * deterministic and unit-testable.
 */
export function computeNeedsAttention(
  input: NeedsAttentionInput,
  now: Date = new Date()
): AttentionItem[] {
  return sortAttention([
    ...actionAttention(input.actions ?? [], now),
    ...peopleAttention(input.people ?? [], now),
    ...mentorAttention(input.mentors ?? []),
    ...meetingAttention(input.meetings ?? [], now),
    ...classAttention(input.classes ?? []),
    ...escalationAttention(input.escalations ?? []),
  ]);
}

/**
 * Descriptive alias used by the People Strategy dashboards. Same pure engine —
 * surfaces import whichever name reads best for the call site.
 */
export const getPeopleStrategyAttentionItems = computeNeedsAttention;

/**
 * Drop confidential signals for a viewer who may not see People Strategy /
 * officer-only data (a normal member). Leadership / CPO / SUPER_ADMIN pass
 * `canSeeConfidential: true` and get everything.
 */
export function filterAttentionForViewer(
  items: AttentionItem[],
  opts: { canSeeConfidential: boolean }
): AttentionItem[] {
  if (opts.canSeeConfidential) return items;
  return items.filter((item) => !item.confidential);
}

export interface AttentionSummary {
  total: number;
  bySeverity: Record<AttentionSeverity, number>;
  byCategory: Partial<Record<AttentionCategory, number>>;
}

/** Headline counts for a dashboard banner / attention-queue header. */
export function summarizeAttention(items: AttentionItem[]): AttentionSummary {
  const bySeverity: Record<AttentionSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  const byCategory: Partial<Record<AttentionCategory, number>> = {};
  for (const item of items) {
    bySeverity[item.severity] += 1;
    byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
  }
  return { total: items.length, bySeverity, byCategory };
}
