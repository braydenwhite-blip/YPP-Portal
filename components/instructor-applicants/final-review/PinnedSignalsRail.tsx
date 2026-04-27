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
        summary: review.summary,
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
      className="pinned-signals-rail"
      aria-label="Pinned signals"
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 16,
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
        Pinned for rationale · {pinned.length}
      </p>
      {pinned.length === 0 ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-muted, #6b5f7a)", lineHeight: 1.5 }}>
          Click the pin icon on any feed item to save it here for your rationale.
        </p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
          {pinned.map(({ id, item }) => (
            <li
              key={id}
              style={{
                padding: 10,
                borderRadius: 10,
                background: "var(--cockpit-surface-strong, #faf8ff)",
                border: "1px solid var(--cockpit-line, rgba(71,85,105,0.14))",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-default, #1a0533)" }}>
                  {item.reviewerName ?? "Reviewer"}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--ypp-purple-700, #5a1da8)",
                      padding: 0,
                      display: "inline-flex",
                    }}
                  >
                    <PinIcon size={14} />
                  </button>
                </span>
              </div>
              {item.summary ? (
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: "var(--ink-default, #1a0533)",
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {item.summary.length > 200 ? `${item.summary.slice(0, 200)}…` : item.summary}
                </p>
              ) : null}
              {item.summary ? (
                <button
                  type="button"
                  onClick={() => quoteIntoRationale(item.summary ?? "")}
                  style={{
                    alignSelf: "flex-start",
                    background: "none",
                    border: "none",
                    padding: 0,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ypp-purple-700, #5a1da8)",
                    cursor: "pointer",
                  }}
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
