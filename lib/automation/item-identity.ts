// Deterministic identity for read-model automation items.
//
// Pure automation has no database row, so a STABLE id is what lets the UI track,
// de-duplicate, dismiss, and snooze an item across renders (and, in a future
// pass, persist a dismissal that survives until the underlying condition
// genuinely changes). An id is built from the parts that define "the same piece
// of work": the rule type, the chapter, the subject entity, and an optional
// window discriminator (a date or week the item is scoped to).
//
//   automationItemId("PARTNER_FOLLOW_UP_DUE", chapterId, { entityId: partnerId,
//                     window: nextFollowUpAt })
//     → "partner-follow-up-due:chap_123:part_456:2026-06-20"
//
// Existing engines already mint stable per-(rule, subject) keys (e.g.
// `partner-followup:${id}` in needs-attention-rules.ts). When normalizing those,
// we preserve the original key as the discriminator so an item keeps one identity
// no matter which surface renders it — see `lib/automation/adapters.ts`.

import type { AutomationItemType } from "@/lib/automation/types";

/** Stable, URL-safe slug per type (kebab-case of the enum). */
export const AUTOMATION_TYPE_SLUG: Record<AutomationItemType, string> = {
  PARTNER_RESEARCH_NOT_STARTED: "partner-research-not-started",
  PARTNER_OUTREACH_BELOW_TARGET: "partner-outreach-below-target",
  PARTNER_FOLLOW_UP_DUE: "partner-follow-up-due",
  PARTNER_MEETING_OUTCOME_MISSING: "partner-meeting-outcome-missing",
  PARTNER_LOGISTICS_INCOMPLETE: "partner-logistics-incomplete",
  PARTNER_ISSUE_UNRESOLVED: "partner-issue-unresolved",
  PARTNER_WEEKLY_CHECKIN_DUE: "partner-weekly-checkin-due",
  INSTRUCTOR_RECRUITING_NOT_STARTED: "instructor-recruiting-not-started",
  INSTRUCTOR_OUTREACH_BELOW_TARGET: "instructor-outreach-below-target",
  INSTRUCTOR_APPLICATION_REVIEW_DUE: "instructor-application-review-due",
  INSTRUCTOR_INTERVIEW_UNSCHEDULED: "instructor-interview-unscheduled",
  INSTRUCTOR_INTERVIEW_DECISION_DUE: "instructor-interview-decision-due",
  INSTRUCTOR_ORIENTATION_MISSING: "instructor-orientation-missing",
  INSTRUCTOR_READINESS_CHECK_DUE: "instructor-readiness-check-due",
  INSTRUCTOR_ASSIGNMENT_UNCONFIRMED: "instructor-assignment-unconfirmed",
  CURRICULUM_SUBMISSION_MISSING: "curriculum-submission-missing",
  CURRICULUM_REVIEW_DUE: "curriculum-review-due",
  CURRICULUM_REVISION_OVERDUE: "curriculum-revision-overdue",
  CURRICULUM_GLOBAL_REVIEW_READY: "curriculum-global-review-ready",
  CLASS_MISSING_INSTRUCTOR: "class-missing-instructor",
  CLASS_MISSING_LOCATION: "class-missing-location",
  CLASS_MISSING_TIME: "class-missing-time",
  CLASS_NOT_PUBLIC: "class-not-public",
  LAUNCH_DATE_MISSING: "launch-date-missing",
  PRE_LAUNCH_REMINDER_DUE: "pre-launch-reminder-due",
  ENROLLMENT_LOW: "enrollment-low",
  ENROLLMENT_TREND_RISK: "enrollment-trend-risk",
  ADVERTISING_NOT_STARTED: "advertising-not-started",
  ADVERTISING_CHANNEL_MISSING: "advertising-channel-missing",
  STUDENT_ABSENCE_STREAK: "student-absence-streak",
  ATTENDANCE_DROP: "attendance-drop",
  FEEDBACK_COLLECTION_DUE: "feedback-collection-due",
  INSTRUCTOR_WEEKLY_CHECKIN_DUE: "instructor-weekly-checkin-due",
  CLASS_OBSERVATION_DUE: "class-observation-due",
  SESSION_2_RETURNING_INSTRUCTOR_RESPONSE_DUE: "session-2-returning-instructor-response-due",
  SESSION_2_RECRUITING_DUE: "session-2-recruiting-due",
  SESSION_REVIEW_DUE: "session-review-due",
  IMPACT_MEETING_PREP_DUE: "impact-meeting-prep-due",
  IMPACT_MEETING_NUMBERS_MISSING: "impact-meeting-numbers-missing",
  CHAPTER_BEHIND_PLAYBOOK: "chapter-behind-playbook",
};

/** Normalize any discriminator (Date | string | number) to a compact token. */
function token(value: Date | string | number | null | undefined): string {
  if (value == null) return "_";
  if (value instanceof Date) return value.toISOString().slice(0, 10); // day precision
  return String(value).replace(/[:\s]+/g, "-");
}

export type ItemIdParts = {
  /** A subject entity id (partner, applicant, class…), or null for chapter-wide. */
  entityId?: string | null;
  /** A date/week/string scoping the item to a window (keeps the id stable but
   *  re-fires when the window genuinely moves). */
  window?: Date | string | number | null;
};

/**
 * Build the deterministic id for an automation item. Same inputs → same id, so
 * the item is stable across renders and a future dismissal can target it.
 */
export function automationItemId(
  type: AutomationItemType,
  chapterId: string,
  parts: ItemIdParts = {}
): string {
  const segments = [AUTOMATION_TYPE_SLUG[type], chapterId, token(parts.entityId)];
  if (parts.window !== undefined) segments.push(token(parts.window));
  return segments.join(":");
}

/**
 * Build an id from an EXISTING engine key (e.g. a `ChapterBlocker.key` like
 * `partner-followup:part_456`). The original key already encodes (rule, subject)
 * uniquely, so we namespace it under the type + chapter to guarantee global
 * uniqueness without losing the source engine's stability.
 */
export function automationItemIdFromKey(
  type: AutomationItemType,
  chapterId: string,
  sourceKey: string
): string {
  return `${AUTOMATION_TYPE_SLUG[type]}:${chapterId}:${sourceKey}`;
}

export type ParsedItemId = {
  slug: string;
  chapterId: string | null;
  rest: string[];
};

/** Best-effort parse of an automation id back into its parts. */
export function parseAutomationItemId(id: string): ParsedItemId {
  const [slug, chapterId, ...rest] = id.split(":");
  return { slug: slug ?? "", chapterId: chapterId ?? null, rest };
}
