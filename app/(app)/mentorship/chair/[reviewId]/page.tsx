import { notFound, redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import {
  ButtonLink,
  CardV2,
  PageHeaderV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";
import { getReviewForChair } from "@/lib/goal-review-actions";
import { projectAwardOutcome } from "@/lib/award-projection";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { AwardsSummaryPanel } from "@/components/mentorship/awards-summary-panel";
import { ReviewStateStrip } from "@/components/mentorship/review-state-strip";
import { formatEnum } from "@/lib/format-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import {
  getReviewHeadlineState,
  type ReviewStateTone,
} from "@/lib/mentorship-review-state";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import ChairActionsPanel from "./chair-actions-panel";

export const metadata = { title: "Approve review — Mentorship" };

/** GoalRatingColor → StatusBadge tone. */
const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

/** ReviewStateTone → StatusBadge tone. */
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 text-[13.5px] font-bold text-ink">{children}</h2>;
}

export default async function ChairReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;

  const review = await getReviewForChair(reviewId);
  if (!review) {
    // Either the review doesn't exist, or this user doesn't chair its lane.
    // Fall back to the inbox so the user sees a coherent next step.
    redirect("/mentorship/reviews");
  }

  // Preview what approval will trigger (read-only).
  const projection = await projectAwardOutcome({
    id: review.id,
    overallRating: review.overallRating,
    bonusPoints: review.bonusPoints,
    chairAdjustedBonusPoints: review.chairAdjustedBonusPoints,
    pointsAwarded: review.pointsAwarded,
    menteeId: review.menteeId,
    mentee: { primaryRole: review.mentee.primaryRole },
  });

  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
  const basePoints = menteeRoleType
    ? POINT_TABLE[review.overallRating][menteeRoleType]
    : 0;

  if (!menteeRoleType) {
    notFound();
  }

  const headlineState = getReviewHeadlineState({
    status: review.status,
    releasedToMenteeAt: review.releasedToMenteeAt,
    pointsAwarded: review.pointsAwarded,
  });

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Review cycle"
        title={`Approve review: ${review.mentee.name}`}
        subtitle={`Mentor ${review.mentor.name} · Cycle ${review.selfReflection.cycleNumber} · ${review.selfReflection.cycleMonth.toLocaleDateString(
          "en-US",
          { month: "long", year: "numeric" }
        )}`}
        backHref="/mentorship/reviews"
        backLabel="Review inbox"
        actions={
          <>
            <StatusBadge
              tone={STATE_TONE[headlineState.tone]}
              title={headlineState.description}
              withDot
            >
              {headlineState.label}
            </StatusBadge>
            <ButtonLink
              href={`/mentorship/people/${review.menteeId}`}
              variant="secondary"
              size="sm"
            >
              View development record →
            </ButtonLink>
          </>
        }
      />

      <CardV2 as="section" padding="md" className="grid gap-2 border-l-4 border-l-brand-600">
        <SectionTitle>Your decision</SectionTitle>
        <ul className="m-0 grid gap-1 pl-4 text-[13px] text-ink">
          <li>
            <strong>Approve</strong> → points/awards are calculated and the mentor&apos;s summary,
            ratings, and coaching plan are released to {review.mentee.name}.
          </li>
          <li>
            <strong>Request changes</strong> → it goes back to the mentor; nothing is released and no
            points are awarded yet.
          </li>
        </ul>
        <LearnMore summary="Privacy — what the mentee sees">
          <p className="m-0 text-[13px] leading-relaxed">
            This is <strong>{review.mentor.name}</strong>&apos;s review of{" "}
            <strong>{review.mentee.name}</strong> ({formatEnum(review.mentee.primaryRole)} lane),
            rated <strong>{ratingLabel(review.overallRating)}</strong>. The mentee never sees this
            approval screen, chair notes, or pre-release drafts — only the released summary once you
            approve.
          </p>
        </LearnMore>
      </CardV2>

      <LearnMore summary="Points & awards impact" hint="what approving will trigger">
        <AwardsSummaryPanel projection={projection} menteeName={review.mentee.name} />
      </LearnMore>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-4">
          <CardV2 as="section" padding="md">
            <SectionTitle>Overall rating</SectionTitle>
            {(() => {
              const cfg = getGoalRatingCopy(review.overallRating);
              return (
                <div className="mt-2 grid gap-1.5">
                  <StatusBadge
                    tone={RATING_TONE[review.overallRating] ?? "neutral"}
                    withDot
                    className="justify-self-start text-[13px]"
                  >
                    {cfg.shortLabel} — {cfg.label}
                  </StatusBadge>
                  <span className="text-[12.5px] text-ink-muted">{cfg.adminDescription}</span>
                </div>
              );
            })()}
            {review.overallComments && (
              <p className="m-0 mt-2.5 whitespace-pre-wrap text-[14px] text-ink">
                {review.overallComments}
              </p>
            )}
            {review.planOfAction && (
              <>
                <h3 className="m-0 mt-4 text-[13.5px] font-bold text-ink">Coaching plan</h3>
                <p className="m-0 mt-1.5 whitespace-pre-wrap text-[14px] text-ink">
                  {review.planOfAction}
                </p>
              </>
            )}
          </CardV2>

          {review.goalRatings.length > 0 && (
            <CardV2 as="section" padding="md">
              <SectionTitle>Per-goal ratings</SectionTitle>
              <div className="mt-2 flex flex-col gap-2.5">
                {review.goalRatings.map((gr) => (
                  <div key={gr.id} className="rounded-[10px] bg-surface-soft px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-semibold text-ink">
                        {gr.goal?.title ?? "(goal removed)"}
                      </span>
                      <StatusBadge tone={RATING_TONE[gr.rating] ?? "neutral"}>
                        {ratingLabel(gr.rating)}
                      </StatusBadge>
                    </div>
                    {gr.comments && (
                      <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                        {gr.comments}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardV2>
          )}

          {review.selfReflection.goalResponses.length > 0 && (
            <CardV2 as="section" padding="md">
              <SectionTitle>Mentee&apos;s self-input</SectionTitle>
              <div className="mt-2 flex flex-col gap-2.5">
                {review.selfReflection.goalResponses.map((gr) => (
                  <div key={gr.id}>
                    <div className="text-[13.5px] font-semibold text-ink">{gr.goal.title}</div>
                    {gr.progressMade && (
                      <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                        <strong>Progress:</strong> {gr.progressMade}
                      </p>
                    )}
                    {gr.accomplishments && (
                      <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                        <strong>Accomplishments:</strong> {gr.accomplishments}
                      </p>
                    )}
                    {gr.blockers && (
                      <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                        <strong>Blockers:</strong> {gr.blockers}
                      </p>
                    )}
                    {gr.nextMonthPlans && (
                      <p className="m-0 mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">
                        <strong>Next month:</strong> {gr.nextMonthPlans}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardV2>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <ChairActionsPanel
            reviewId={review.id}
            currentStatus={review.status}
            pointsToAward={basePoints + review.bonusPoints}
            menteeName={review.mentee.name ?? "the mentee"}
            bonusPoints={review.bonusPoints}
            bonusReason={review.bonusReason}
          />
          <ReviewStateStrip
            status={review.status}
            releasedToMenteeAt={review.releasedToMenteeAt}
            pointsAwarded={review.pointsAwarded}
          />
          <LearnMore summary="Rating scale you're approving against">
            <RatingLegend audience="admin" />
          </LearnMore>
        </div>
      </div>
    </div>
  );
}
