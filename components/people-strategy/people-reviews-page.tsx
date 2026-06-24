import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PeopleHubNav } from "@/components/people/people-hub-nav";
import {
  parsePeopleReviewsTableFilters,
  peopleReviewsClearFiltersHref,
} from "@/lib/people-strategy/people-reviews-filters";
import {
  PeoplePerformanceClient,
} from "@/components/people-strategy/people-performance-client";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled, isQuarterlyReviewsEnabled } from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isBoard, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  filterPerformanceRows,
  loadPeoplePerformance,
} from "@/lib/people-strategy/people-performance";
import {
  collectPeopleReviewsFilterOptions,
  monthLabelUTC,
  parseMonthKey,
  type PerformanceFilter,
} from "@/lib/people-strategy/people-performance-selectors";

/** People & Reviews — mockup layout (shared by `/people` and legacy `/people/performance`). */
export async function PeopleReviewsPage({
  searchParams,
  basePath = "/people",
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath?: string;
}) {
  if (!isPeopleDashboardEnabled()) notFound();

  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) notFound();

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const rawView = typeof sp.view === "string" ? sp.view : undefined;
  const VALID_VIEWS = [
    "needs-attention",
    "needs-checkin",
    "feedback-pending",
    "reviews-due",
    "no-mentor",
    "growth",
    "workload",
    "all",
  ] as const satisfies readonly PerformanceFilter[];
  const view: PerformanceFilter =
    rawView && (VALID_VIEWS as readonly string[]).includes(rawView)
      ? (rawView as PerformanceFilter)
      : "all";
  const page = typeof sp.page === "string" ? Math.max(1, Number.parseInt(sp.page, 10) || 1) : 1;
  const tableFilters = parsePeopleReviewsTableFilters(sp);

  const { rows, currentQuarter, currentMonthKey } = await loadPeoplePerformance();
  const visible = filterPerformanceRows(rows, view, q, tableFilters);
  const filterOptions = collectPeopleReviewsFilterOptions(rows);

  const currentMonth = parseMonthKey(currentMonthKey);
  const monthLabel = currentMonth ? monthLabelUTC(currentMonth) : currentMonthKey;
  const monthShortLabel = currentMonth
    ? new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
        currentMonth
      )
    : currentMonthKey;

  const quarterlyEnabled = isQuarterlyReviewsEnabled();
  const showBoardRollupLink = isBoard(viewer);

  const hubViewer: ActionViewer = {
    id: viewer.id,
    roles: viewer.roles,
    primaryRole: viewer.primaryRole,
    adminSubtypes: viewer.adminSubtypes,
  };
  const hubAccess = getPeopleHubAccess(hubViewer);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2">
      <PeopleHubNav active="reviews" showPerformance />

      <div className="mb-5 mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 text-[25px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
            People & Reviews
          </h1>
          <p className="m-0 mt-1 text-[13.5px] text-[#717189]">
            Who needs a check-in next — one row per person, sorted by urgency.
          </p>
        </div>

        {showBoardRollupLink ? (
          <Link
            href="/actions/people/board-rollup"
            className="text-[13px] font-semibold text-[#c0392b] no-underline hover:underline"
          >
            Board roll-up
          </Link>
        ) : null}
      </div>

      <Suspense fallback={<p className="text-[13px] text-[#9a9ab0]">Loading people…</p>}>
        <PeoplePerformanceClient
          rows={rows}
          tableRows={visible}
          tableFilters={tableFilters}
          filterOptions={{
            mentors: filterOptions.mentors,
            chairs: filterOptions.chairs,
            performanceRatings: filterOptions.performanceRatings,
            potentialRatings: filterOptions.potentialRatings,
            feedbackStatuses: filterOptions.feedbackStatuses,
          }}
          clearFiltersHref={peopleReviewsClearFiltersHref(sp, basePath)}
          page={page}
          basePath={basePath}
          monthLabel={monthLabel}
          monthShortLabel={monthShortLabel}
          quarter={currentQuarter}
          quarterlyEnabled={quarterlyEnabled}
        />
      </Suspense>
    </div>
  );
}
