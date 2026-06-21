import type { GoalRatingColor } from "@prisma/client";

import { GOAL_RATING_ORDER } from "@/lib/people-strategy/constants";

import {
  PEOPLE_CHAIR_TIERS,
  type PeopleChairTier,
  type PeopleReviewsFeedbackFilter,
  type PeopleReviewsTableFilters,
} from "./people-performance-selectors";

export type PeopleReviewsFilterOptions = {
  mentors: string[];
  chairs: PeopleChairTier[];
  performanceRatings: GoalRatingColor[];
  potentialRatings: GoalRatingColor[];
  feedbackStatuses: PeopleReviewsFeedbackFilter[];
};

export function hasActivePeopleReviewsFilters(filters: PeopleReviewsTableFilters): boolean {
  return Boolean(
    filters.mentor ||
      filters.chair ||
      filters.performance ||
      filters.potential ||
      filters.feedback
  );
}

export function parsePeopleReviewsTableFilters(
  sp: Record<string, string | string[] | undefined>
): PeopleReviewsTableFilters {
  const mentor = typeof sp.mentor === "string" ? sp.mentor : undefined;
  const chairRaw = typeof sp.chair === "string" ? sp.chair : undefined;
  const performanceRaw = typeof sp.performance === "string" ? sp.performance : undefined;
  const potentialRaw = typeof sp.potential === "string" ? sp.potential : undefined;
  const feedbackRaw = typeof sp.feedback === "string" ? sp.feedback : undefined;

  const chair =
    chairRaw && (PEOPLE_CHAIR_TIERS as readonly string[]).includes(chairRaw)
      ? (chairRaw as PeopleChairTier)
      : undefined;
  const performance = GOAL_RATING_ORDER.includes(performanceRaw as GoalRatingColor)
    ? (performanceRaw as GoalRatingColor)
    : undefined;
  const potential = GOAL_RATING_ORDER.includes(potentialRaw as GoalRatingColor)
    ? (potentialRaw as GoalRatingColor)
    : undefined;
  const feedback = (["requested", "partial", "complete", "review"] as const).includes(
    feedbackRaw as PeopleReviewsFeedbackFilter
  )
    ? (feedbackRaw as PeopleReviewsFeedbackFilter)
    : undefined;

  return { mentor, chair, performance, potential, feedback };
}

export function peopleReviewsClearFiltersHref(
  sp: Record<string, string | string[] | undefined>,
  basePath = "/people"
): string {
  const params = new URLSearchParams();
  if (typeof sp.view === "string" && sp.view !== "all") params.set("view", sp.view);
  if (typeof sp.q === "string") params.set("q", sp.q);
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}
