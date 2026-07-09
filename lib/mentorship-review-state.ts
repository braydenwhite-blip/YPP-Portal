import type { GoalReviewStatus } from "@prisma/client";
import { deriveReviewArtifactStage, type ReviewArtifactStage } from "@/lib/mentorship-cycle";

/**
 * Shared, presentation-agnostic mapping of a mentor goal review's lifecycle so
 * every chair/admin surface describes approval state, release state, and point
 * consequences with identical language. Pure + unit-testable — no IO here.
 *
 * Stage determination itself is NOT re-derived here — it delegates to
 * `deriveReviewArtifactStage()` (lib/mentorship-cycle.ts), the same primitive
 * `deriveCycleState()`/`buildCycleStrip()` use for `/people/[id]`. This module
 * only owns the list/queue-specific label and tone copy on top of that shared
 * stage, so the chair queue and the canonical person page can never disagree
 * about *what stage a review is in* — only how they word it.
 */

function stageFromInput(input: ReviewStateInput): ReviewArtifactStage {
  const status = String(input.status) as GoalReviewStatus | "DRAFT";
  return deriveReviewArtifactStage({
    // A MentorGoalReview row only exists once a reflection has been
    // submitted, so DRAFT (mentor is still writing) is the one status not
    // explicitly branched in deriveReviewArtifactStage — it needs
    // reflectionAwaitingReview: true to resolve to REFLECTION_SUBMITTED.
    reflectionAwaitingReview: status === "DRAFT",
    reviewStatus: status === "DRAFT" ? null : (status as GoalReviewStatus),
    releasedToMentee: Boolean(input.releasedToMenteeAt),
  });
}

export type ReviewStateTone =
  | "neutral"
  | "info"
  | "pending"
  | "success"
  | "warning";

export interface ReviewStateChip {
  key: string;
  label: string;
  tone: ReviewStateTone;
  description: string;
  /** Whether this stage has been reached/completed. */
  done: boolean;
}

export interface ReviewStateInput {
  status: GoalReviewStatus | string;
  releasedToMenteeAt?: Date | string | null;
  pointsAwarded?: number | null;
}

const TONE_PALETTE: Record<ReviewStateTone, { color: string; background: string }> = {
  neutral: { color: "#475569", background: "#f1f5f9" },
  info: { color: "#1d4ed8", background: "#eff6ff" },
  pending: { color: "#b45309", background: "#fef3c7" },
  success: { color: "#15803d", background: "#dcfce7" },
  warning: { color: "#c2410c", background: "#fff7ed" },
};

export function getReviewStateTonePalette(tone: ReviewStateTone) {
  return TONE_PALETTE[tone];
}

/**
 * The single headline state for a review — what a chair sees at a glance.
 */
export function getReviewHeadlineState(input: ReviewStateInput): {
  key: string;
  label: string;
  tone: ReviewStateTone;
  description: string;
} {
  const status = String(input.status);
  const released = Boolean(input.releasedToMenteeAt);
  const stage = stageFromInput(input);

  if (stage === "REFLECTION_SUBMITTED") {
    return {
      key: "draft",
      label: "Draft",
      tone: "neutral",
      description: "The mentor is still writing this review. Nothing is waiting on you yet.",
    };
  }
  if (stage === "CHANGES_REQUESTED") {
    return {
      key: "changes-requested",
      label: "Changes requested",
      tone: "warning",
      description:
        "Returned to the mentor for revisions. It stays private and unscored until resubmitted and approved.",
    };
  }
  if (status === "APPROVED") {
    return {
      key: "approved",
      label: released ? "Approved & released" : "Approved",
      tone: "success",
      description: released
        ? "Approved by the chair, released to the mentee, and points are confirmed."
        : "Approved by the chair. Feedback and points are being finalized.",
    };
  }
  // REVIEW_SUBMITTED (PENDING_CHAIR_APPROVAL) is the default actionable state.
  return {
    key: "pending-chair",
    label: "Pending chair approval",
    tone: "pending",
    description:
      "Submitted by the mentor and waiting on your decision. Feedback and points are held until you approve.",
  };
}

/**
 * The full approval pipeline as ordered chips, each with a `done` flag, so a
 * surface can render a clear "where is this review" strip:
 *   Submitted → Chair decision → Released to mentee → Points
 */
export function getReviewStateChips(input: ReviewStateInput): ReviewStateChip[] {
  const status = String(input.status);
  const released = Boolean(input.releasedToMenteeAt);
  const pointsConfirmed = status === "APPROVED" && (input.pointsAwarded ?? 0) > 0;
  const isApproved = status === "APPROVED";
  const isChangesRequested = status === "CHANGES_REQUESTED";
  const reachedChair = status !== "DRAFT";

  const submitted: ReviewStateChip = {
    key: "submitted",
    label: reachedChair ? "Submitted" : "Draft",
    tone: reachedChair ? "info" : "neutral",
    description: reachedChair
      ? "The mentor has submitted this review for chair approval."
      : "The mentor is still drafting this review.",
    done: reachedChair,
  };

  const chairDecision: ReviewStateChip = isApproved
    ? {
        key: "chair-decision",
        label: "Chair approved",
        tone: "success",
        description: "You approved this review.",
        done: true,
      }
    : isChangesRequested
    ? {
        key: "chair-decision",
        label: "Changes requested",
        tone: "warning",
        description: "Returned to the mentor for revisions; nothing is released yet.",
        done: false,
      }
    : {
        key: "chair-decision",
        label: "Pending chair approval",
        tone: "pending",
        description: "Waiting on your approve / request-changes decision.",
        done: false,
      };

  const release: ReviewStateChip = {
    key: "released",
    label: released ? "Released to mentee" : "Not yet released",
    tone: released ? "success" : "pending",
    description: released
      ? "The mentee can now see the mentor's summary, ratings, and plan of action."
      : "The mentee sees nothing until you approve. Drafts and chair notes stay private.",
    done: released,
  };

  const points: ReviewStateChip = {
    key: "points",
    label: pointsConfirmed ? "Points confirmed" : "Points pending",
    tone: pointsConfirmed ? "success" : "pending",
    description: pointsConfirmed
      ? `${input.pointsAwarded} achievement points were confirmed on approval.`
      : "Achievement points are calculated and confirmed only when you approve.",
    done: pointsConfirmed,
  };

  return [submitted, chairDecision, release, points];
}
