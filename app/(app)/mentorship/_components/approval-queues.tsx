import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/ui-v2";
import { formatEnum } from "@/lib/format-utils";
import { getChairQueue } from "@/lib/goal-review-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import {
  loadQuarterlyCommitteeQueue,
  scopeQuarterlyQueueForViewer,
} from "@/lib/mentorship/quarterly-review";
import type { MenteeRoleType, MentorshipProgramGroup } from "@prisma/client";

/**
 * Approval queues on Mentorship home — compact rows, deep-link to the person.
 * Self-hide when empty.
 */

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

const QUARTERLY_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_CHAIR_APPROVAL: "Needs committee",
  CHANGES_REQUESTED: "Changes requested",
  PENDING_BOARD_APPROVAL: "Needs board",
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

function monthLabel(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

/** Monthly reviews waiting on the viewer's chair approval. */
export async function MonthlyApprovalQueue() {
  const reviews = (await getChairQueue()) ?? [];
  if (reviews.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className="border-b border-line-soft px-5 py-4">
        <h2 className="m-0 text-[15px] font-semibold text-ink">
          Approve reviews
          <span className="ml-2 font-normal text-ink-muted">{reviews.length}</span>
        </h2>
        <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
          Release feedback to the mentee, or send it back.
        </p>
      </div>
      <ul className="m-0 list-none divide-y divide-line-soft p-0">
        {reviews.map((review) => (
          <li key={review.id}>
            <Link
              href={`/mentorship/people/${review.menteeId}?section=reviews&panel=approve`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 no-underline transition-colors hover:bg-surface-soft"
            >
              <div className="min-w-0">
                <p className="m-0 text-[14.5px] font-semibold text-ink">{review.menteeName}</p>
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                  {review.mentorName} · {monthLabel(review.cycleMonth)}
                  {review.isQuarterly ? " · Quarterly" : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={RATING_TONE[review.overallRating] ?? "neutral"}>
                  {ratingLabel(review.overallRating)}
                </StatusBadge>
                <span className="text-[16px] text-ink-muted" aria-hidden>
                  →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Quarterly committee reviews due for this viewer. */
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
    <section className="overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className="border-b border-line-soft px-5 py-4">
        <h2 className="m-0 text-[15px] font-semibold text-ink">
          Quarterly reviews
          <span className="ml-2 font-normal text-ink-muted">{visible.length}</span>
        </h2>
        <p className="m-0 mt-0.5 text-[13px] text-ink-muted">
          Committee packets live on each person&apos;s page.
        </p>
      </div>
      <ul className="m-0 list-none divide-y divide-line-soft p-0">
        {visible.map((entry) => (
          <li key={entry.mentorshipId}>
            <Link
              href={`/mentorship/people/${entry.menteeId}?section=reviews`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 no-underline transition-colors hover:bg-surface-soft"
            >
              <div className="min-w-0">
                <p className="m-0 text-[14.5px] font-semibold text-ink">{entry.menteeName}</p>
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                  {entry.mentorName ?? "Unassigned"} · {entry.quarter}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={entry.status ? QUARTERLY_STATUS_TONE[entry.status] : "warning"}>
                  {entry.status ? QUARTERLY_STATUS_LABEL[entry.status] : "Not started"}
                </StatusBadge>
                <span className="text-[16px] text-ink-muted" aria-hidden>
                  →
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
