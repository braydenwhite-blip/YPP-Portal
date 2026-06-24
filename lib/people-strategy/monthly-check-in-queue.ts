import type { GoalReviewStatus, GoalRatingColor } from "@prisma/client";

import type { PeoplePerformanceRow } from "./people-performance";
import type { NextActionKind, PerformanceRowFacts } from "./people-performance-selectors";
import { countMissedCheckIns, nextCheckInDisplay } from "./people-performance-selectors";

/** One segment in the 5-step monthly check-in progress bar. */
export type WorkflowSegmentState = "complete" | "active" | "pending";

export type MonthlyCheckInActionKind =
  | NextActionKind
  | "open-check-ins"
  | "send-reminder";

export type MonthlyCheckInQueueItem = {
  personId: string;
  name: string;
  mentorName: string | null;
  meetingLabel: string;
  /** Latest compiled check-in or quarterly performance rating for the color bar. */
  performanceRating: GoalRatingColor | null;
  /** Five segments: self-reflection → feedback → draft → sign-off → meeting. */
  segments: WorkflowSegmentState[];
  detailText: string;
  statusLabel: string;
  statusTone: "warning" | "info" | "success" | "danger" | "neutral";
  actionLabel: string;
  actionKind: MonthlyCheckInActionKind;
};

export const CHECK_IN_WORKFLOW_STEPS = [
  {
    key: "self-reflection",
    title: "Self-reflection",
    description: "Member submits at month end",
  },
  {
    key: "feedback",
    title: "Feedback gathered",
    description: "Chair collects collaborator input",
  },
  {
    key: "draft",
    title: "Draft update",
    description: "Chair compiles the review",
  },
  {
    key: "sign-off",
    title: "Sign-off",
    description: "Mentor / chair finalizes",
  },
  {
    key: "meeting",
    title: "Check-in meeting",
    description: "Mentor & member discuss",
  },
] as const;

const SEGMENT_CLASS: Record<WorkflowSegmentState, string> = {
  complete: "bg-[#0e9f6e]",
  active: "bg-[#e0a008]",
  pending: "bg-[#e8e8f0]",
};

export function workflowSegmentClass(state: WorkflowSegmentState): string {
  return SEGMENT_CLASS[state];
}

function segment(
  done: boolean,
  active: boolean
): WorkflowSegmentState {
  if (done) return "complete";
  if (active) return "active";
  return "pending";
}

/**
 * Derive the mockup-style queue row from live People performance facts plus
 * the current month's reflection and mentor-review status.
 */
export function deriveMonthlyCheckInQueueItem(
  row: PeoplePerformanceRow,
  extras: {
    hasSelfReflection: boolean;
    reviewStatus: GoalReviewStatus | null;
    monthShortLabel: string;
  }
): MonthlyCheckInQueueItem {
  const { facts } = row;
  const mf = facts.monthFeedback;
  const name = row.name || row.email;
  const seed = row.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const meetingLabel = nextCheckInDisplay(facts, extras.monthShortLabel, seed).label;

  const reflectionRequired = facts.mentorEligible;
  const reflectionDone = !reflectionRequired || extras.hasSelfReflection;
  const feedbackRequested = mf.requested > 0;
  const feedbackStarted = mf.submitted > 0;
  const draftDone = !facts.needsCheckIn;
  const signOffDone = extras.reviewStatus === "APPROVED";
  const signOffPending =
    extras.reviewStatus === "PENDING_CHAIR_APPROVAL" ||
    extras.reviewStatus === "DRAFT" ||
    extras.reviewStatus === "CHANGES_REQUESTED";

  const feedbackStepDone = mf.submitted > 0;

  const step1 = segment(reflectionDone, false);
  const step2 = segment(feedbackStepDone, reflectionDone && !feedbackStepDone);
  const step3 = segment(
    draftDone,
    reflectionDone && feedbackStepDone && !draftDone
  );
  const step4 = segment(
    signOffDone,
    draftDone && signOffPending && !signOffDone
  );
  const step5 = segment(false, signOffDone);

  const segments: WorkflowSegmentState[] = [step1, step2, step3, step4, step5];

  const performanceRating =
    row.recentCheckIns.find((c) => c.rating)?.rating ??
    row.quarterly?.performanceRating ??
    null;

  const missed = countMissedCheckIns(row.calendarDots);
  let detailText = buildDetailText(facts, missed);
  let statusLabel: string;
  let statusTone: MonthlyCheckInQueueItem["statusTone"];
  let actionLabel: string;
  let actionKind: MonthlyCheckInActionKind;

  if (!reflectionDone && reflectionRequired) {
    statusLabel = "Self-reflection due";
    statusTone = "warning";
    actionLabel = "Send reminder";
    actionKind = "send-reminder";
    detailText = buildDetailText(facts, missed);
  } else if (!feedbackRequested) {
    statusLabel = "Awaiting feedback";
    statusTone = "warning";
    actionLabel = "Request feedback";
    actionKind = "request-feedback";
    detailText = buildDetailText(facts, missed);
  } else if (facts.needsCheckIn && (feedbackStarted || reflectionDone)) {
    statusLabel = "Drafting update";
    statusTone = "info";
    actionLabel = "Continue draft";
    actionKind = "open-check-ins";
    if (mf.submitted > 0) {
      detailText = `${mf.submitted} of ${mf.requested} feedback responses in`;
    }
  } else if (draftDone && signOffPending) {
    statusLabel = "Ready for sign-off";
    statusTone = "info";
    actionLabel = "Review & sign off";
    actionKind = "review-feedback";
    detailText = "Draft complete — needs mentor sign-off";
  } else if (draftDone && signOffDone) {
    statusLabel = "Meeting pending";
    statusTone = "neutral";
    actionLabel = "View check-in";
    actionKind = "open-check-ins";
    detailText = "Signed off — schedule the check-in meeting";
  } else if (mf.pending > 0) {
    statusLabel = "Awaiting feedback";
    statusTone = "warning";
    actionLabel = "Review feedback";
    actionKind = "review-feedback";
    detailText = `${mf.submitted} of ${mf.requested} feedback responses in`;
  } else {
    statusLabel = "Up to date";
    statusTone = "success";
    actionLabel = "Manage check-ins";
    actionKind = "open-check-ins";
  }

  return {
    personId: row.id,
    name,
    mentorName: row.mentorName,
    meetingLabel,
    performanceRating,
    segments,
    detailText,
    statusLabel,
    statusTone,
    actionLabel,
    actionKind,
  };
}

function buildDetailText(
  facts: PerformanceRowFacts,
  missedMeetings: number
): string {
  const parts: string[] = [];
  const mf = facts.monthFeedback;
  if (mf.requested > 0 && mf.submitted > 0) {
    parts.push(`${mf.submitted} of ${mf.requested} feedback responses in`);
  } else if (mf.requested > 0 && mf.pending > 0) {
    parts.push(`${mf.pending} feedback response${mf.pending === 1 ? "" : "s"} still pending`);
  }
  if (missedMeetings > 0) {
    parts.push(`${missedMeetings} missed meeting${missedMeetings === 1 ? "" : "s"}`);
  }
  return parts.join(" · ");
}

/** Sort queue: most urgent workflow step first, then name. */
export function sortMonthlyCheckInQueue(
  items: MonthlyCheckInQueueItem[]
): MonthlyCheckInQueueItem[] {
  const rank = (item: MonthlyCheckInQueueItem) => {
    if (item.statusLabel === "Self-reflection due") return 0;
    if (item.statusLabel === "Awaiting feedback") return 1;
    if (item.statusLabel === "Drafting update") return 2;
    if (item.statusLabel === "Ready for sign-off") return 3;
    if (item.statusLabel === "Meeting pending") return 4;
    return 5;
  };
  return [...items].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
