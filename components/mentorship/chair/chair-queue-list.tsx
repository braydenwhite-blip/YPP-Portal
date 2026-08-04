import Link from "next/link";

import { ButtonLink, StatusBadge, type StatusTone } from "@/components/ui-v2";
import skin from "@/components/ui-v2/portal-skin.module.css";
import { formatEnum } from "@/lib/format-utils";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import { getChairQueue } from "@/lib/goal-review-actions";

const RATING_TONE: Record<string, StatusTone> = {
  ABOVE_AND_BEYOND: "brand",
  ACHIEVED: "success",
  GETTING_STARTED: "warning",
  BEHIND_SCHEDULE: "danger",
};

function ratingLabel(rating: string): string {
  return getGoalRatingCopy(rating).label ?? formatEnum(rating);
}

function monthLabel(value: Date | string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Chair queue — performance reviews waiting for approve / request-changes.
 */
export async function ChairQueueList() {
  const reviews = (await getChairQueue()) ?? [];
  const pending = reviews.filter((r) => r.status === "PENDING_CHAIR_APPROVAL");
  const changes = reviews.filter((r) => r.status === "CHANGES_REQUESTED");

  return (
    <div className={`${skin.portalSkin} mx-auto flex w-full max-w-3xl flex-col gap-6`}>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">
            Mentorship
          </p>
          <h1 className="m-0 mt-1 text-[28px] font-bold tracking-[-0.03em] text-[#2e1065]">
            Review Approvals
          </h1>
          <p className="m-0 mt-1 max-w-[52ch] text-[14px] text-ink-muted">
            Mentors send performance reviews here. Approve &amp; release to the
            mentee, or send back with notes.
          </p>
        </div>
        <ButtonLink href="/mentorship?view=mentor" variant="secondary" size="sm">
          Mentorship home
        </ButtonLink>
      </header>

      {pending.length === 0 && changes.length === 0 ? (
        <section className="rounded-[14px] border border-[#e8e4f0] bg-white px-5 py-8 text-center shadow-[0_1px_2px_rgb(46_16_101/0.04)]">
          <p className="m-0 text-[15px] font-semibold text-ink">You&apos;re caught up</p>
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            No reviews waiting for chair approval right now.
          </p>
        </section>
      ) : null}

      {pending.length > 0 ? (
        <QueueSection
          title="Needs your decision"
          count={pending.length}
          description="Ready to approve and release, or request changes."
          rows={pending}
        />
      ) : null}

      {changes.length > 0 ? (
        <QueueSection
          title="Waiting on mentor"
          count={changes.length}
          description="You asked for changes — these resurface when the mentor resubmits."
          rows={changes}
          muted
        />
      ) : null}
    </div>
  );
}

function QueueSection({
  title,
  count,
  description,
  rows,
  muted = false,
}: {
  title: string;
  count: number;
  description: string;
  rows: NonNullable<Awaited<ReturnType<typeof getChairQueue>>>;
  muted?: boolean;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[14px] border border-[#e8e4f0] bg-white shadow-[0_1px_2px_rgb(46_16_101/0.04)] ${
        muted ? "opacity-90" : ""
      }`}
    >
      <div className="border-b border-[#e8e4f0] px-5 py-4">
        <h2 className="m-0 text-[15px] font-semibold text-ink">
          {title}
          <span className="ml-2 font-normal text-ink-muted">{count}</span>
        </h2>
        <p className="m-0 mt-0.5 text-[13px] text-ink-muted">{description}</p>
      </div>
      <ul className="m-0 list-none divide-y divide-[#e8e4f0] p-0">
        {rows.map((review) => (
          <li key={review.id}>
            <Link
              href={`/mentorship/chair/${review.id}`}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 no-underline transition-colors hover:bg-[#faf8ff]"
            >
              <div className="min-w-0">
                <p className="m-0 text-[14.5px] font-semibold text-ink">
                  {review.menteeName}
                </p>
                <p className="m-0 mt-0.5 text-[12.5px] text-ink-muted">
                  {review.mentorName} · {monthLabel(review.cycleMonth)}
                  {review.menteeRole ? ` · ${formatEnum(review.menteeRole)}` : ""}
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
