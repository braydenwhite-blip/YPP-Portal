"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { UrlSyncedSearchInput } from "@/components/ui-v2";
import {
  hasActivePeopleReviewsFilters,
  type PeopleReviewsFilterOptions,
} from "@/lib/people-strategy/people-reviews-filters";
import type { PeopleReviewsTableFilters } from "@/lib/people-strategy/people-performance-selectors";

export type { PeopleReviewsFilterOptions };

/**
 * Search-only filter — keep the roster dumb-easy.
 */
export function PeopleReviewsFiltersBar({
  filters,
  clearHref,
  resultCount,
}: {
  filters: PeopleReviewsTableFilters;
  options: PeopleReviewsFilterOptions;
  clearHref: string;
  basePath?: string;
  resultCount?: number;
}) {
  const searchParams = useSearchParams();
  const q = searchParams.get("q")?.trim() ?? "";
  const active = hasActivePeopleReviewsFilters(filters) || Boolean(q);

  return (
    <div className="flex w-full flex-wrap items-center gap-3">
      <div className="relative min-w-[220px] flex-1">
        <UrlSyncedSearchInput
          placeholder="Type a name…"
          wrapClassName="w-full"
          aria-label="Search people"
        />
      </div>
      {typeof resultCount === "number" ? (
        <p className="m-0 text-[13px] text-[#9a9ab0]">
          {resultCount === 0
            ? "No matches"
            : resultCount === 1
              ? "1 person"
              : `${resultCount} people`}
          {active ? (
            <>
              {" · "}
              <Link
                href={clearHref}
                className="font-semibold text-[#5a1da8] no-underline hover:underline"
              >
                Clear
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
