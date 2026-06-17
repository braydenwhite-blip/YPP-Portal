import type { GoalRatingColor, MentorshipCycleStage } from "@prisma/client";

import { buildMentorshipViewModel } from "./selectors";
import type {
  MentorshipRelationshipFact,
  MentorshipSessionFact,
  MentorshipViewModel,
} from "./view-model";

/**
 * Calm Mentorship — server-side adapters (Phase 3).
 *
 * The home + roster surfaces already load the simplified mentor kanban and the
 * engagement snapshot. Rather than re-query, these pure mappers reshape that
 * data into the canonical relationship facts the Phase-01 selectors consume, so
 * Calm and Executive render from one view-model. Intentionally lossy: sessions
 * come from the engagement snapshot; goals / commitments / feedback are not on
 * the home surface and stay empty until the relationship-detail phases load
 * them. No Prisma, no IO — deterministic given (input, now) and unit-testable.
 */

/** The slice of a simplified mentor-kanban card the home/roster surfaces need. */
export type MentorHomeCardInput = {
  mentorshipId: string;
  menteeId: string;
  menteeName: string;
  cycleStage: MentorshipCycleStage;
  kickoffPending: boolean;
  /** GoalRatingColor values from the latest review (may be empty). */
  latestRatings: string[];
};

/** The slice of an engagement upcoming-session the home surface needs. */
export type MentorHomeSessionInput = {
  id: string;
  menteeId: string;
  title: string;
  type: string;
  scheduledISO: string;
};

/** Lower = more in need of support; drives the calm headline color. */
const RATING_SEVERITY: Record<string, number> = {
  BEHIND_SCHEDULE: 0,
  GETTING_STARTED: 1,
  ACHIEVED: 2,
  ABOVE_AND_BEYOND: 3,
};

/**
 * The single headline rubric color for a relationship row: the most actionable
 * (lowest-severity) rating, so a calm list leads with what needs support
 * instead of burying it behind a healthy average. Null when no rating exists.
 */
export function headlineRatingColor(ratings: string[]): GoalRatingColor | null {
  let worst: string | null = null;
  for (const rating of ratings) {
    if (!(rating in RATING_SEVERITY)) continue;
    if (worst === null || RATING_SEVERITY[rating] < RATING_SEVERITY[worst]) {
      worst = rating;
    }
  }
  return (worst as GoalRatingColor | null) ?? null;
}

function sessionFactsFor(
  menteeId: string,
  sessions: MentorHomeSessionInput[]
): MentorshipSessionFact[] {
  return sessions
    .filter((session) => session.menteeId === menteeId)
    .map((session) => ({
      id: session.id,
      type: session.type as MentorshipSessionFact["type"],
      title: session.title || "Mentorship session",
      scheduledISO: session.scheduledISO,
      completedISO: null,
      cancelledISO: null,
    }));
}

/**
 * Map the already-loaded mentor kanban + engagement data into canonical
 * relationship facts, treating the viewer as the responsible mentor for every
 * card (the kanban only returns relationships the viewer can act on).
 */
export function mentorCardsToFacts({
  viewerId,
  viewerName,
  cards,
  sessions,
}: {
  viewerId: string;
  viewerName: string;
  cards: MentorHomeCardInput[];
  sessions: MentorHomeSessionInput[];
}): MentorshipRelationshipFact[] {
  return cards.map((card) => ({
    id: card.mentorshipId,
    mentorId: viewerId,
    mentorName: viewerName,
    menteeId: card.menteeId,
    menteeName: card.menteeName,
    chairId: null,
    status: "ACTIVE",
    cycleStage: card.cycleStage,
    cycleNumber: 0,
    releasedColorStatus: headlineRatingColor(card.latestRatings),
    kickoffCompleted:
      !card.kickoffPending && card.cycleStage !== "KICKOFF_PENDING",
    reflectionDue: card.cycleStage === "REFLECTION_DUE",
    reviewDue: card.cycleStage === "REFLECTION_SUBMITTED",
    reviewPendingChairApproval: card.cycleStage === "REVIEW_SUBMITTED",
    reviewChangesRequested: card.cycleStage === "CHANGES_REQUESTED",
    lastActivityISO: null,
    sessions: sessionFactsFor(card.menteeId, sessions),
    goals: [],
    commitments: [],
    feedback: [],
    support: [],
  }));
}

/** Build the canonical view-model for a mentor home / roster surface. */
export function buildMentorHomeViewModel({
  viewerId,
  viewerName,
  isAdmin = false,
  cards,
  sessions,
  now,
}: {
  viewerId: string;
  viewerName: string;
  isAdmin?: boolean;
  cards: MentorHomeCardInput[];
  sessions: MentorHomeSessionInput[];
  now: Date;
}): MentorshipViewModel {
  const relationships = mentorCardsToFacts({
    viewerId,
    viewerName,
    cards,
    sessions,
  });
  return buildMentorshipViewModel(
    { viewer: { userId: viewerId, isAdmin, isChair: false }, relationships },
    now
  );
}
