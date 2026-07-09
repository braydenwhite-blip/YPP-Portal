/**
 * Review-cycle stage derivation (pure, testable).
 *
 * A participant's stage is read straight off the existing review artifacts —
 * the cycle tables never duplicate review state, so the mentorship write
 * paths (submitSelfReflection, saveGoalReview, approveGoalReview) stay
 * completely unaware of cycles.
 */

import type { GoalReviewStatus } from "@prisma/client";

import { deriveReviewArtifactStage } from "@/lib/mentorship-cycle";

import {
  COMPLETED_STAGES,
  STAGE_META,
  type CycleKind,
  type ParticipantStage,
} from "./cycle-constants";

export type ParticipantArtifacts = {
  /** Active mentorship (as mentee) existed at launch or now. */
  hasMentorship: boolean;
  /** MonthlySelfReflection submitted for the cycle's period. */
  reflectionSubmitted: boolean;
  /** MentorGoalReview status for the period, null when none exists yet. */
  reviewStatus: GoalReviewStatus | null;
  /** Review released to the mentee (releasedToMenteeAt set). */
  releasedToMentee: boolean;
  /** Open mentorship-linked actions for this person. */
  openFollowUpCount: number;
  /** QuarterlyReview row exists for the cycle's quarter (quarterly kind). */
  quarterlyReviewExists: boolean;
  /** Manual override stored on the participant row ("waived"), else null. */
  stageOverride: string | null;
};

export function deriveParticipantStage(
  kind: CycleKind,
  a: ParticipantArtifacts
): ParticipantStage {
  if (a.stageOverride === "waived") return "waived";

  if (kind === "quarterly") {
    // Quarterly reviews are leadership-written — no self-input stage.
    if (!a.quarterlyReviewExists) return "waiting-review";
    return a.openFollowUpCount > 0 ? "follow-ups-open" : "released";
  }

  if (!a.hasMentorship) return "blocked-no-mentor";
  if (!a.reflectionSubmitted) return "waiting-self-input";

  // Delegate the actual stage decision to the one shared function also used
  // by computeCycleStage() (lib/mentorship-cycle.ts), then project its
  // 5-value vocabulary onto this cohort view's coarser bucket set.
  const artifactStage = deriveReviewArtifactStage({
    reflectionAwaitingReview: a.reviewStatus == null || a.reviewStatus === "DRAFT",
    reviewStatus: a.reviewStatus,
    releasedToMentee: a.releasedToMentee,
  });

  switch (artifactStage) {
    case "REFLECTION_DUE":
    case "REFLECTION_SUBMITTED":
    case "CHANGES_REQUESTED":
      // CHANGES_REQUESTED has no dedicated bucket in this coarser vocabulary —
      // it's bucketed with "the mentor needs to (re)write the review".
      return "waiting-review";
    case "REVIEW_SUBMITTED":
      // Covers PENDING_CHAIR_APPROVAL and APPROVED-but-not-yet-released —
      // both are in the chair's hands, still pre-release.
      return "ready-for-chair";
    case "APPROVED":
      return a.openFollowUpCount > 0 ? "follow-ups-open" : "released";
  }
}

export type CycleProgress = {
  counts: Record<ParticipantStage, number>;
  total: number;
  completed: number;
  /** 0–100, rounded; 100 for an empty cycle would be misleading — it is 0. */
  pctComplete: number;
  /** The most pressing stage present, for the cycle's headline chip. */
  headlineStage: ParticipantStage | null;
};

const STAGE_BY_ORDER = (Object.keys(STAGE_META) as ParticipantStage[]).sort(
  (x, y) => STAGE_META[x].order - STAGE_META[y].order
);

export function rollupCycleProgress(stages: ParticipantStage[]): CycleProgress {
  const counts = Object.fromEntries(
    STAGE_BY_ORDER.map((s) => [s, 0])
  ) as Record<ParticipantStage, number>;
  for (const stage of stages) counts[stage] += 1;

  const total = stages.length;
  const completed = stages.filter((s) => COMPLETED_STAGES.includes(s)).length;
  const pctComplete = total === 0 ? 0 : Math.round((completed / total) * 100);

  const headlineStage =
    STAGE_BY_ORDER.find((s) => !COMPLETED_STAGES.includes(s) && counts[s] > 0) ??
    STAGE_BY_ORDER.find((s) => counts[s] > 0) ??
    null;

  return { counts, total, completed, pctComplete, headlineStage };
}
