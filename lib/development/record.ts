import "server-only";

import type { QuarterlyReviewDecision } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireLeadership } from "@/lib/authorization";
import {
  generateReviewEvidence,
  type ReviewEvidence,
} from "@/lib/leadership/review-summary";
import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import { GROWTH_TAG_META } from "@/lib/people-strategy/growth-signals";
import { isActionOverdue } from "@/lib/people-strategy/people-dashboard-selectors";
import { formatDueDate, startOfDay } from "@/lib/leadership-action-center/dates";

import { loadDevelopmentFactsForPerson } from "./load";
import {
  deriveDevelopmentSignals,
  primaryLane,
  recommendNextStep,
  LANE_META,
  type DevelopmentLaneId,
  type DevelopmentNextStep,
  type DevelopmentPersonFacts,
  type DevelopmentSignal,
} from "./signals";

/**
 * Leadership Development — one person's development record.
 *
 * A coherent coaching view over records other surfaces already write: the
 * mentorship loop, monthly check-ins, quarterly reviews, the action tracker,
 * growth tags, and leadership contributions. Leadership-only; carries rating
 * colors, statuses, and titles — never review comments or feedback bodies.
 */

export type DevelopmentTimelineEvent = {
  /** ISO — orders the timeline, newest first. */
  atISO: string;
  /** "Jun 12, 2026" — already formatted for display. */
  dateLabel: string;
  kind:
    | "check-in"
    | "quarterly-review"
    | "mentor-review"
    | "session"
    | "action-completed"
    | "growth-tag"
    | "contribution";
  label: string;
  detail: string | null;
  tone: "danger" | "warning" | "info" | "brand" | "success" | "neutral";
};

export type DevelopmentOpenItem = {
  id: string;
  title: string;
  /** "Due Jun 20" / "Overdue since Jun 2" style label. */
  dueLabel: string | null;
  overdue: boolean;
  href: string;
};

export type DevelopmentRecord = {
  facts: DevelopmentPersonFacts;
  signals: DevelopmentSignal[];
  lane: DevelopmentLaneId | null;
  laneTitle: string | null;
  nextStep: DevelopmentNextStep;
  timeline: DevelopmentTimelineEvent[];
  openActions: DevelopmentOpenItem[];
  openFollowUps: Array<{ id: string; title: string; meetingTitle: string; dueLabel: string | null }>;
  /** Review-ready strengths evidence (instructor contributions). */
  reviewEvidence: ReviewEvidence | null;
};

const DECISION_LABELS: Record<QuarterlyReviewDecision, string> = {
  PROMOTION: "Promotion",
  ACHIEVEMENT_AWARD: "Achievement award",
  ROLE_CHANGE: "Role change",
  PIP: "Support plan",
  CONTINUATION: "Continue in role",
};

const TIMELINE_CAP = 24;

function dateLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function monthNameUTC(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

function ratingTone(
  rating: "BEHIND_SCHEDULE" | "GETTING_STARTED" | "ACHIEVED" | "ABOVE_AND_BEYOND" | null
): DevelopmentTimelineEvent["tone"] {
  if (!rating) return "neutral";
  if (rating === "BEHIND_SCHEDULE") return "danger";
  if (rating === "GETTING_STARTED") return "warning";
  if (rating === "ABOVE_AND_BEYOND") return "brand";
  return "success";
}

export async function loadDevelopmentRecord(
  userId: string,
  now: Date = new Date()
): Promise<DevelopmentRecord | null> {
  await requireLeadership();

  const facts = await loadDevelopmentFactsForPerson(userId, now);
  if (!facts) return null;

  const today = startOfDay(now);

  const [
    checkIns,
    quarterlyReviews,
    mentorReviews,
    sessions,
    completedActions,
    growthTags,
    contributions,
    openActions,
    openFollowUps,
  ] = await Promise.all([
    prisma.checkIn.findMany({
      where: { userId },
      orderBy: { month: "desc" },
      take: 12,
      select: { id: true, month: true, performanceRating: true, createdAt: true },
    }),
    prisma.quarterlyReview.findMany({
      where: { userId },
      orderBy: [{ quarter: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        quarter: true,
        performanceRating: true,
        potentialRating: true,
        decision: true,
        successionFlag: true,
        createdAt: true,
      },
    }),
    prisma.mentorGoalReview.findMany({
      where: { menteeId: userId, releasedToMenteeAt: { not: null } },
      orderBy: { releasedToMenteeAt: "desc" },
      take: 12,
      select: {
        id: true,
        cycleMonth: true,
        overallRating: true,
        releasedToMenteeAt: true,
        mentor: { select: { name: true, email: true } },
      },
    }),
    prisma.mentorshipSession.findMany({
      where: { mentorship: { menteeId: userId }, completedAt: { not: null } },
      orderBy: { completedAt: "desc" },
      take: 10,
      select: {
        id: true,
        completedAt: true,
        mentorship: { select: { mentor: { select: { name: true, email: true } } } },
      },
    }),
    prisma.actionItem.findMany({
      where: {
        status: "COMPLETE",
        completedAt: { not: null },
        OR: [{ leadId: userId }, { assignments: { some: { userId } } }],
      },
      orderBy: { completedAt: "desc" },
      take: 8,
      select: { id: true, title: true, completedAt: true },
    }),
    prisma.memberGrowthTag.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true, tag: true, createdAt: true },
    }),
    prisma.leadershipContribution.findMany({
      where: { instructorId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        category: true,
        status: true,
        weight: true,
        isOwnership: true,
        reviewVisible: true,
        createdAt: true,
      },
    }),
    prisma.actionItem.findMany({
      where: {
        status: { notIn: ["COMPLETE", "DROPPED"] },
        OR: [{ leadId: userId }, { assignments: { some: { userId } } }],
      },
      orderBy: { deadlineStart: "asc" },
      take: 12,
      select: {
        id: true,
        title: true,
        status: true,
        deadlineStart: true,
        deadlineEnd: true,
      },
    }),
    prisma.meetingFollowUp.findMany({
      where: { ownerId: userId, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        dueDate: true,
        meeting: { select: { title: true } },
      },
    }),
  ]);

  const events: DevelopmentTimelineEvent[] = [];

  for (const checkIn of checkIns) {
    events.push({
      atISO: checkIn.createdAt.toISOString(),
      dateLabel: dateLabel(checkIn.createdAt),
      kind: "check-in",
      label: `${monthNameUTC(checkIn.month)} check-in compiled`,
      detail: checkIn.performanceRating
        ? `Rated ${RATING_LABELS[checkIn.performanceRating]}`
        : null,
      tone: ratingTone(checkIn.performanceRating),
    });
  }

  for (const review of quarterlyReviews) {
    events.push({
      atISO: review.createdAt.toISOString(),
      dateLabel: dateLabel(review.createdAt),
      kind: "quarterly-review",
      label: `${review.quarter} quarterly review`,
      detail: [
        `Performance ${RATING_LABELS[review.performanceRating]}`,
        `Potential ${RATING_LABELS[review.potentialRating]}`,
        DECISION_LABELS[review.decision],
        review.successionFlag ? "Succession candidate" : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tone: ratingTone(review.performanceRating),
    });
  }

  for (const review of mentorReviews) {
    const at = review.releasedToMenteeAt;
    if (!at) continue;
    events.push({
      atISO: at.toISOString(),
      dateLabel: dateLabel(at),
      kind: "mentor-review",
      label: review.cycleMonth
        ? `${monthNameUTC(review.cycleMonth)} mentor review released`
        : "Mentor review released",
      detail: [
        review.overallRating ? `Overall ${RATING_LABELS[review.overallRating]}` : null,
        review.mentor ? `Mentor: ${review.mentor.name || review.mentor.email}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      tone: ratingTone(review.overallRating),
    });
  }

  for (const session of sessions) {
    const at = session.completedAt;
    if (!at) continue;
    const mentor = session.mentorship?.mentor ?? null;
    events.push({
      atISO: at.toISOString(),
      dateLabel: dateLabel(at),
      kind: "session",
      label: "Mentorship session",
      detail: mentor ? `With ${mentor.name || mentor.email}` : null,
      tone: "info",
    });
  }

  for (const action of completedActions) {
    const at = action.completedAt;
    if (!at) continue;
    events.push({
      atISO: at.toISOString(),
      dateLabel: dateLabel(at),
      kind: "action-completed",
      label: `Completed: ${action.title}`,
      detail: null,
      tone: "success",
    });
  }

  for (const tag of growthTags) {
    events.push({
      atISO: tag.createdAt.toISOString(),
      dateLabel: dateLabel(tag.createdAt),
      kind: "growth-tag",
      label: `Flagged: ${GROWTH_TAG_META[tag.tag].label}`,
      detail: null,
      tone: GROWTH_TAG_META[tag.tag].kind === "growth" ? "brand" : "warning",
    });
  }

  for (const contribution of contributions) {
    if (!contribution.reviewVisible) continue;
    events.push({
      atISO: contribution.createdAt.toISOString(),
      dateLabel: dateLabel(contribution.createdAt),
      kind: "contribution",
      label: `Leadership role: ${contribution.title}`,
      detail: contribution.isOwnership ? "Ownership role" : null,
      tone: "info",
    });
  }

  events.sort((a, b) => b.atISO.localeCompare(a.atISO));

  const signals = deriveDevelopmentSignals(facts);
  const lane = primaryLane(signals);

  const reviewEvidence =
    facts.population === "instructor" || contributions.length > 0
      ? generateReviewEvidence(contributions, null)
      : null;

  return {
    facts,
    signals,
    lane,
    laneTitle: lane ? LANE_META[lane].title : null,
    nextStep: recommendNextStep(facts, signals),
    timeline: events.slice(0, TIMELINE_CAP),
    openActions: openActions.map((action) => {
      const overdue = isActionOverdue(
        { ...action, departmentName: null },
        today
      );
      return {
        id: action.id,
        title: action.title,
        dueLabel: formatDueDate(action.deadlineEnd ?? action.deadlineStart),
        overdue,
        href: `/actions/${action.id}`,
      };
    }),
    openFollowUps: openFollowUps.map((followUp) => ({
      id: followUp.id,
      title: followUp.title,
      meetingTitle: followUp.meeting.title,
      dueLabel: followUp.dueDate ? formatDueDate(followUp.dueDate) : null,
    })),
    reviewEvidence,
  };
}
