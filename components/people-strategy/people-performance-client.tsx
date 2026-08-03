"use client";

import { useMemo } from "react";

import { PeoplePerformanceTable } from "@/components/people-strategy/people-performance-table";
import { PeopleRosterOverviewPanel } from "@/components/people-strategy/people-roster-overview";
import {
  PeopleReviewsFiltersBar,
  type PeopleReviewsFilterOptions,
} from "@/components/people-strategy/people-reviews-filters";
import {
  paginateRows,
  PeopleReviewsPagination,
} from "@/components/people-strategy/people-reviews-pagination";
import { buildPeopleRosterOverview } from "@/lib/people-strategy/people-roster-overview";
import {
  sortPerformanceRowsByUrgency,
  type PerformanceFilter,
  type PeopleReviewsTableFilters,
} from "@/lib/people-strategy/people-performance-selectors";
import type { PeoplePerformanceRow } from "@/lib/people-strategy/people-performance";

export function PeoplePerformanceClient({
  rows,
  tableRows,
  tableFilters,
  filterOptions,
  clearFiltersHref,
  page,
  basePath = "/people",
  personHrefBase = "/people",
  filterParam = "view",
  activeFilter = "all",
  boardRollupHref = null,
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
  mentorCandidates = [],
  canAssignMentors = false,
}: {
  rows: PeoplePerformanceRow[];
  tableRows: PeoplePerformanceRow[];
  tableFilters: PeopleReviewsTableFilters;
  filterOptions: PeopleReviewsFilterOptions;
  clearFiltersHref: string;
  page: number;
  basePath?: string;
  personHrefBase?: string;
  filterParam?: string;
  activeFilter?: PerformanceFilter;
  boardRollupHref?: string | null;
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
  mentorCandidates?: Array<{
    id: string;
    name: string;
    role?: string | null;
    title?: string | null;
  }>;
  canAssignMentors?: boolean;
}) {
  const ctx = useMemo(() => ({ monthLabel, quarter }), [monthLabel, quarter]);
  const overview = useMemo(() => buildPeopleRosterOverview(rows), [rows]);
  const sortedRows = useMemo(() => {
    const sorted = sortPerformanceRowsByUrgency(tableRows, ctx);
    const seen = new Set<string>();
    return sorted.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    });
  }, [tableRows, ctx]);
  const pageRows = useMemo(() => paginateRows(sortedRows, page), [sortedRows, page]);

  const groupLabel =
    activeFilter === "review-needed"
      ? "Needs a review"
      : activeFilter === "no-mentor"
        ? "Needs a mentor"
        : "Everyone";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PeopleRosterOverviewPanel
        overview={overview}
        activeFilter={activeFilter}
        basePath={basePath}
        filterParam={filterParam}
        boardRollupHref={boardRollupHref}
      />

      <section className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="m-0 text-[16px] font-bold tracking-[-0.2px] text-[#1c1a2e]">
            {groupLabel}
          </h2>
        </div>

        <PeopleReviewsFiltersBar
          filters={tableFilters}
          options={filterOptions}
          clearHref={clearFiltersHref}
          basePath={basePath}
          resultCount={sortedRows.length}
        />

        {pageRows.length > 0 ? (
          <div className="min-w-0 overflow-hidden rounded-[16px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            <PeoplePerformanceTable
              rows={pageRows}
              monthLabel={monthLabel}
              monthShortLabel={monthShortLabel}
              quarter={quarter}
              quarterlyEnabled={quarterlyEnabled}
              personHrefBase={personHrefBase}
              mentorCandidates={mentorCandidates}
              canAssignMentors={canAssignMentors}
            />
            <PeopleReviewsPagination total={sortedRows.length} page={page} basePath={basePath} />
          </div>
        ) : (
          <div className="rounded-[16px] border border-[#ebebf2] bg-white px-5 py-14 text-center shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            <p className="m-0 text-[15px] font-semibold text-[#3a3a52]">Nobody here</p>
            <p className="m-0 mt-1 text-[13px] text-[#9a9ab0]">
              Try another group, or clear the search.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
