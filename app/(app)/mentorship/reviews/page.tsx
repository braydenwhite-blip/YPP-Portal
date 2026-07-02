import Link from "next/link";
import { getSession } from "@/lib/auth-supabase";
import { redirect } from "next/navigation";

import skin from "@/components/ui-v2/portal-skin.module.css";
import {
  ButtonLink,
  CardV2,
  PageHeaderV2,
  StatusBadge,
  type StatusTone,
} from "@/components/ui-v2";
import { MentorshipGuideCard } from "@/components/mentorship-guide-card";
import { formatEnum } from "@/lib/format-utils";
import { getChairQueue } from "@/lib/goal-review-actions";
import { getGoalRatingCopy } from "@/lib/mentorship-rubric-copy";
import {
  getReviewHeadlineState,
  type ReviewStateTone,
} from "@/lib/mentorship-review-state";
import { RatingLegend } from "@/components/mentorship/rating-legend";
import { EmptyStateEditorial } from "../_components/empty-state-editorial";

export const metadata = { title: "Review inbox — Mentorship" };

const REVIEW_INBOX_GUIDE_ITEMS = [
  {
    label: "What appears here",
    meaning:
      "Reviews in the Monthly Review Inbox are waiting for a chair-level decision before they become final and visible to the mentee.",
    howToUse:
      "Your inbox is populated based on your chair role. If you chair the Instructor lane, all instructor-mentee reviews in PENDING_CHAIR_APPROVAL appear here automatically.",
  },
  {
    label: "How to review",
    meaning:
      "Click any review card to open the full approval screen, which shows goal ratings, the mentee's self-input, and the mentor's written reasoning.",
    howToUse:
      "Approve when the review is complete and ready to release. Return it when the mentor needs to clarify ratings or strengthen the next-step plan.",
  },
  {
    label: "Quarterly reviews",
    meaning:
      "Reviews marked Quarterly cover three cycles of work and require a more thorough read.",
    howToUse:
      "Check the Quarterly badge on a card and allocate more time before approving.",
  },
] as const;

/** GoalRatingColor → the single StatusBadge tone vocabulary. */
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

export default async function MonthlyReviewInboxPage() {
  const session = await getSession();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const roles = session.user.roles ?? [];
  if (
    !roles.includes("ADMIN") &&
    !roles.includes("CHAPTER_PRESIDENT") &&
    !roles.includes("MENTOR")
  ) {
    redirect("/mentorship");
  }

  const reviews = await getChairQueue() ?? [];

  return (
    <div className={`${skin.portalSkin} flex flex-col gap-6`}>
      <PageHeaderV2
        eyebrow="Mentorship · Mentor console"
        title="Review inbox"
        subtitle="Reviews waiting on your chair approval before they're released to mentees."
        backHref="/mentorship"
        backLabel="Mentorship"
        actions={
          <ButtonLink href="/mentorship" size="sm">
            Write new review
          </ButtonLink>
        }
      />

      <MentorshipGuideCard
        title="How To Use The Monthly Review Inbox"
        intro="Your inbox shows reviews automatically routed to you based on your chair role — no manual assignment needed."
        items={REVIEW_INBOX_GUIDE_ITEMS}
      />

      <div className="grid gap-2">
        <p className="m-0 text-[12.5px] font-semibold text-ink-muted">
          The rating scale on every review
        </p>
        <RatingLegend audience="admin" compact />
      </div>

      {reviews.length === 0 ? (
        <EmptyStateEditorial
          title="Inbox zero."
          body="No reviews are waiting on you right now. New reviews appear here the moment a mentor submits one for your lane — nothing needs manual routing."
          link={{ label: "Back to the mentor console", href: "/mentorship" }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reviews.map((review) => {
            const state = getReviewHeadlineState({ status: review.status });
            return (
              <Link
                key={review.id}
                href={`/mentorship/chair/${review.id}`}
                className="group no-underline"
              >
                <CardV2
                  as="article"
                  padding="md"
                  className="flex flex-wrap items-center justify-between gap-4 border-l-4 border-l-brand-600 transition-shadow group-hover:shadow-overlay"
                >
                  <div className="min-w-[260px] flex-1">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[15px] font-bold text-ink">
                        {review.menteeName}
                      </span>
                      <StatusBadge tone="neutral">
                        {formatEnum(review.menteeRole ?? "")}
                      </StatusBadge>
                      {review.isQuarterly && (
                        <StatusBadge tone="brand">Quarterly</StatusBadge>
                      )}
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
        </div>
      )}
    </div>
  );
}
