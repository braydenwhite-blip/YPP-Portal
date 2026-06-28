import type {
  ClassOutcomeStatus,
  ClassRepeatRecommendation,
} from "@prisma/client";

/**
 * Pure taxonomy, labels, and aggregation helpers for the class feedback +
 * completion-outcome layer. This module deliberately has NO server-only imports
 * (no prisma) so it is safe to import from client components — the admin outcome
 * form, the star rating, etc. — as well as from server reads/writes.
 */

// ── Outcome status ───────────────────────────────────────────────────────────

export const OUTCOME_STATUS_ORDER: ClassOutcomeStatus[] = [
  "PENDING",
  "STRONG",
  "SOLID",
  "MIXED",
  "UNDERPERFORMED",
  "DID_NOT_RUN",
];

export const OUTCOME_STATUS_LABELS: Record<ClassOutcomeStatus, string> = {
  PENDING: "Not reviewed yet",
  STRONG: "Strong — clear success",
  SOLID: "Solid — met the bar",
  MIXED: "Mixed — uneven",
  UNDERPERFORMED: "Underperformed",
  DID_NOT_RUN: "Did not run",
};

// ── Repeat recommendation taxonomy ───────────────────────────────────────────

export const REPEAT_RECOMMENDATION_ORDER: ClassRepeatRecommendation[] = [
  "REPEAT_AS_IS",
  "REPEAT_WITH_TWEAKS",
  "REPEAT_NEW_INSTRUCTOR",
  "REPEAT_LATER",
  "NEEDS_REWORK",
  "DO_NOT_REPEAT",
  "UNDECIDED",
];

export const REPEAT_RECOMMENDATION_LABELS: Record<
  ClassRepeatRecommendation,
  string
> = {
  REPEAT_AS_IS: "Repeat as-is",
  REPEAT_WITH_TWEAKS: "Repeat with tweaks",
  REPEAT_NEW_INSTRUCTOR: "Repeat, new instructor",
  REPEAT_LATER: "Repeat later",
  NEEDS_REWORK: "Needs rework first",
  DO_NOT_REPEAT: "Do not repeat",
  UNDECIDED: "Undecided",
};

export const REPEAT_RECOMMENDATION_HINTS: Record<
  ClassRepeatRecommendation,
  string
> = {
  REPEAT_AS_IS: "Run it again unchanged.",
  REPEAT_WITH_TWEAKS: "Worth running again with small changes.",
  REPEAT_NEW_INSTRUCTOR: "Good class — assign a different instructor next time.",
  REPEAT_LATER: "Worth repeating, but not the next term.",
  NEEDS_REWORK: "Promising, but needs a real redesign before it runs again.",
  DO_NOT_REPEAT: "Retire this one.",
  UNDECIDED: "Not decided yet.",
};

/** The recommendations that mean "yes, run this again" (drive the repeat panel). */
export const REPEAT_RECOMMENDATIONS_TO_REPEAT: ReadonlySet<ClassRepeatRecommendation> =
  new Set<ClassRepeatRecommendation>([
    "REPEAT_AS_IS",
    "REPEAT_WITH_TWEAKS",
    "REPEAT_NEW_INSTRUCTOR",
    "REPEAT_LATER",
  ]);

export function isRepeatRecommendation(
  value: ClassRepeatRecommendation | null | undefined,
): boolean {
  return value != null && REPEAT_RECOMMENDATIONS_TO_REPEAT.has(value);
}

// ── "Good feedback" thresholds ───────────────────────────────────────────────

// A class "got good feedback" when enough students rated it and the average is
// high — or when an admin explicitly flagged it on the outcome record.
export const GOOD_FEEDBACK_MIN_RATING = 4;
export const GOOD_FEEDBACK_MIN_RESPONSES = 2;

export function isGoodFeedback(
  input: {
    avgRating: number;
    responseCount: number;
    flagged?: boolean;
  },
  // Optional admin-configured thresholds (portal settings). Defaults preserve the
  // original behaviour, so existing callers and tests are unaffected.
  opts?: { minRating?: number; minResponses?: number }
): boolean {
  if (input.flagged) return true;
  const minResponses = opts?.minResponses ?? GOOD_FEEDBACK_MIN_RESPONSES;
  const minRating = opts?.minRating ?? GOOD_FEEDBACK_MIN_RATING;
  return input.responseCount >= minResponses && input.avgRating >= minRating;
}

// ── Rating aggregation ───────────────────────────────────────────────────────

export type ClassFeedbackSummary = {
  responseCount: number;
  avgRating: number; // 0 when no responses
  /** Count of ratings 1..5, index 0 unused. */
  distribution: number[];
  recommendCount: number;
  recommendResponses: number; // how many answered the recommend question
  recommendPct: number | null; // null when nobody answered
};

export function summarizeFeedback(
  rows: Array<{ rating: number; wouldRecommend: boolean | null }>,
): ClassFeedbackSummary {
  const distribution = [0, 0, 0, 0, 0, 0];
  let ratingSum = 0;
  let recommendCount = 0;
  let recommendResponses = 0;

  for (const row of rows) {
    const clamped = Math.max(1, Math.min(5, Math.round(row.rating)));
    distribution[clamped] += 1;
    ratingSum += clamped;
    if (row.wouldRecommend != null) {
      recommendResponses += 1;
      if (row.wouldRecommend) recommendCount += 1;
    }
  }

  const responseCount = rows.length;
  return {
    responseCount,
    avgRating: responseCount > 0 ? ratingSum / responseCount : 0,
    distribution,
    recommendCount,
    recommendResponses,
    recommendPct:
      recommendResponses > 0 ? recommendCount / recommendResponses : null,
  };
}
