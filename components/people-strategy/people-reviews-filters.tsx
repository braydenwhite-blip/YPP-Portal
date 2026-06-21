"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { UrlSyncedSearchInput } from "@/components/ui-v2";
import {
  hasActivePeopleReviewsFilters,
  type PeopleReviewsFilterOptions,
} from "@/lib/people-strategy/people-reviews-filters";
import {
  PEOPLE_REVIEWS_FEEDBACK_FILTER_LABELS,
  type PeopleReviewsTableFilters,
} from "@/lib/people-strategy/people-performance-selectors";

export type { PeopleReviewsFilterOptions };

const PARAM = {
  mentor: "mentor",
  chair: "chair",
  feedback: "feedback",
} as const;

/**
 * Mockup filter row — search + three dropdowns + Clear filters (always visible).
 */
export function PeopleReviewsFiltersBar({
  filters,
  options,
  clearHref,
  basePath = "/people",
}: {
  filters: PeopleReviewsTableFilters;
  options: PeopleReviewsFilterOptions;
  clearHref: string;
  basePath?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = hasActivePeopleReviewsFilters(filters);

  function pushParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") params.set(key, value);
    else params.delete(key);
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1" style={{ maxWidth: 360 }}>
        <UrlSyncedSearchInput
          placeholder="Search people..."
          wrapClassName="w-full"
          aria-label="Search people"
        />
      </div>

      <select
        className="ps-filter"
        aria-label="Filter by mentor"
        value={filters.mentor ?? "ALL"}
        onChange={(e) => pushParam(PARAM.mentor, e.target.value)}
      >
        <option value="ALL">Mentor</option>
        {options.mentors.map((mentor) => (
          <option key={mentor} value={mentor}>
            {mentor}
          </option>
        ))}
      </select>

      <select
        className="ps-filter"
        aria-label="Filter by chair"
        value={filters.chair ?? "ALL"}
        onChange={(e) => pushParam(PARAM.chair, e.target.value)}
      >
        <option value="ALL">Chair</option>
        {options.chairs.map((chair) => (
          <option key={chair} value={chair}>
            {chair}
          </option>
        ))}
      </select>

      <select
        className="ps-filter"
        aria-label="Filter by feedback status"
        value={filters.feedback ?? "ALL"}
        onChange={(e) => pushParam(PARAM.feedback, e.target.value)}
      >
        <option value="ALL">Feedback status</option>
        {options.feedbackStatuses.map((status) => (
          <option key={status} value={status}>
            {PEOPLE_REVIEWS_FEEDBACK_FILTER_LABELS[status]}
          </option>
        ))}
      </select>

      {active ? (
        <Link
          href={clearHref}
          className="ml-auto shrink-0 text-[13px] font-semibold text-[#5a1da8] no-underline hover:underline"
        >
          Clear filters
        </Link>
      ) : (
        <span className="ml-auto shrink-0 text-[13px] font-semibold text-[#c4c4d4]">
          Clear filters
        </span>
      )}
    </div>
  );
}
