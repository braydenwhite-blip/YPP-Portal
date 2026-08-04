import Link from "next/link";

import { ButtonLink, CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { ChairDecisionForm } from "@/components/mentorship/workspace/chair-decision-form";
import { formatEnum } from "@/lib/format-utils";
import {
  getReviewForChair,
  loadChairPacket,
} from "@/lib/goal-review-actions";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { unpackProgressNarrative } from "@/lib/mentorship/monthly-progress-update-shared";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import {
  getReviewHeadlineState,
  type ReviewStateTone,
} from "@/lib/mentorship-review-state";

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

/**
 * Dedicated chair review page — full packet + approve / request-changes.
 */
export async function ChairReviewDetail({ reviewId }: { reviewId: string }) {
  const [review, packet] = await Promise.all([
    getReviewForChair(reviewId),
    loadChairPacket(reviewId),
  ]);

  if (!review) {
    return (
      <div className={`${skin.portalSkin} mx-auto flex w-full max-w-3xl flex-col gap-4`}>
        <CardV2 padding="md">
          <p className="m-0 text-[15px] font-semibold text-ink">Review not available</p>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            This review may have been approved already, or you don&apos;t have
            chair access for this role lane.
          </p>
          <div className="mt-4">
            <ButtonLink href="/mentorship/chair" variant="secondary" size="sm">
              Back to queue
            </ButtonLink>
          </div>
        </CardV2>
      </div>
    );
  }

  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
  const basePoints = menteeRoleType
    ? POINT_TABLE[review.overallRating][menteeRoleType]
    : 0;
  const headlineState = getReviewHeadlineState({
    status: review.status,
    releasedToMenteeAt: review.releasedToMenteeAt,
    pointsAwarded: review.pointsAwarded,
  });
  const overallCopy = getGoalRatingCopy(review.overallRating);
  const narrative = unpackProgressNarrative(review.overallComments);
  const cycleLabel =
    packet?.cycleLabel ??
    review.cycleMonth.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const pdfHref = `/mentorship/people/${review.menteeId}/monthly-update/print?reviewId=${encodeURIComponent(review.id)}`;

  return (
    <div className={`${skin.portalSkin} mx-auto flex w-full max-w-3xl flex-col gap-5`}>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <Link
          href="/mentorship/chair"
          className="font-medium text-brand-700 no-underline hover:underline"
        >
          ← Review Approvals
        </Link>
        <span className="text-ink-muted">·</span>
        <Link
          href={`/mentorship/people/${review.menteeId}?section=progress`}
          className="text-ink-muted no-underline hover:text-ink hover:underline"
        >
          Open mentee workspace
        </Link>
      </div>

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">
            Chair review · {cycleLabel}
            {packet?.isQuarterly ? " · Quarterly" : ""}
          </p>
          <h1 className="m-0 mt-1 text-[26px] font-bold tracking-[-0.03em] text-[#2e1065]">
            {review.mentee.name}
          </h1>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            From {review.mentor.name}
            {review.mentee.primaryRole
              ? ` · ${formatEnum(review.mentee.primaryRole)}`
              : ""}
            {review.columnLabel ? ` · ${review.columnLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={STATE_TONE[headlineState.tone]} withDot>
            {headlineState.label}
          </StatusBadge>
          <ButtonLink href={pdfHref} variant="secondary" size="sm">
            View PDF
          </ButtonLink>
        </div>
      </header>

      {packet && !packet.isComplete ? (
        <CardV2 padding="md" className="border-l-4 border-l-progress-700">
          <p className="m-0 text-[14px] font-semibold text-ink">Packet incomplete</p>
          <ul className="m-0 mt-2 list-disc space-y-1 pl-4 text-[13px] text-ink-muted">
            {packet.incompleteReasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </CardV2>
      ) : null}

      {(packet?.priorOverallRating ||
        packet?.aiDraftUsed ||
        (packet?.commentStatus.requested ?? 0) > 0) && (
        <div className="grid gap-2 sm:grid-cols-3">
          {packet?.priorOverallRating ? (
            <MetaChip
              label="Prior overall"
              value={`${ratingLabel(packet.priorOverallRating)} → ${overallCopy.label}`}
            />
          ) : (
            <MetaChip label="Prior overall" value="First released review" />
          )}
          <MetaChip
            label="AI draft"
            value={packet?.aiDraftUsed ? "Mentor used AI assist" : "No AI flag"}
          />
          <MetaChip
            label="Colleague notes"
            value={
              packet && packet.commentStatus.requested > 0
                ? `${packet.commentStatus.submitted}/${packet.commentStatus.requested}${
                    packet.commentStatus.overdue > 0
                      ? ` · ${packet.commentStatus.overdue} overdue`
                      : ""
                  }`
                : "None requested"
            }
          />
        </div>
      )}

      <CardV2 padding="md" className="grid gap-3">
        <StatusBadge
          tone={RATING_TONE[review.overallRating] ?? "neutral"}
          withDot
          className="justify-self-start"
        >
          {overallCopy.label}
        </StatusBadge>
        {narrative.overallComments ? (
          <div>
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Overall comments
            </p>
            <p className="m-0 mt-1.5 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
              {narrative.overallComments}
            </p>
          </div>
        ) : null}
        {narrative.strengths ? (
          <div className="border-t border-line-soft pt-3">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Strengths
            </p>
            <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {narrative.strengths}
            </p>
          </div>
        ) : null}
        {narrative.areasForDevelopment ? (
          <div className="border-t border-line-soft pt-3">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Areas for development
            </p>
            <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {narrative.areasForDevelopment}
            </p>
          </div>
        ) : null}
        {review.planOfAction ? (
          <div className="border-t border-line-soft pt-3">
            <p className="m-0 text-[12px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
              Plan of action
            </p>
            <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {review.planOfAction}
            </p>
          </div>
        ) : null}
      </CardV2>

      {(packet?.goalRatings.length || review.goalRatings.length) > 0 ? (
        <section className="grid gap-2">
          <h2 className="m-0 text-[14px] font-semibold text-ink">Competency ratings</h2>
          {(packet?.goalRatings.length
            ? packet.goalRatings.map((gr) => ({
                id: gr.id,
                title: gr.title,
                rating: gr.rating,
                comments: gr.comments,
                priorRating: gr.priorRating,
                ratingChanged: gr.ratingChanged,
              }))
            : review.goalRatings.map((gr) => ({
                id: gr.id,
                title:
                  gr.grDocumentGoal?.title ?? gr.goal?.title ?? "(goal removed)",
                rating: gr.rating,
                comments: gr.comments,
                priorRating: null as string | null,
                ratingChanged: false,
              }))
          ).map((gr) => (
            <div
              key={gr.id}
              className="rounded-[12px] border border-line-soft px-3.5 py-2.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-[13.5px] font-medium text-ink">{gr.title}</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {gr.priorRating && gr.ratingChanged ? (
                    <span className="text-[11.5px] text-ink-muted">
                      was {ratingLabel(gr.priorRating)} →
                    </span>
                  ) : null}
                  <StatusBadge tone={RATING_TONE[gr.rating] ?? "neutral"}>
                    {ratingLabel(gr.rating)}
                  </StatusBadge>
                </div>
              </div>
              {gr.comments ? (
                <p className="m-0 mt-1.5 whitespace-pre-wrap text-[13px] text-ink-muted">
                  {gr.comments}
                </p>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {review.status === "CHANGES_REQUESTED" ? (
        <CardV2 padding="md" className="border-l-4 border-l-progress-700">
          <p className="m-0 text-[15px] font-semibold text-ink">Changes requested</p>
          <p className="m-0 mt-1 text-[13px] text-ink-muted">
            Back with the mentor until they resubmit.
          </p>
          {review.chairComments ? (
            <p className="m-0 mt-3 whitespace-pre-wrap text-[13px] text-ink">
              {review.chairComments}
            </p>
          ) : null}
        </CardV2>
      ) : (
        <ChairDecisionForm
          reviewId={review.id}
          currentStatus={review.status}
          pointsToAward={basePoints + review.bonusPoints}
          menteeName={review.mentee.name ?? "the mentee"}
          bonusPoints={review.bonusPoints}
          bonusReason={review.bonusReason}
          afterSuccessHref="/mentorship/chair"
        />
      )}
    </div>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-line-soft bg-white px-3.5 py-2.5">
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
        {label}
      </p>
      <p className="m-0 mt-1 text-[13px] font-medium text-ink">{value}</p>
    </div>
  );
}
