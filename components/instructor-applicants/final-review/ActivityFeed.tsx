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
      summary: r.summary,
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
      className="cockpit-activity-feed"
      aria-label="Activity feed"
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Activity feed · {items.length} item{items.length === 1 ? "" : "s"}
      </p>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => {
          const focused = focusedReviewerId === item.reviewerId;
          const pinned = pinnedIds.includes(item.id);
          const dim = focusedReviewerId !== null && !focused;
          const isReviewerNote = item.kind === "REVIEWER_NOTE";
          return (
            <li
              key={item.id}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
                background: focused
                  ? "var(--ypp-purple-50, #f3ecff)"
                  : "var(--cockpit-surface-strong, #faf8ff)",
                borderLeft: pinned
                  ? "3px solid var(--ypp-purple-600, #6b21c8)"
                  : "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
                opacity: dim ? 0.55 : 1,
                transition: "opacity 200ms ease, background 200ms ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
                <ReviewerIdentityChip
                  user={{ id: item.reviewerId, name: item.reviewerName }}
                  role={isReviewerNote ? "REVIEWER" : "INTERVIEWER"}
                  round={item.round ?? undefined}
                  size="sm"
                />
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
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
                    style={{
                      background: pinned ? "var(--ypp-purple-100, #f0e6ff)" : "transparent",
                      border: "1px solid",
                      borderColor: pinned
                        ? "var(--ypp-purple-400, #b47fff)"
                        : "var(--cockpit-line, rgba(71,85,105,0.2))",
                      borderRadius: 8,
                      width: 28,
                      height: 28,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: pinned
                        ? "var(--ypp-purple-700, #5a1da8)"
                        : "var(--ink-muted, #6b5f7a)",
                    }}
                  >
                    <PinIcon size={14} />
                  </button>
                  {item.summary ? (
                    <button
                      type="button"
                      onClick={() => quoteIntoRationale(item.summary ?? "")}
                      title="Quote into rationale"
                      style={{
                        background: "none",
                        border: "none",
                        padding: "0 4px",
                        color: "var(--ypp-purple-700, #5a1da8)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Quote
                    </button>
                  ) : null}
                </div>
              </div>
              {item.summary ? (
                <p
                  style={{
                    margin: "8px 0 0",
                    fontSize: 13,
                    lineHeight: 1.5,
                    color: "var(--ink-default, #1a0533)",
                    whiteSpace: "pre-wrap",
                  }}
                >
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
    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
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
