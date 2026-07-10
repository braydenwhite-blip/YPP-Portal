import Link from "next/link";

import { CardV2, StatusBadge, type StatusTone } from "@/components/ui-v2";
import { formatEnum } from "@/lib/format-utils";
import { getChairQueue } from "@/lib/goal-review-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getReviewHeadlineState, type ReviewStateTone } from "@/lib/mentorship-review-state";
import {
  loadQuarterlyCommitteeQueue,
  scopeQuarterlyQueueForViewer,
} from "@/lib/mentorship/quarterly-review";
import type { MenteeRoleType, MentorshipProgramGroup } from "@prisma/client";

/**
 * The approval queues, folded into the Mentorship home — "who needs me and
 * why" lives on one page instead of separate Review Inbox / Committee Queue
 * destinations. Both sections render nothing when empty and every row
 * deep-links straight into the matching inline step on /people/[id].
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

const QUARTERLY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_CHAIR_APPROVAL: "Pending committee approval",
  CHANGES_REQUESTED: "Changes requested",
  PENDING_BOARD_APPROVAL: "Pending Board approval",
};

const QUARTERLY_STATUS_TONE: Record<string, StatusTone> = {
  DRAFT: "neutral",
  PENDING_CHAIR_APPROVAL: "warning",
  CHANGES_REQUESTED: "danger",
  PENDING_BOARD_APPROVAL: "brand",
};

function ratingLabel(rating: string): string {
  return getGoalRatingCopy(rating).label ?? formatEnum(rating);
}

/** Monthly reviews waiting on the viewer's chair approval. */
export async function MonthlyApprovalQueue() {
  // getChairQueue() authorizes internally — non-chairs get an empty list.
  const reviews = (await getChairQueue()) ?? [];
  if (reviews.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-[16px] font-bold text-ink">
          Waiting on your approval ({reviews.length})
        </h2>
        <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
          Approving releases the review to the mentee and awards points; returning it sends it back
          to the mentor.
        </p>
      </div>
      {reviews.map((review) => {
        const state = getReviewHeadlineState({ status: review.status });
        return (
          <Link
            key={review.id}
            href={`/mentorship/people/${review.menteeId}?section=reviews&panel=approve`}
            className="group no-underline"
          >
            <CardV2
              as="article"
              padding="md"
              className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-brand-600 transition-shadow group-hover:shadow-overlay"
            >
              <div className="min-w-[260px] flex-1">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-[15px] font-bold text-ink">{review.menteeName}</span>
                  <StatusBadge tone="neutral">{formatEnum(review.menteeRole ?? "")}</StatusBadge>
                  {review.isQuarterly && <StatusBadge tone="brand">Quarterly</StatusBadge>}
                </div>
                <p className="m-0 text-[13px] text-ink-muted">
                  Mentor: {review.mentorName} &middot; Cycle {review.cycleNumber} &middot;{" "}
                  {new Date(review.cycleMonth).toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <StatusBadge tone={RATING_TONE[review.overallRating] ?? "neutral"}>
                  {ratingLabel(review.overallRating)}
                </StatusBadge>
                <StatusBadge tone={STATE_TONE[state.tone]} title={state.description}>
                  {state.label}
                </StatusBadge>
                <span className="text-[13px] text-ink-muted">
                  Submitted {new Date(review.submittedAt).toLocaleDateString()}
                </span>
                <span
                  aria-hidden
                  className="text-[18px] text-ink-muted transition-colors group-hover:text-brand-700"
                >
                  &rsaquo;
                </span>
              </div>
            </CardV2>
          </Link>
        );
      })}
    </section>
  );
}

/** Everyone due for (or mid-) quarterly committee review, viewer-scoped. */
export async function QuarterlyCommitteeQueue({
  viewerId,
  isAdminOrLeadership,
  chairedLanes,
  committeeProgramGroups = [],
}: {
  viewerId: string;
  isAdminOrLeadership: boolean;
  chairedLanes: MenteeRoleType[];
  committeeProgramGroups?: MentorshipProgramGroup[];
}) {
  const allDue = await loadQuarterlyCommitteeQueue();
  const visible = scopeQuarterlyQueueForViewer(allDue, {
    viewerId,
    isAdminOrLeadership,
    chairedLanes,
    committeeProgramGroups,
  });
  if (visible.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="m-0 text-[16px] font-bold text-ink">
          Quarterly committee reviews due ({visible.length})
        </h2>
        <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
          Every third cycle the Role Committee reviews the last three months and may record a
          Pathway Decision — the packet lives on each person&apos;s page.
        </p>
      </div>
      {visible.map((entry) => (
        <Link
          key={entry.mentorshipId}
          href={`/mentorship/people/${entry.menteeId}?section=reviews`}
          className="group no-underline"
        >
          <CardV2
            as="article"
            padding="md"
            className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-brand-600 transition-shadow group-hover:shadow-overlay"
          >
            <div className="min-w-[260px] flex-1">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-bold text-ink">{entry.menteeName}</span>
                {entry.menteeRole && (
                  <StatusBadge tone="neutral">{entry.menteeRole.replace(/_/g, " ")}</StatusBadge>
                )}
              </div>
              <p className="m-0 text-[13px] text-ink-muted">
                Mentor: {entry.mentorName ?? "Unassigned"} &middot; {entry.quarter}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <StatusBadge tone={entry.status ? QUARTERLY_STATUS_TONE[entry.status] : "warning"}>
                {entry.status ? QUARTERLY_STATUS_LABEL[entry.status] : "Not started"}
              </StatusBadge>
              <span
                aria-hidden
                className="text-[18px] text-ink-muted transition-colors group-hover:text-brand-700"
              >
                &rsaquo;
              </span>
            </div>
          </CardV2>
        </Link>
      ))}
    </section>
  );
}
