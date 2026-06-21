"use client";

import { useEffect, useMemo, useState } from "react";

import { CheckInsDrawer } from "@/components/people-strategy/check-ins-drawer";
import { FeedbackRequestDrawer } from "@/components/people-strategy/feedback-request-drawer";
import { FeedbackReviewDrawer } from "@/components/people-strategy/feedback-review-drawer";
import { PersonDetailDrawer } from "@/components/people-strategy/person-detail-drawer";
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

type Member = { id: string; name: string };

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
  const [detailRow, setDetailRow] = useState<PeoplePerformanceRow | null>(null);
  const [checkInsMember, setCheckInsMember] = useState<Member | null>(null);
  const [reviewMember, setReviewMember] = useState<Member | null>(null);
  const [requestMember, setRequestMember] = useState<Member | null>(null);

  // Keep the open drawer in sync after router.refresh().
  useEffect(() => {
    if (!detailRow) return;
    const fresh = rows.find((r) => r.id === detailRow.id);
    if (fresh) setDetailRow(fresh);
  }, [rows, detailRow?.id]);

  const ctx = useMemo(() => ({ monthLabel, quarter }), [monthLabel, quarter]);
  const sortedRows = useMemo(
    () => sortPerformanceRowsByUrgency(tableRows, ctx),
    [tableRows, ctx]
  );
  const pageRows = useMemo(() => paginateRows(sortedRows, page), [sortedRows, page]);

  function memberFromRow(row: PeoplePerformanceRow): Member {
    return { id: row.id, name: row.name || row.email };
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <PeopleReviewsFiltersBar
          filters={tableFilters}
          options={filterOptions}
          clearHref={clearFiltersHref}
          basePath={basePath}
        />

        {pageRows.length > 0 ? (
          <div className="overflow-hidden rounded-[14px] border border-[#ebebf2] bg-white shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            <PeoplePerformanceTable
              rows={pageRows}
              monthLabel={monthLabel}
              monthShortLabel={monthShortLabel}
              quarter={quarter}
              quarterlyEnabled={quarterlyEnabled}
              onOpenPerson={setDetailRow}
              onOpenCheckIns={(row) => setCheckInsMember(memberFromRow(row))}
            />
            <PeopleReviewsPagination total={sortedRows.length} page={page} basePath={basePath} />
          </div>
        ) : (
          <div className="rounded-[14px] border border-[#ebebf2] bg-white px-5 py-12 text-center text-[13px] text-[#9a9ab0] shadow-[0_1px_2px_rgba(20,20,50,0.03)]">
            No one matches this search or filter.
          </div>
        )}
      </div>

      <CheckInsDrawer member={checkInsMember} onClose={() => setCheckInsMember(null)} />

      <PersonDetailDrawer
        row={detailRow}
        monthLabel={monthLabel}
        monthShortLabel={monthShortLabel}
        quarter={quarter}
        quarterlyEnabled={quarterlyEnabled}
        onClose={() => setDetailRow(null)}
        onReviewFeedback={setReviewMember}
        onRequestFeedback={setRequestMember}
      />

      <FeedbackReviewDrawer member={reviewMember} onClose={() => setReviewMember(null)} />
      <FeedbackRequestDrawer member={requestMember} onClose={() => setRequestMember(null)} />
    </>
  );
}
