"use client";

import { useMemo } from "react";

import { PeoplePerformanceTable } from "@/components/people-strategy/people-performance-table";
import {
  PeopleReviewsFiltersBar,
  type PeopleReviewsFilterOptions,
} from "@/components/people-strategy/people-reviews-filters";
import {
  paginateRows,
  PeopleReviewsPagination,
} from "@/components/people-strategy/people-reviews-pagination";
import {
  sortPerformanceRowsByUrgency,
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
  monthLabel,
  monthShortLabel,
  quarter,
  quarterlyEnabled,
}: {
  rows: PeoplePerformanceRow[];
  tableRows: PeoplePerformanceRow[];
  tableFilters: PeopleReviewsTableFilters;
  filterOptions: PeopleReviewsFilterOptions;
  clearFiltersHref: string;
  page: number;
  basePath?: string;
  monthLabel: string;
  monthShortLabel: string;
  quarter: string;
  quarterlyEnabled: boolean;
}) {
  const ctx = useMemo(() => ({ monthLabel, quarter }), [monthLabel, quarter]);
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

  return (
    <>
      <div className="flex flex-col gap-4">
        <PeopleReviewsFiltersBar
          filters={tableFilters}
          options={filterOptions}
          clearHref={clearFiltersHref}
          basePath={basePath}
          resultCount={sortedRows.length}
        />

        {pageRows.length > 0 ? (
          <div className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            <p className="border-b border-[#f1f1f6] px-4 py-2 text-[12px] text-[#717189]">
              Tap any row to open their full profile. Use the purple button to compile a check-in
              — it turns green when done.
            </p>
            <PeoplePerformanceTable
              rows={pageRows}
              monthLabel={monthLabel}
              monthShortLabel={monthShortLabel}
              quarter={quarter}
              quarterlyEnabled={quarterlyEnabled}
            />
            <PeopleReviewsPagination total={sortedRows.length} page={page} basePath={basePath} />
          </div>
        ) : (
          <div className="rounded-[14px] border border-[#ebebf2] bg-white px-5 py-12 text-center text-[13px] text-[#9a9ab0] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            No one matches this search or filter.
          </div>
        )}
      </div>
    </>
  );
}
