import type { ReviewCycleState } from "@prisma/client";

/**
 * Leadership Development — review cycle access predicates (pure).
 *
 * One place that decides who may see and do what on a review cycle, so the
 * confidentiality rules are testable without a database:
 *
 * - Cycle MANAGERS (the assigned reviewer, the creator, or leadership) see the
 *   full workspace: self-input, every feedback body, contributor identities,
 *   synthesis including concerns and coaching notes.
 * - The REVIEWEE sees only their own self-input form plus — after release —
 *   the released summary (strengths / growth areas / recommended next step /
 *   follow-up date). Concerns, coaching notes, feedback bodies, and
 *   contributor identities are NEVER reviewee-visible.
 * - A feedback CONTRIBUTOR sees only their own request and answers.
 *
 * The server actions/loaders in cycle-actions.ts / cycle-load.ts enforce these
 * (they never rely on the UI to hide fields).
 */

export type CycleAccessViewer = {
  id: string;
  /** Result of the caller's leadership check (requireLeadership-equivalent). */
  isLeadership: boolean;
};

export type CycleAccessCycle = {
  revieweeId: string;
  reviewerId: string;
  createdById: string;
  state: ReviewCycleState;
  releasedToRevieweeAt: Date | null;
};

/** Reviewer, creator, or leadership — may run the cycle and read everything. */
export function isCycleManager(
  viewer: CycleAccessViewer,
  cycle: Pick<CycleAccessCycle, "reviewerId" | "createdById">
): boolean {
  return (
    viewer.isLeadership ||
    viewer.id === cycle.reviewerId ||
    viewer.id === cycle.createdById
  );
}

/** The reviewee may submit/edit self-input only while input is being collected. */
export function canSubmitSelfInput(
  viewerId: string,
  cycle: Pick<CycleAccessCycle, "revieweeId" | "state">
): boolean {
  return viewerId === cycle.revieweeId && cycle.state === "COLLECTING";
}

/**
 * A contributor may submit (or revise) their own feedback while the cycle is
 * collecting. Once the reviewer moves on to synthesis, input is closed.
 */
export function canSubmitCycleFeedback(
  viewerId: string,
  feedback: { contributorId: string },
  cycleState: ReviewCycleState
): boolean {
  return viewerId === feedback.contributorId && cycleState === "COLLECTING";
}

export type RevieweeReleasedSummary = {
  strengths: string | null;
  growthAreas: string | null;
  recommendedNextStep: string | null;
  followUpDueAt: Date | null;
  releasedAt: Date;
};

/**
 * The ONLY synthesis projection a reviewee may receive — and only after
 * release. Concerns and coaching notes are structurally excluded here so a
 * loader can't leak them by accident.
 */
export function revieweeReleasedSummary(cycle: {
  revieweeId: string;
  releasedToRevieweeAt: Date | null;
  strengths: string | null;
  growthAreas: string | null;
  recommendedNextStep: string | null;
  followUpDueAt: Date | null;
}): RevieweeReleasedSummary | null {
  if (!cycle.releasedToRevieweeAt) return null;
  return {
    strengths: cycle.strengths,
    growthAreas: cycle.growthAreas,
    recommendedNextStep: cycle.recommendedNextStep,
    followUpDueAt: cycle.followUpDueAt,
    releasedAt: cycle.releasedToRevieweeAt,
  };
}
