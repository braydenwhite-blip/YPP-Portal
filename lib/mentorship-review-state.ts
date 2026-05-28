import type { GoalReviewStatus } from "@prisma/client";

/**
 * Shared, presentation-agnostic mapping of a mentor goal review's lifecycle so
 * every chair/admin surface describes approval state, release state, and point
 * consequences with identical language. Pure + unit-testable — no IO here.
 *
 * The underlying state machine is unchanged (see `GoalReviewStatus`):
 *   DRAFT → PENDING_CHAIR_APPROVAL → (APPROVED | CHANGES_REQUESTED)
 * On APPROVED the review is released to the mentee and points are awarded.
 */

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

  if (status === "DRAFT") {
    return {
      key: "draft",
      label: "Draft",
      tone: "neutral",
      description: "The mentor is still writing this review. Nothing is waiting on you yet.",
    };
  }
  if (status === "CHANGES_REQUESTED") {
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
  // PENDING_CHAIR_APPROVAL (submitted) is the default actionable state.
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
