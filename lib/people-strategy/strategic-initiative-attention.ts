import { addDays, formatMonthDay, startOfDay } from "@/lib/leadership-action-center/dates";

import type { InitiativeMilestoneSummary } from "./strategic-milestones";
import type { InitiativeSummary } from "./strategic-initiative-summary";
import type { StrategicTimelineEvent } from "./strategic-timeline";
import { isTerminalStatus } from "./strategic-initiatives";

/**
 * YPP Execution OS — Initiative NEEDS-ATTENTION + CONNECTION helpers.
 *
 * The Initiatives surfaces lead with plain, officer-ready language, not a vague
 * "health score". This module turns a derived {@link InitiativeSummary} into the
 * concrete answers every card and detail page needs:
 *
 *   • WHAT needs attention now — clear labels (Blocked, Overdue, Due soon, No
 *     next action, Owner missing, Waiting on meeting follow-up), each with a
 *     one-line "why".
 *   • The NEXT milestone to hit.
 *   • The LAST and NEXT related meeting.
 *   • The single clearest NEXT STEP.
 *
 * Pure (only the injected `now`) and reads only the serializable summary, so it
 * unit-tests with plain fixtures and runs identically on the list + detail.
 */

/** How soon a milestone target counts as "due soon". */
export const DUE_SOON_DAYS = 14;

export type AttentionTone = "overdue" | "warning" | "info" | "neutral";

export type AttentionReasonKey =
  | "blocked"
  | "overdue"
  | "due_soon"
  | "no_next_action"
  | "owner_missing"
  | "meeting_follow_up";

export type AttentionReason = {
  key: AttentionReasonKey;
  /** Short chip label, e.g. "Blocked", "Due soon". */
  label: string;
  tone: AttentionTone;
  /** One-line, human "why this is flagged". */
  detail: string;
};

/** The first milestone that isn't complete (roadmap order) — the one to hit next. */
export function nextOpenMilestone(
  summary: InitiativeSummary
): InitiativeMilestoneSummary | null {
  return summary.milestones.find((m) => m.status !== "complete") ?? null;
}

/** The most recent past meeting tied to the initiative, or null. */
export function lastMeetingEvent(
  summary: InitiativeSummary
): StrategicTimelineEvent | null {
  // `events` is newest-first; fall back to the key-moments roll-up (the list
  // view keeps the full timeline light, but key moments always carry meetings).
  return (
    summary.timeline.events.find((e) => e.type === "meeting") ??
    summary.timeline.keyMoments.find((e) => e.type === "meeting") ??
    null
  );
}

/** The soonest upcoming (scheduled) meeting tied to the initiative, or null. */
export function nextMeetingEvent(
  summary: InitiativeSummary
): StrategicTimelineEvent | null {
  return summary.timeline.upcoming.find((e) => e.type === "meeting") ?? null;
}

/** The single clearest next step: the top recommendation, else a sensible derive. */
export function primaryNextStep(summary: InitiativeSummary): string {
  const rec = summary.recommendations[0];
  if (rec) return rec.title;
  const step = summary.healthExplanation.suggestedNextSteps[0];
  if (step) return step;
  const next = nextOpenMilestone(summary);
  if (next) return `Advance “${next.title}”`;
  return "Confirm the next milestone and owner.";
}

/**
 * Every reason this initiative needs attention now, in priority order. Empty
 * when nothing is wrong (and always empty for completed / archived work).
 */
export function deriveInitiativeAttention(
  summary: InitiativeSummary,
  now: Date = new Date()
): AttentionReason[] {
  const reasons: AttentionReason[] = [];
  if (isTerminalStatus(summary.status)) return reasons;

  const next = nextOpenMilestone(summary);
  const c = summary.counts;

  // 1. Blocked — a blocked milestone, or blocked actions with no path forward.
  const blockedMilestone = summary.milestones.find((m) => m.status === "blocked");
  if (blockedMilestone || c.blockedActions > 0) {
    reasons.push({
      key: "blocked",
      label: "Blocked",
      tone: "overdue",
      detail: blockedMilestone
        ? `Milestone “${blockedMilestone.title}” is blocked.`
        : `${c.blockedActions} blocked action${c.blockedActions === 1 ? "" : "s"} need a path forward.`,
    });
  }

  // 2. Overdue — next milestone past its target, or the initiative past target.
  const milestoneOverdue = Boolean(next && next.behindSchedule);
  if (milestoneOverdue || summary.pastTargetDate) {
    reasons.push({
      key: "overdue",
      label: "Overdue",
      tone: "overdue",
      detail: milestoneOverdue
        ? `“${next!.title}” is past its target date.`
        : "This initiative is past its target date.",
    });
  } else if (next?.targetDateISO) {
    // 3. Due soon — next milestone target falls inside the horizon.
    const target = new Date(next.targetDateISO).getTime();
    const horizon = addDays(startOfDay(now), DUE_SOON_DAYS).getTime();
    if (target <= horizon) {
      reasons.push({
        key: "due_soon",
        label: "Due soon",
        tone: "warning",
        detail: `“${next.title}” is due ${formatMonthDay(new Date(next.targetDateISO))}.`,
      });
    }
  }

  // 4. No next action — incomplete work, but nothing open is driving it.
  const hasIncompleteWork = next !== null || c.milestonesTotal === 0;
  if (c.openActions === 0 && hasIncompleteWork && summary.status !== "planning") {
    reasons.push({
      key: "no_next_action",
      label: "No next action",
      tone: "warning",
      detail: "No open action is driving this initiative right now.",
    });
  }

  // 5. Owner missing — nobody is clearly accountable.
  if (summary.owner === null || summary.ownership.clarity === "unowned") {
    reasons.push({
      key: "owner_missing",
      label: "Owner missing",
      tone: "warning",
      detail: "No clear owner is accountable for this initiative.",
    });
  }

  // 6. Waiting on meeting follow-up — open follow-ups / decisions to convert.
  if (c.openFollowUps > 0 || c.decisionsWithoutAction > 0) {
    const parts: string[] = [];
    if (c.openFollowUps > 0) {
      parts.push(`${c.openFollowUps} open follow-up${c.openFollowUps === 1 ? "" : "s"}`);
    }
    if (c.decisionsWithoutAction > 0) {
      parts.push(
        `${c.decisionsWithoutAction} decision${c.decisionsWithoutAction === 1 ? "" : "s"} to convert`
      );
    }
    reasons.push({
      key: "meeting_follow_up",
      label: "Waiting on meeting follow-up",
      tone: "info",
      detail: `${parts.join(" and ")} from recent meetings.`,
    });
  }

  return reasons;
}

/** True when the initiative has at least one needs-attention reason. */
export function initiativeNeedsAttention(
  summary: InitiativeSummary,
  now: Date = new Date()
): boolean {
  return deriveInitiativeAttention(summary, now).length > 0;
}

/** The single most urgent reason (for a compact one-chip card), or null. */
export function topAttentionReason(
  summary: InitiativeSummary,
  now: Date = new Date()
): AttentionReason | null {
  return deriveInitiativeAttention(summary, now)[0] ?? null;
}
