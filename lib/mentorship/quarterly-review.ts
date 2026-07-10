import "server-only";

/**
 * Quarterly Committee Review — evidence assembly (Phase 2).
 *
 * Every third monthly cycle, the Role Committee reviews the mentee's last 3
 * monthly MentorGoalReviews plus any gathered stakeholder feedback and may
 * record a Pathway Decision. This module is the read-only evidence loader;
 * lib/mentorship/quarterly-review-actions.ts owns the writes.
 *
 * Deliberately reuses the existing QuarterlyFeedbackRequest/Response models
 * (parents/students/school officials/leadership/collaborators, 1-5 rating +
 * free text) rather than inventing a new feedback mechanism — those models
 * already matched the doc's "gather broader feedback" step but had no live
 * UI consumer before this. `quarterNumber` on QuarterlyFeedbackRequest is
 * the sequential quarter index (1st, 2nd, 3rd…), i.e. monthly cycleNumber / 3.
 */

import type { GoalRatingColor, MenteeRoleType, MentorshipQuarterlyReview } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { currentQuarterLabel } from "@/lib/people-strategy/people-performance-selectors";

export type QuarterlyEvidenceReview = {
  id: string;
  cycleMonth: Date;
  cycleNumber: number;
  overallRating: GoalRatingColor;
  overallComments: string;
  planOfAction: string;
  pointsAwarded: number | null;
};

export type QuarterlyFeedbackEvidence = {
  id: string;
  respondentName: string;
  respondentRole: string;
  overallRating: number;
  strengths: string;
  areasForGrowth: string;
  additionalNotes: string | null;
  submittedAt: Date;
};

export type QuarterlyPacket = {
  mentorshipId: string;
  menteeId: string;
  quarter: string;
  cycleNumber: number;
  quarterNumber: number;
  /** Last 3 approved+released monthly reviews, most recent first. Fewer than 3 if the mentorship is young. */
  monthlyReviews: QuarterlyEvidenceReview[];
  /** Same reviews' overall ratings, oldest first — the trend line. */
  ratingTrend: GoalRatingColor[];
  feedback: QuarterlyFeedbackEvidence[];
  feedbackRequestTokens: { id: string; token: string; createdAt: Date }[];
  pointsThisQuarter: number;
  existingReview: MentorshipQuarterlyReview | null;
};

/** Every 3rd completed monthly cycle triggers a quarterly review. */
export function isQuarterlyCycle(cycleNumber: number): boolean {
  return cycleNumber > 0 && cycleNumber % 3 === 0;
}

/**
 * Assemble the quarterly evidence packet for a mentorship — always the
 * latest up-to-3 approved+released monthly reviews. Read-only — never
 * creates or mutates the MentorshipQuarterlyReview row. `cycleNumber` is
 * optional and only needed to look up stakeholder feedback for a PAST
 * quarter; omit it to get the current due quarter (the common case).
 */
export async function loadQuarterlyPacket(args: {
  mentorshipId: string;
  menteeId: string;
  cycleNumber?: number;
}): Promise<QuarterlyPacket> {
  const { mentorshipId, menteeId, cycleNumber } = args;

  const monthlyReviews = await prisma.mentorGoalReview.findMany({
    where: {
      mentorshipId,
      status: "APPROVED",
      releasedToMenteeAt: { not: null },
      ...(cycleNumber != null ? { cycleNumber: { lte: cycleNumber } } : {}),
    },
    orderBy: { cycleNumber: "desc" },
    take: 3,
    select: {
      id: true,
      cycleMonth: true,
      cycleNumber: true,
      overallRating: true,
      overallComments: true,
      planOfAction: true,
      pointsAwarded: true,
    },
  });

  const resolvedCycleNumber = cycleNumber ?? monthlyReviews[0]?.cycleNumber ?? 0;
  const quarterNumber = Math.round(resolvedCycleNumber / 3);

  const feedbackRequests = await prisma.quarterlyFeedbackRequest.findMany({
    where: { mentorshipId, quarterNumber },
    select: {
      id: true,
      token: true,
      createdAt: true,
      responses: {
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          respondentName: true,
          respondentRole: true,
          overallRating: true,
          strengths: true,
          areasForGrowth: true,
          additionalNotes: true,
          submittedAt: true,
        },
      },
    },
  });

  // The mentee's own cycle month drives the quarter label, never wall-clock
  // "now" — a lagging or early mentee's Nth cycle need not line up with the
  // calendar quarter, and the existing-review lookup must key off the same
  // quarter the evidence describes.
  const quarter =
    monthlyReviews[0]?.cycleMonth != null
      ? currentQuarterLabel(monthlyReviews[0].cycleMonth)
      : currentQuarterLabel(new Date());

  const existingReview = await prisma.mentorshipQuarterlyReview.findUnique({
    where: { mentorshipId_quarter: { mentorshipId, quarter } },
  });

  const feedback = feedbackRequests.flatMap((r) => r.responses);
  const pointsThisQuarter = monthlyReviews.reduce((sum, r) => sum + (r.pointsAwarded ?? 0), 0);
  const ratingTrend = [...monthlyReviews].reverse().map((r) => r.overallRating);

  return {
    mentorshipId,
    menteeId,
    quarter,
    cycleNumber: resolvedCycleNumber,
    quarterNumber,
    monthlyReviews,
    ratingTrend,
    feedback,
    feedbackRequestTokens: feedbackRequests.map((r) => ({ id: r.id, token: r.token, createdAt: r.createdAt })),
    pointsThisQuarter,
    existingReview,
  };
}

/** Fetch the existing MentorshipQuarterlyReview for this mentorship/quarter, if any, by its actual quarter key (not "now"). */
export async function findQuarterlyReview(mentorshipId: string, quarter: string) {
  return prisma.mentorshipQuarterlyReview.findUnique({
    where: { mentorshipId_quarter: { mentorshipId, quarter } },
  });
}

export type QuarterlyQueueEntry = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  menteeRole: string | null;
  mentorId: string;
  mentorName: string | null;
  quarter: string;
  /**
   * Null means due but not yet started. Includes "APPROVED" in the type
   * even though loadQuarterlyCommitteeQueue() always filters those out
   * before returning — kept honest to the intermediate shape so the map
   * step below doesn't need an unsound cast.
   */
  status:
    | "DRAFT"
    | "PENDING_CHAIR_APPROVAL"
    | "CHANGES_REQUESTED"
    | "PENDING_BOARD_APPROVAL"
    | "APPROVED"
    | null;
};

/**
 * Every ACTIVE mentorship currently due for (or mid-) quarterly committee
 * review, excluding ones already fully APPROVED. Three queries total
 * regardless of population size — no per-mentorship round trip. Callers
 * (the /mentorship/committee queue) apply their own viewer-scoping filter
 * on top of this org-wide list.
 */
export async function loadQuarterlyCommitteeQueue(): Promise<QuarterlyQueueEntry[]> {
  const dueMentorships = await prisma.mentorship.findMany({
    where: { status: "ACTIVE", cycleStage: "APPROVED" },
    select: {
      id: true,
      menteeId: true,
      mentorId: true,
      mentee: { select: { name: true, email: true, primaryRole: true } },
      mentor: { select: { name: true, email: true } },
    },
  });
  if (dueMentorships.length === 0) return [];

  const mentorshipIds = dueMentorships.map((m) => m.id);
  const latestReviews = await prisma.mentorGoalReview.findMany({
    where: { mentorshipId: { in: mentorshipIds }, status: "APPROVED", releasedToMenteeAt: { not: null } },
    orderBy: { cycleNumber: "desc" },
    select: { mentorshipId: true, cycleNumber: true, cycleMonth: true },
  });
  const latestByMentorship = new Map<string, { cycleNumber: number; cycleMonth: Date }>();
  for (const r of latestReviews) {
    if (!latestByMentorship.has(r.mentorshipId)) latestByMentorship.set(r.mentorshipId, r);
  }

  const dueList = dueMentorships
    .map((m) => ({ ...m, latest: latestByMentorship.get(m.id) ?? null }))
    .filter((m): m is typeof m & { latest: { cycleNumber: number; cycleMonth: Date } } =>
      m.latest != null && isQuarterlyCycle(m.latest.cycleNumber)
    );
  if (dueList.length === 0) return [];

  const existingReviews = await prisma.mentorshipQuarterlyReview.findMany({
    where: { mentorshipId: { in: dueList.map((m) => m.id) } },
    select: { mentorshipId: true, quarter: true, status: true },
  });
  const existingByKey = new Map(existingReviews.map((r) => [`${r.mentorshipId}:${r.quarter}`, r.status]));

  return dueList
    .map((m) => {
      const quarter = currentQuarterLabel(m.latest.cycleMonth);
      const status = existingByKey.get(`${m.id}:${quarter}`) ?? null;
      return {
        mentorshipId: m.id,
        menteeId: m.menteeId,
        menteeName: m.mentee.name || m.mentee.email,
        menteeRole: m.mentee.primaryRole,
        mentorId: m.mentorId,
        mentorName: m.mentor.name || m.mentor.email,
        quarter,
        status,
      };
    })
    .filter((entry) => entry.status !== "APPROVED");
}

/**
 * Viewer-scoping over the org-wide quarterly queue — pure so every surface
 * (the Mentorship home queue, tests) applies identical visibility rules:
 * admins/leadership see everything; a lane chair sees their lane's mentees;
 * a mentor sees their own mentees regardless of chair status (they're the
 * one who starts and drafts the packet).
 */
export function scopeQuarterlyQueueForViewer(
  entries: QuarterlyQueueEntry[],
  facts: {
    viewerId: string;
    isAdminOrLeadership: boolean;
    chairedLanes: MenteeRoleType[];
  }
): QuarterlyQueueEntry[] {
  if (facts.isAdminOrLeadership) return entries;
  return entries.filter((entry) => {
    const roleType = toMenteeRoleType(entry.menteeRole);
    const chairsThisLane = roleType != null && facts.chairedLanes.includes(roleType);
    const isTheirMentee = entry.mentorId === facts.viewerId;
    return chairsThisLane || isTheirMentee;
  });
}
