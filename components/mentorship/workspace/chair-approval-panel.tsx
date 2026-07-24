import { CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { getReviewForChair } from "@/lib/goal-review-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { formatEnum } from "@/lib/format-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getReviewHeadlineState, type ReviewStateTone } from "@/lib/mentorship-review-state";
import { prisma } from "@/lib/prisma";

import { ChairDecisionForm } from "./chair-decision-form";

/**
 * Chair approval on /people/[id]?panel=approve — one focused surface:
 * rating, mentor notes, decide. Auth: page gate + getReviewForChair().
 */

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

const STATE_TONE: Record<ReviewStateTone, StatusTone> = {
  neutral: "neutral",
  info: "info",
  pending: "warning",
  success: "success",
  warning: "danger",
};

function ratingLabel(rating: string): string {
  return getGoalRatingCopy(rating).label ?? formatEnum(rating);
}

export async function ChairApprovalPanel({
  menteeId,
  mentorshipId,
}: {
  menteeId: string;
  mentorshipId: string;
  /** Kept for callers; evidence lives on Feedback after release. */
  commitments?: unknown;
}) {
  const pending = await prisma.mentorGoalReview.findFirst({
    where: {
      menteeId,
      mentorshipId,
      status: { in: ["PENDING_CHAIR_APPROVAL", "CHANGES_REQUESTED"] },
    },
    orderBy: [{ cycleMonth: "desc" }, { createdAt: "desc" }],
    select: { id: true, status: true, chairComments: true },
  });

  if (!pending) {
    return (
      <CardV2 padding="md">
        <p className="m-0 text-[14px] text-ink-muted">Nothing waiting for approval.</p>
      </CardV2>
    );
  }

  if (pending.status === "CHANGES_REQUESTED") {
    return (
      <CardV2 padding="md" className="border-l-4 border-l-progress-700">
        <p className="m-0 text-[15px] font-semibold text-ink">Changes requested</p>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          Back with the mentor until they resubmit.
        </p>
        {pending.chairComments ? (
          <p className="m-0 mt-3 whitespace-pre-wrap text-[13px] text-ink">
            {pending.chairComments}
          </p>
        ) : null}
      </CardV2>
    );
  }

  const review = await getReviewForChair(pending.id);
  if (!review) return null;

  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
  if (!menteeRoleType) return null;

  const basePoints = POINT_TABLE[review.overallRating][menteeRoleType];
  const headlineState = getReviewHeadlineState({
    status: review.status,
    releasedToMenteeAt: review.releasedToMenteeAt,
    pointsAwarded: review.pointsAwarded,
  });
  const overallCopy = getGoalRatingCopy(review.overallRating);

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">
            Chair review
          </p>
          <h2 className="m-0 mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">
            {review.mentee.name}
          </h2>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            From {review.mentor.name} · {formatEnum(review.mentee.primaryRole)}
          </p>
        </div>
        <StatusBadge tone={STATE_TONE[headlineState.tone]} withDot>
          {headlineState.label}
        </StatusBadge>
      </header>

      <CardV2 padding="md" className="grid gap-3">
        <StatusBadge
          tone={RATING_TONE[review.overallRating] ?? "neutral"}
          withDot
          className="justify-self-start"
        >
          {overallCopy.shortLabel} — {overallCopy.label}
        </StatusBadge>
        {review.overallComments ? (
          <p className="m-0 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
            {review.overallComments}
          </p>
        ) : null}
        {review.planOfAction ? (
          <div className="border-t border-line-soft pt-3">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Coaching plan
            </p>
            <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {review.planOfAction}
            </p>
          </div>
        ) : null}
      </CardV2>

      {review.goalRatings.length > 0 ? (
        <div className="grid gap-2">
          {review.goalRatings.map((gr) => (
            <div
              key={gr.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-[12px] border border-line-soft px-3.5 py-2.5"
            >
              <span className="text-[13.5px] font-medium text-ink">
                {gr.grDocumentGoal?.title ?? gr.goal?.title ?? "(goal removed)"}
              </span>
              <StatusBadge tone={RATING_TONE[gr.rating] ?? "neutral"}>
                {ratingLabel(gr.rating)}
              </StatusBadge>
              {gr.comments ? (
                <p className="m-0 w-full whitespace-pre-wrap text-[13px] text-ink-muted">
                  {gr.comments}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <ChairDecisionForm
        reviewId={review.id}
        currentStatus={review.status}
        pointsToAward={basePoints + review.bonusPoints}
        menteeName={review.mentee.name ?? "the mentee"}
        bonusPoints={review.bonusPoints}
        bonusReason={review.bonusReason}
      />
    </section>
  );
}
