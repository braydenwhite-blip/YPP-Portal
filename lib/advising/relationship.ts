// Student Advising — deterministic relationship-lifecycle logic.
//
// Pure functions over assignment-shaped rows. No Prisma, no clock except the
// injected `now`, so every branch is unit-testable. Thresholds are shared with
// the existing caseload math in lib/leadership/constants.ts so the advisor
// dashboard and this cockpit never disagree.

import {
  ADVISOR_ACTIVE_WINDOW_DAYS,
  ADVISOR_INACTIVE_AFTER_DAYS,
} from "@/lib/leadership/constants";
import type { AdvisingAssignmentRow, AdvisingLifecycle, AdvisingTone } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days a kickoff (first check-in) can wait before it reads as overdue. */
export const KICKOFF_GRACE_DAYS = 10;
/** A check-in within this window counts the relationship as "recently active". */
export const RECENT_CHECKIN_DAYS = ADVISOR_ACTIVE_WINDOW_DAYS;

export type AdvisingLifecycleResult = {
  lifecycle: AdvisingLifecycle;
  /** Concrete status label for the badge. */
  label: string;
  tone: AdvisingTone;
  /** Why the relationship is in this state, in plain English. */
  reason: string;
  /** The single recommended next action. */
  nextAction: string;
  /** Whole days since the last check-in, or null when never checked in. */
  daysSinceCheckIn: number | null;
  /** Whole days since the assignment started. */
  daysSinceStart: number;
};

function wholeDays(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function describeAgo(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/**
 * Derive the lifecycle stage of a single advisor↔student relationship. The
 * decision tree is priority-ordered so each assignment resolves to exactly one
 * stage — the basis for de-duplicated cockpit lanes.
 */
export function deriveAdvisingLifecycle(
  assignment: Pick<
    AdvisingAssignmentRow,
    | "isActive"
    | "advisingStatus"
    | "needsFollowUp"
    | "followUpNote"
    | "lastCheckInAt"
    | "nextCheckInDueAt"
    | "startDate"
  >,
  now: Date = new Date(),
): AdvisingLifecycleResult {
  const daysSinceStart = wholeDays(assignment.startDate, now);
  const daysSinceCheckIn = assignment.lastCheckInAt
    ? wholeDays(assignment.lastCheckInAt, now)
    : null;

  if (!assignment.isActive) {
    return {
      lifecycle: "INACTIVE",
      label: "Inactive",
      tone: "neutral",
      reason: "Advising relationship has ended.",
      nextAction: "Reactivate or reassign if the student still needs an advisor.",
      daysSinceCheckIn,
      daysSinceStart,
    };
  }

  // Never checked in → the first check-in IS the kickoff.
  if (daysSinceCheckIn === null) {
    const overdue = daysSinceStart > KICKOFF_GRACE_DAYS;
    return {
      lifecycle: "KICKOFF_NEEDED",
      label: "Kickoff needed",
      tone: overdue ? "danger" : "warning",
      reason: overdue
        ? `Advisor assigned ${describeAgo(daysSinceStart)}, but the kickoff check-in still hasn't happened.`
        : "Advisor assigned, but the kickoff check-in hasn't happened yet.",
      nextAction: "Schedule the kickoff check-in with the student.",
      daysSinceCheckIn,
      daysSinceStart,
    };
  }

  // Gone quiet for a long time → stale, regardless of flags.
  if (daysSinceCheckIn > ADVISOR_INACTIVE_AFTER_DAYS) {
    return {
      lifecycle: "STALE",
      label: "Stale",
      tone: "danger",
      reason: `Last check-in was ${describeAgo(daysSinceCheckIn)} — the relationship has gone quiet.`,
      nextAction: "Check in with the student or reassign the advisor.",
      daysSinceCheckIn,
      daysSinceStart,
    };
  }

  const checkInOverdue =
    assignment.nextCheckInDueAt != null && assignment.nextCheckInDueAt < now;

  if (
    assignment.needsFollowUp ||
    assignment.advisingStatus === "NEEDS_ATTENTION" ||
    checkInOverdue
  ) {
    const reason = assignment.followUpNote
      ? assignment.followUpNote
      : checkInOverdue
        ? `A scheduled check-in is now past due (last check-in ${describeAgo(daysSinceCheckIn)}).`
        : assignment.advisingStatus === "NEEDS_ATTENTION"
          ? "Flagged as needing attention."
          : `Last check-in was ${describeAgo(daysSinceCheckIn)}; follow-up is due.`;
    return {
      lifecycle: "FOLLOW_UP_DUE",
      label: "Follow-up due",
      tone: "warning",
      reason,
      nextAction: "Log a check-in or create a follow-up action.",
      daysSinceCheckIn,
      daysSinceStart,
    };
  }

  if (assignment.advisingStatus === "READY_FOR_NEXT") {
    return {
      lifecycle: "READY_FOR_NEXT",
      label: "Ready for next",
      tone: "info",
      reason: "Student is ready for their next opportunity.",
      nextAction: "Recommend a class, project, mentor, or the instructor pathway.",
      daysSinceCheckIn,
      daysSinceStart,
    };
  }

  return {
    lifecycle: "ACTIVE",
    label: "Active",
    tone: "success",
    reason: `Active — last check-in ${describeAgo(daysSinceCheckIn)}.`,
    nextAction: "Keep the cadence; next check-in stays on schedule.",
    daysSinceCheckIn,
    daysSinceStart,
  };
}

/** Whether an active relationship was checked in recently enough to feature in
 *  the "recently checked in" reassurance lane. */
export function isRecentlyCheckedIn(
  daysSinceCheckIn: number | null,
): boolean {
  return daysSinceCheckIn !== null && daysSinceCheckIn <= RECENT_CHECKIN_DAYS;
}
