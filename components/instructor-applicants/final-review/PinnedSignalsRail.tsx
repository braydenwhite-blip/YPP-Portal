"use client";

/**
 * Right-rail surface that mirrors items the chair has pinned in the activity
 * feed. Provides a Quote-into-rationale shortcut so the chair can pull
 * pinned material straight into the dock's draft. (§1.5 Path C, §1.6 trust.)
 */

import { useMemo } from "react";
import type { SerializedApplicationForReview } from "@/lib/final-review-queries";
import { useFinalReviewContext, usePinnedSignals } from "./FinalReviewContext";
import RecommendationBadge from "@/components/instructor-applicants/shared/RecommendationBadge";
import { PinIcon } from "./cockpit-icons";

export interface PinnedSignalsRailProps {
  application: SerializedApplicationForReview;
}

export default function PinnedSignalsRail({ application }: PinnedSignalsRailProps) {
  const { ids } = usePinnedSignals();
  const { quoteIntoRationale } = useFinalReviewContext();
  const { toggle } = usePinnedSignals();

  const pinned = useMemo(() => {
    if (ids.length === 0) return [];
    const lookup = new Map<
      string,
      { reviewerName: string | null; summary: string | null; recommendation: string | null }
    >();
    for (const review of application.interviewReviews) {
      lookup.set(`interview-${review.id}`, {
        reviewerName: review.reviewerName,
        summary: null,
        recommendation: review.recommendation,
      });
    }
    if (application.reviewerNote) {
      lookup.set("reviewer-note", {
        reviewerName: application.reviewerName,
        summary: application.reviewerNote.summary ?? application.reviewerNote.notes,
        recommendation: null,
      });
    }
    return ids
      .map((id) => ({ id, item: lookup.get(id) }))
      .filter((entry): entry is { id: string; item: NonNullable<ReturnType<typeof lookup.get>> } =>
        Boolean(entry.item)
      );
  }, [ids, application]);

  return (
    <section
      className="rounded-[16px] border border-line bg-surface p-4 shadow-card"
      aria-label="Pinned signals"
    >
      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Pinned for rationale · {pinned.length}
      </p>
      {pinned.length === 0 ? (
        <p className="m-0 mt-2 text-[12px] leading-normal text-ink-muted">
          Click the pin icon on any feed item to save it here for your rationale.
        </p>
      ) : (
        <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
          {pinned.map(({ id, item }) => (
            <li
              key={id}
              className="flex flex-col gap-2 rounded-[10px] border border-line-soft bg-surface-soft p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold text-ink">
                  {item.reviewerName ?? "Reviewer"}
                </span>
                <span className="inline-flex items-center gap-1">
                  {item.recommendation ? (
                    <RecommendationBadge
                      recommendation={item.recommendation as Parameters<typeof RecommendationBadge>[0]["recommendation"]}
                      size="sm"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    aria-label="Unpin"
                    className="inline-flex cursor-pointer border-0 bg-transparent p-0 text-brand-700"
                  >
                    <PinIcon size={14} />
                  </button>
                </span>
              </div>
              {item.summary ? (
                <p className="m-0 whitespace-pre-wrap text-[12px] leading-snug text-ink">
                  {item.summary.length > 200 ? `${item.summary.slice(0, 200)}…` : item.summary}
                </p>
              ) : null}
              {item.summary ? (
                <button
                  type="button"
                  onClick={() => quoteIntoRationale(item.summary ?? "")}
                  className="cursor-pointer self-start border-0 bg-transparent p-0 text-[11px] font-semibold text-brand-700"
                >
                  Quote into rationale
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
