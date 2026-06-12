"use client";

/**
 * Chronological feed of interview reviews & lead reviewer notes for the
 * cockpit. Each item carries a pin button that uses the FinalReviewContext
 * to surface the same item in the right-rail PinnedSignalsRail. The pinned
 * rail is the chair's working set for rationale composition (§1.6).
 *
 * Phase 4 deliberately scopes the feed to interview-review summaries plus
 * the lead reviewer note. Per-question RED_FLAG signals and free-text
 * comment threading land in a later phase when the underlying schema work
 * arrives.
 */

import { useMemo } from "react";
import type { SerializedApplicationForReview } from "@/lib/final-review-queries";
import RecommendationBadge from "@/components/instructor-applicants/shared/RecommendationBadge";
import RatingChip from "@/components/instructor-applicants/shared/RatingChip";
import ReviewerIdentityChip from "@/components/instructor-applicants/shared/ReviewerIdentityChip";
import {
  useFinalReviewContext,
  usePinnedSignals,
} from "./FinalReviewContext";
import { PinIcon } from "./cockpit-icons";

interface FeedItem {
  id: string;
  reviewerId: string;
  reviewerName: string | null;
  round: number | null;
  recommendation: SerializedApplicationForReview["interviewReviews"][number]["recommendation"];
  overallRating: string | null;
  summary: string | null;
  kind: "INTERVIEW_REVIEW" | "REVIEWER_NOTE";
}

export interface ActivityFeedProps {
  application: SerializedApplicationForReview;
}

function formatCategoryKey(key: string): string {
  return key
    .split("_")
    .map((part) => part[0] + part.slice(1).toLowerCase())
    .join(" ");
}

export default function ActivityFeed({ application }: ActivityFeedProps) {
  const { focusedReviewerId, quoteIntoRationale } = useFinalReviewContext();
  const { ids: pinnedIds, toggle: togglePin } = usePinnedSignals();

  const items = useMemo<FeedItem[]>(() => {
    const interviews: FeedItem[] = application.interviewReviews.map((r) => ({
      id: `interview-${r.id}`,
      reviewerId: r.reviewerId,
      reviewerName: r.reviewerName,
      round: r.round,
      recommendation: r.recommendation,
      overallRating: r.overallRating,
      summary: null,
      kind: "INTERVIEW_REVIEW",
    }));
    if (application.reviewerNote) {
      interviews.unshift({
        id: `reviewer-note`,
        reviewerId: application.reviewerId ?? "lead-reviewer",
        reviewerName: application.reviewerName,
        round: null,
        recommendation: null,
        overallRating: application.reviewerNote.overallRating,
        summary: application.reviewerNote.summary ?? application.reviewerNote.notes,
        kind: "REVIEWER_NOTE",
      });
    }
    return interviews;
  }, [application]);

  if (items.length === 0) return null;

  return (
    <section
      className="flex flex-col gap-3 rounded-[16px] border border-line bg-surface p-5 shadow-card"
      aria-label="Activity feed"
    >
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Activity feed · {items.length} item{items.length === 1 ? "" : "s"}
      </p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {items.map((item) => {
          const focused = focusedReviewerId === item.reviewerId;
          const pinned = pinnedIds.includes(item.id);
          const dim = focusedReviewerId !== null && !focused;
          const isReviewerNote = item.kind === "REVIEWER_NOTE";
          return (
            <li
              key={item.id}
              className={`rounded-[12px] border p-3 transition-opacity duration-200 ${
                focused ? "bg-brand-50" : "bg-surface-soft"
              } ${pinned ? "border-l-[3px] border-l-brand-600 border-line-soft" : "border-line-soft"} ${
                dim ? "opacity-55" : "opacity-100"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <ReviewerIdentityChip
                  user={{ id: item.reviewerId, name: item.reviewerName }}
                  role={isReviewerNote ? "REVIEWER" : "INTERVIEWER"}
                  round={item.round ?? undefined}
                  size="sm"
                />
                <div className="inline-flex items-center gap-1.5">
                  {item.recommendation ? (
                    <RecommendationBadge recommendation={item.recommendation} size="sm" />
                  ) : null}
                  {item.overallRating ? (
                    <RatingChip
                      rating={item.overallRating as Parameters<typeof RatingChip>[0]["rating"]}
                      variant="outline"
                      size="xs"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => togglePin(item.id)}
                    aria-label={pinned ? "Unpin from rationale" : "Pin to rationale"}
                    aria-pressed={pinned}
                    className={`inline-flex size-7 cursor-pointer items-center justify-center rounded-[8px] border ${
                      pinned
                        ? "border-brand-400 bg-brand-100 text-brand-700"
                        : "border-line bg-transparent text-ink-muted"
                    }`}
                  >
                    <PinIcon size={14} />
                  </button>
                  {item.summary ? (
                    <button
                      type="button"
                      onClick={() => quoteIntoRationale(item.summary ?? "")}
                      title="Quote into rationale"
                      className="cursor-pointer border-0 bg-transparent px-1 text-[11px] font-semibold text-brand-700"
                    >
                      Quote
                    </button>
                  ) : null}
                </div>
              </div>
              {item.summary ? (
                <p className="m-0 mt-2 whitespace-pre-wrap text-[13px] leading-normal text-ink">
                  {item.summary}
                </p>
              ) : null}
              {item.kind === "INTERVIEW_REVIEW"
                ? renderCategories(application, item)
                : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function renderCategories(
  application: SerializedApplicationForReview,
  item: FeedItem
) {
  const review = application.interviewReviews.find((r) => `interview-${r.id}` === item.id);
  if (!review || review.categories.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {review.categories.map((cat) => (
        <RatingChip
          key={`${item.id}-${cat.category}`}
          rating={(cat.rating ?? null) as Parameters<typeof RatingChip>[0]["rating"]}
          label={formatCategoryKey(cat.category)}
          variant="outline"
          size="xs"
        />
      ))}
    </div>
  );
}
