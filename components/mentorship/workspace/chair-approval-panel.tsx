import { CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { getReviewForChair, loadChairPacket } from "@/lib/goal-review-actions";
import { projectAwardOutcome } from "@/lib/award-projection";
import { toMenteeRoleType } from "@/lib/mentee-role-utils";
import { POINT_TABLE } from "@/lib/mentorship-point-table";
import { AwardsSummaryPanel } from "@/components/mentorship/awards-summary-panel";
import { ReviewStateStrip } from "@/components/mentorship/review-state-strip";
import { formatEnum } from "@/lib/format-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getReviewHeadlineState, type ReviewStateTone } from "@/lib/mentorship-review-state";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { LearnMore } from "@/components/mentorship/learn-more";
import { prisma } from "@/lib/prisma";
import type { WorkspaceCommitment } from "@/lib/mentorship/workspace";
import { getCurrentGRSummary } from "@/lib/gr-actions";
import { CurrentGRCard } from "@/components/people-strategy/current-gr-card";

import { ChairDecisionForm } from "./chair-decision-form";
import { LinkedWorkEvidence } from "./linked-work-evidence";

/**
 * The chair's approval step, inline on /people/[id] (?panel=approve) — the
 * full read view of the mentor's submitted review plus the approve /
 * request-changes decision, in the same place every other step of the loop
 * lives. Auth is enforced twice: the page gates on capabilities.canApprove,
 * and getReviewForChair() re-checks lane-chair/admin authority server-side
 * (returns null otherwise, so this panel self-hides rather than leaking).
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="m-0 text-[13.5px] font-bold text-ink">{children}</h2>;
}

export async function ChairApprovalPanel({
  menteeId,
  mentorshipId,
  commitments = [],
}: {
  menteeId: string;
  mentorshipId: string;
  commitments?: WorkspaceCommitment[];
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
        <p className="m-0 text-[13px] text-ink-muted">
          Nothing is waiting for approval right now.
        </p>
      </CardV2>
    );
  }

  if (pending.status === "CHANGES_REQUESTED") {
    return (
      <CardV2 padding="md" className="border-l-4 border-l-progress-700">
        <strong className="text-[14px] text-ink">Changes requested — back with the mentor</strong>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">
          The Monthly Progress Update returns here once the mentor resubmits it.
        </p>
        {pending.chairComments ? (
          <p className="m-0 mt-2 whitespace-pre-wrap text-[13px] text-ink">
            Your notes: {pending.chairComments}
          </p>
        ) : null}
      </CardV2>
    );
  }

  const [review, packet, currentGR] = await Promise.all([
    getReviewForChair(pending.id),
    loadChairPacket(pending.id),
    getCurrentGRSummary(menteeId),
  ]);
  if (!review) {
    // The viewer doesn't chair this review's lane (getReviewForChair
    // re-checked) — render nothing rather than a broken decision surface.
    return null;
  }

  const menteeRoleType = toMenteeRoleType(review.mentee.primaryRole);
  if (!menteeRoleType) return null;

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
  const basePoints = POINT_TABLE[review.overallRating][menteeRoleType];

  const headlineState = getReviewHeadlineState({
    status: review.status,
    releasedToMenteeAt: review.releasedToMenteeAt,
    pointsAwarded: review.pointsAwarded,
  });
  const nextMonthDrafts = Array.isArray(review.nextMonthGoalDraftsJson)
    ? review.nextMonthGoalDraftsJson.filter(
        (item): item is { title: string; description?: string } =>
          typeof item === "object" &&
          item !== null &&
          "title" in item &&
          typeof item.title === "string"
      )
    : [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-[15px] font-bold text-ink">
          Share {review.mentee.name}&apos;s feedback
        </h3>
        <StatusBadge tone={STATE_TONE[headlineState.tone]} title={headlineState.description} withDot>
          {headlineState.label}
        </StatusBadge>
      </div>

      <CardV2 as="section" padding="md" className="grid gap-2 border-l-4 border-l-brand-600">
        <SectionTitle>Your decision</SectionTitle>
        <ul className="m-0 grid gap-1 pl-4 text-[13px] text-ink">
          <li>
            <strong>Approve</strong> → {review.mentee.name} sees the feedback.
          </li>
          <li>
            <strong>Request changes</strong> → send it back to the mentor.
          </li>
        </ul>
        <LearnMore summary="Privacy — what the mentee sees">
          <p className="m-0 text-[13px] leading-relaxed">
            This is <strong>{review.mentor.name}</strong>&apos;s Monthly Progress Update for{" "}
            <strong>{review.mentee.name}</strong> ({formatEnum(review.mentee.primaryRole)} lane),
            rated <strong>{ratingLabel(review.overallRating)}</strong>. The mentee never sees this
            approval panel, chair notes, or pre-release drafts — only the released summary once you
            approve.
          </p>
        </LearnMore>
      </CardV2>

      {packet ? (
        <CardV2 as="section" padding="md" className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle>Decision check</SectionTitle>
            <StatusBadge tone={packet.isComplete ? "success" : "danger"}>
              {packet.isComplete ? "Ready for decision" : "Missing information"}
            </StatusBadge>
          </div>
          <div className="grid gap-2 text-[12.5px] text-ink-muted sm:grid-cols-3">
            <span>
              <strong className="text-ink">Prior rating:</strong>{" "}
              {packet.priorOverallRating ? ratingLabel(packet.priorOverallRating) : "First cycle"}
            </span>
            <span>
              <strong className="text-ink">AI assistance:</strong>{" "}
              {packet.aiDraftUsed ? "Used and mentor-reviewed" : "Not used"}
            </span>
            <span>
              <strong className="text-ink">Requested feedback:</strong>{" "}
              {packet.commentStatus.submitted}/{packet.commentStatus.requested} received
            </span>
          </div>
          {packet.incompleteReasons.length > 0 ? (
            <ul className="m-0 grid gap-1 pl-5 text-[12.5px] text-danger-700">
              {packet.incompleteReasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          ) : null}
          {packet.goalRatings.some((rating) => rating.ratingChanged) ? (
            <div>
              <p className="m-0 text-[12px] font-bold uppercase tracking-[0.05em] text-ink-muted">
                Meaningful rating changes
              </p>
              <ul className="m-0 mt-1 grid gap-1 pl-5 text-[12.5px] text-ink">
                {packet.goalRatings
                  .filter((rating) => rating.ratingChanged)
                  .map((rating) => (
                    <li key={rating.id}>
                      {rating.title}: {ratingLabel(rating.priorRating!)} → {ratingLabel(rating.rating)}
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
        </CardV2>
      ) : null}

      {currentGR ? (
        <LearnMore summary="Current Goals & Responsibilities" hint="the plan this update evaluates">
          <CurrentGRCard summary={currentGR} personName={review.mentee.name} />
        </LearnMore>
      ) : null}

      {review.selfReflection.mentorCycleCheckIn ? (
        <LearnMore summary="Meeting note" hint="what they talked about">
          <div className="grid gap-2 text-[13px] text-ink">
            {review.selfReflection.mentorCycleCheckIn.discussion ? (
              <p className="m-0 whitespace-pre-wrap">
                {review.selfReflection.mentorCycleCheckIn.discussion}
              </p>
            ) : null}
            {review.selfReflection.mentorCycleCheckIn.decisions ? (
              <p className="m-0 whitespace-pre-wrap">
                <strong>Decisions:</strong> {review.selfReflection.mentorCycleCheckIn.decisions}
              </p>
            ) : null}
            {review.selfReflection.mentorCycleCheckIn.commitments ? (
              <p className="m-0 whitespace-pre-wrap">
                <strong>Commitments:</strong> {review.selfReflection.mentorCycleCheckIn.commitments}
              </p>
            ) : null}
          </div>
        </LearnMore>
      ) : null}

      {nextMonthDrafts.length > 0 ? (
        <LearnMore summary="Proposed next-month plan" hint={`${nextMonthDrafts.length} goal proposal${nextMonthDrafts.length === 1 ? "" : "s"}`}>
          <ul className="m-0 grid gap-2 pl-5 text-[13px] text-ink">
            {nextMonthDrafts.map((draft, index) => (
              <li key={`${draft.title}-${index}`}>
                <strong>{draft.title}</strong>
                {draft.description ? ` — ${draft.description}` : ""}
              </li>
            ))}
          </ul>
        </LearnMore>
      ) : null}

      <LearnMore summary="Points & awards impact" hint="what approving will trigger">
        <AwardsSummaryPanel projection={projection} menteeName={review.mentee.name} />
      </LearnMore>

      <LinkedWorkEvidence menteeId={menteeId} commitments={commitments} />

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
                      {gr.grDocumentGoal?.title ?? gr.goal?.title ?? "(goal removed)"}
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
          <ChairDecisionForm
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
    </section>
  );
}
