import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PeopleHubNav } from "@/components/people/people-hub-nav";
import {
  parsePeopleReviewsTableFilters,
  peopleReviewsClearFiltersHref,
  type PeopleReviewsFilterParam,
} from "@/lib/people-strategy/people-reviews-filters";
import { PeoplePerformanceClient } from "@/components/people-strategy/people-performance-client";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled, isQuarterlyReviewsEnabled } from "@/lib/feature-flags";
import { isBoard } from "@/lib/people-strategy/action-permissions";
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

/**
 * People & Reviews roster — used on `/people` (standalone) and embedded on
 * Mentorship home (`basePath="/mentorship"`, `filterParam="roster"`).
 */
export async function PeopleReviewsPage({
  searchParams,
  basePath = "/people",
  filterParam = "view",
  embedded = false,
  hideHeading = false,
  personHrefBase,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  basePath?: string;
  /** Mentorship home uses `roster` so it does not collide with `?view=mentor`. */
  filterParam?: PeopleReviewsFilterParam;
  /** Hide People hub chrome; softer heading for Mentorship surfaces. */
  embedded?: boolean;
  /** When the parent page already provides a title (e.g. Mentorship People view). */
  hideHeading?: boolean;
  /** Row links — Mentorship uses `/mentorship/people`. */
  personHrefBase?: string;
}) {
  if (!isPeopleDashboardEnabled()) {
    if (embedded) return null;
    notFound();
  }

  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) {
    if (embedded) return null;
    notFound();
  }

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const rawFilter = typeof sp[filterParam] === "string" ? sp[filterParam] : undefined;
  const view: PerformanceFilter =
    rawFilter && (VALID_VIEWS as readonly string[]).includes(rawFilter)
      ? (rawFilter as PerformanceFilter)
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
  const resolvedPersonBase =
    personHrefBase ?? (basePath === "/mentorship" ? "/mentorship/people" : "/people");

  return (
    <div
      className={
        embedded
          ? "flex w-full flex-col gap-4 pt-2"
          : "mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2"
      }
    >
      {!embedded ? <PeopleHubNav active="reviews" showPerformance /> : null}

      {!hideHeading ? (
      <div className="mb-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          {embedded ? (
            <h2 className="m-0 text-[18px] font-bold tracking-[-0.3px] text-ink">
              People &amp; workload
            </h2>
          ) : (
            <h1 className="m-0 text-[25px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
              People & Reviews
            </h1>
          )}
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
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
      ) : showBoardRollupLink ? (
        <div className="flex justify-end">
          <Link
            href="/actions/people/board-rollup"
            className="text-[13px] font-semibold text-[#c0392b] no-underline hover:underline"
          >
            Board roll-up
          </Link>
        </div>
      ) : null}

      <Suspense fallback={<p className="text-[13px] text-ink-muted">Loading people…</p>}>
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
          clearFiltersHref={peopleReviewsClearFiltersHref(sp, basePath, filterParam)}
          page={page}
          basePath={basePath}
          personHrefBase={resolvedPersonBase}
          monthLabel={monthLabel}
          monthShortLabel={monthShortLabel}
          quarter={currentQuarter}
          quarterlyEnabled={quarterlyEnabled}
        />
      </Suspense>
    </div>
  );
}
