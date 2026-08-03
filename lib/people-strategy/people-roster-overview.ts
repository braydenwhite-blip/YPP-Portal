import type { GoalRatingColor } from "@prisma/client";

import { RATING_LABELS } from "@/lib/people-strategy/check-in-rating";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";
import {
  mentorReviewCellStatus,
  mentorReviewNeedsAction,
} from "@/lib/people-strategy/people-performance-selectors";

export type ReviewStatusSliceKey =
  | "needed"
  | "finish"
  | "chair"
  | "reflection"
  | "done"
  | "other";

export type PeopleRosterOverview = {
  total: number;
  reviewNeeded: number;
  needsMentor: number;
  overdueActions: number;
  reviewDone: number;
  reviewSlices: Array<{
    key: ReviewStatusSliceKey;
    label: string;
    count: number;
    color: string;
  }>;
  ratingBars: Array<{
    rating: GoalRatingColor;
    label: string;
    count: number;
    color: string;
  }>;
};

const REVIEW_SLICE_META: Record<
  ReviewStatusSliceKey,
  { label: string; color: string }
> = {
  needed: { label: "Review needed", color: "#e5484d" },
  finish: { label: "Finish review", color: "#e0a008" },
  chair: { label: "Awaiting chair", color: "#7c3aed" },
  reflection: { label: "Awaiting reflection", color: "#9a9ab0" },
  done: { label: "Review done", color: "#0e9f6e" },
  other: { label: "Other", color: "#c9c9d6" },
};

const RATING_BAR_COLORS: Record<GoalRatingColor, string> = {
  BEHIND_SCHEDULE: "#e5484d",
  GETTING_STARTED: "#e0a008",
  ACHIEVED: "#0e9f6e",
  ABOVE_AND_BEYOND: "#6b21c8",
};

const RATING_ORDER: GoalRatingColor[] = [
  "BEHIND_SCHEDULE",
  "GETTING_STARTED",
  "ACHIEVED",
  "ABOVE_AND_BEYOND",
];

function sliceKeyFromLabel(label: string): ReviewStatusSliceKey {
  switch (label) {
    case "Review needed":
      return "needed";
    case "Finish review":
    case "Fix & resubmit":
      return "finish";
    case "Awaiting chair":
      return "chair";
    case "Awaiting reflection":
      return "reflection";
    case "Review done":
      return "done";
    default:
      return "other";
  }
}

/** Aggregate roster counts for the People overview strip + charts. */
export function buildPeopleRosterOverview(
  rows: PeoplePerformanceRow[]
): PeopleRosterOverview {
  const sliceCounts: Record<ReviewStatusSliceKey, number> = {
    needed: 0,
    finish: 0,
    chair: 0,
    reflection: 0,
    done: 0,
    other: 0,
  };
  const ratingCounts: Record<GoalRatingColor, number> = {
    BEHIND_SCHEDULE: 0,
    GETTING_STARTED: 0,
    ACHIEVED: 0,
    ABOVE_AND_BEYOND: 0,
  };

  let reviewNeeded = 0;
  let needsMentor = 0;
  let overdueActions = 0;
  let reviewDone = 0;

  for (const row of rows) {
    const label = mentorReviewCellStatus(row.facts).text;
    sliceCounts[sliceKeyFromLabel(label)] += 1;
    if (mentorReviewNeedsAction(row.facts)) reviewNeeded += 1;
    if (row.facts.needsMentor) needsMentor += 1;
    if (row.facts.hasOverdueAction) overdueActions += 1;
    if (label === "Review done") reviewDone += 1;

    const rating = row.latestGoalReview?.overallRating;
    if (rating) ratingCounts[rating] += 1;
  }

  const reviewSlices = (
    Object.keys(REVIEW_SLICE_META) as ReviewStatusSliceKey[]
  )
    .map((key) => ({
      key,
      label: REVIEW_SLICE_META[key].label,
      color: REVIEW_SLICE_META[key].color,
      count: sliceCounts[key],
    }))
    .filter((s) => s.count > 0);

  const ratingBars = RATING_ORDER.map((rating) => ({
    rating,
    label: RATING_LABELS[rating],
    count: ratingCounts[rating],
    color: RATING_BAR_COLORS[rating],
  })).filter((b) => b.count > 0);

  return {
    total: rows.length,
    reviewNeeded,
    needsMentor,
    overdueActions,
    reviewDone,
    reviewSlices,
    ratingBars,
  };
}
