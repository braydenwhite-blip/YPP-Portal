"use client";

/**
 * Score matrix — reviewer × category cross-tab. The dimensional comparison
 * surface from §1.4 of the redesign plan: lets the chair see at a glance
 * which categories reviewers diverged on without scrolling individual
 * narratives.
 *
 * Click a reviewer header → focuses that reviewer (sets focusedReviewerId in
 * the FinalReviewContext); rows for the focused reviewer get a purple
 * accent. Click again to clear.
 *
 * Cells with the highest variance across reviewers get a subtle highlight
 * dot so the chair's eye is drawn to the rows where reviewers actually
 * disagree.
 */

import { useMemo } from "react";
import type { ProgressStatus } from "@prisma/client";
import {
  INSTRUCTOR_REVIEW_CATEGORIES,
  type InstructorReviewCategoryValue,
} from "@/lib/instructor-review-config";
import RatingChip from "@/components/instructor-applicants/shared/RatingChip";
import ReviewerIdentityChip from "@/components/instructor-applicants/shared/ReviewerIdentityChip";
import { useFocusedReviewer } from "./FinalReviewContext";

export interface ScoreMatrixReviewer {
  id: string;
  name: string | null;
  round?: number | null;
}

export interface ScoreMatrixCell {
  reviewerId: string;
  category: string;
  rating: ProgressStatus | null;
}

export interface ScoreMatrixProps {
  reviewers: ScoreMatrixReviewer[];
  cells: ScoreMatrixCell[];
}

const CATEGORY_KEYS: InstructorReviewCategoryValue[] = INSTRUCTOR_REVIEW_CATEGORIES.map(
  (c) => c.key
);

const SCALE_INDEX: Record<ProgressStatus, number> = {
  BEHIND_SCHEDULE: 0,
  GETTING_STARTED: 1,
  ON_TRACK: 2,
  ABOVE_AND_BEYOND: 3,
};

function spreadFor(ratings: Array<ProgressStatus | null>): number {
  const idxs = ratings
    .map((r) => (r ? SCALE_INDEX[r] : null))
    .filter((n): n is number => typeof n === "number");
  if (idxs.length < 2) return 0;
  return Math.max(...idxs) - Math.min(...idxs);
}

export default function ScoreMatrix({ reviewers, cells }: ScoreMatrixProps) {
  const [focusedReviewerId, setFocusedReviewerId] = useFocusedReviewer();

  const matrix = useMemo(() => {
    const lookup = new Map<string, ProgressStatus | null>();
    for (const cell of cells) {
      lookup.set(`${cell.reviewerId}::${cell.category}`, cell.rating);
    }
    return CATEGORY_KEYS.map((key) => {
      const row = INSTRUCTOR_REVIEW_CATEGORIES.find((c) => c.key === key)!;
      const ratings = reviewers.map(
        (r) => lookup.get(`${r.id}::${key}`) ?? null
      );
      return { key, label: row.label, ratings, spread: spreadFor(ratings) };
    });
  }, [cells, reviewers]);

  if (reviewers.length === 0) {
    return null;
  }

  return (
    <section
      className="score-matrix"
      aria-label="Score matrix — reviewer by category"
      style={{
        background: "var(--cockpit-surface, #fff)",
        border: "1px solid var(--cockpit-line, rgba(71,85,105,0.18))",
        borderRadius: 16,
        padding: 16,
        overflowX: "auto",
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--ink-muted, #6b5f7a)",
        }}
      >
        Score matrix · {reviewers.length} reviewer{reviewers.length === 1 ? "" : "s"}
      </p>
      <table
        style={{
          width: "100%",
          borderCollapse: "separate",
          borderSpacing: 0,
          minWidth: 480,
          fontSize: 12,
        }}
      >
        <thead>
          <tr>
            <th
              scope="col"
              style={{
                textAlign: "left",
                padding: "6px 8px",
                color: "var(--ink-muted, #6b5f7a)",
                fontWeight: 600,
                width: 200,
              }}
            >
              Category
            </th>
            {reviewers.map((reviewer) => {
              const focused = focusedReviewerId === reviewer.id;
              return (
                <th
                  key={reviewer.id}
                  scope="col"
                  style={{
                    padding: "6px 8px",
                    background: focused ? "var(--ypp-purple-50, #f3ecff)" : "transparent",
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 8,
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedReviewerId(focused ? null : reviewer.id)
                    }
                    aria-pressed={focused}
                    style={{
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                    }}
                  >
                    <ReviewerIdentityChip
                      user={{ id: reviewer.id, name: reviewer.name }}
                      role="INTERVIEWER"
                      round={reviewer.round ?? undefined}
                      size="sm"
                    />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row) => {
            const divergent = row.spread >= 2;
            return (
              <tr key={row.key}>
                <th
                  scope="row"
                  style={{
                    textAlign: "left",
                    padding: "8px",
                    fontWeight: 500,
                    color: "var(--ink-default, #1a0533)",
                    background: divergent ? "rgba(234, 179, 8, 0.06)" : "transparent",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {row.label}
                    {divergent ? (
                      <span
                        aria-label="Reviewers diverged on this category"
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "var(--score-mixed, #eab308)",
                          display: "inline-block",
                        }}
                      />
                    ) : null}
                  </span>
                </th>
                {reviewers.map((reviewer, idx) => {
                  const rating = row.ratings[idx];
                  const focused = focusedReviewerId === reviewer.id;
                  return (
                    <td
                      key={reviewer.id}
                      style={{
                        padding: "8px",
                        textAlign: "center",
                        background: focused ? "var(--ypp-purple-50, #f3ecff)" : "transparent",
                      }}
                    >
                      <RatingChip rating={rating} variant="solid" size="xs" />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
