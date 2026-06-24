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
    return (
      <section
        className="rounded-[16px] border border-line bg-surface p-4 shadow-card"
        aria-label="Score matrix — reviewer by category"
      >
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Score matrix
        </p>
        <p className="mt-2 text-[12.5px] text-ink-muted">
          No interview evaluations yet — the reviewer-by-category comparison
          appears here once interviewers submit their scores.
        </p>
      </section>
    );
  }

  return (
    <section
      className="overflow-x-auto rounded-[16px] border border-line bg-surface p-4 shadow-card"
      aria-label="Score matrix — reviewer by category"
    >
      <p className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Score matrix · {reviewers.length} reviewer{reviewers.length === 1 ? "" : "s"}
      </p>
      <table className="w-full min-w-[480px] border-separate border-spacing-0 text-[12px]">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-[200px] px-2 py-1.5 text-left font-semibold text-ink-muted"
            >
              Category
            </th>
            {reviewers.map((reviewer) => {
              const focused = focusedReviewerId === reviewer.id;
              return (
                <th
                  key={reviewer.id}
                  scope="col"
                  className={`rounded-t-[8px] px-2 py-1.5 ${focused ? "bg-brand-50" : "bg-transparent"}`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setFocusedReviewerId(focused ? null : reviewer.id)
                    }
                    aria-pressed={focused}
                    className="cursor-pointer border-0 bg-transparent p-0"
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
                  className={`p-2 text-left font-medium text-ink ${divergent ? "bg-amber-500/5" : "bg-transparent"}`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {row.label}
                    {divergent ? (
                      <span
                        aria-label="Reviewers diverged on this category"
                        className="inline-block size-1.5 rounded-full bg-amber-500"
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
                      className={`p-2 text-center ${focused ? "bg-brand-50" : "bg-transparent"}`}
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
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-muted">
        <span
          aria-hidden
          className="inline-block size-1.5 rounded-full bg-amber-500"
        />
        Amber marks categories where reviewers diverged by 2 or more levels.
        Tap a reviewer to focus their column.
      </p>
    </section>
  );
}
