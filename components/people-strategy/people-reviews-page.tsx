import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PeopleHubNav } from "@/components/people/people-hub-nav";
import {
  parsePeopleReviewsTableFilters,
  peopleReviewsClearFiltersHref,
  type PeopleReviewsFilterParam,
} from "@/lib/people-strategy/people-reviews-filters";
import { PeoplePerformanceClient } from "@/components/people-strategy/people-performance-client";
import { hasAnyAdminSubtype, hasRole, requireLeadership } from "@/lib/authorization";
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
import { prisma } from "@/lib/prisma";

const VALID_VIEWS = [
  "needs-attention",
  "needs-checkin",
  "feedback-pending",
  "reviews-due",
  "review-needed",
  "no-mentor",
  "growth",
  "workload",
  "all",
] as const satisfies readonly PerformanceFilter[];

/**
 * Admin People dashboard roster — used on `/people` and Mentorship
 * (`basePath="/mentorship"`, `filterParam="roster"`).
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

  const [{ rows, currentQuarter, currentMonthKey }, mentorCandidates, chairCandidates] =
    await Promise.all([
      loadPeoplePerformance(),
      prisma.user.findMany({
        where: {
          archivedAt: null,
          OR: [
            {
              primaryRole: {
                in: ["ADMIN", "STAFF", "MENTOR", "CHAPTER_PRESIDENT", "HIRING_CHAIR"],
              },
            },
            { mentorPairs: { some: { status: "ACTIVE" } } },
          ],
        },
        select: { id: true, name: true, primaryRole: true, title: true, canonicalTitle: true },
        orderBy: { name: "asc" },
        take: 400,
      }),
      prisma.user.findMany({
        where: {
          archivedAt: null,
          OR: [
            {
              primaryRole: {
                in: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"],
              },
            },
            {
              roles: {
                some: {
                  role: {
                    in: ["ADMIN", "STAFF", "CHAPTER_PRESIDENT", "HIRING_CHAIR"],
                  },
                },
              },
            },
          ],
        },
        select: { id: true, name: true, primaryRole: true, title: true, canonicalTitle: true },
        orderBy: { name: "asc" },
        take: 400,
      }),
    ]);
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

  const canAssignMentors =
    hasRole(viewer.roles, "ADMIN", viewer.primaryRole) ||
    hasRole(viewer.roles, "STAFF", viewer.primaryRole) ||
    hasRole(viewer.roles, "CHAPTER_PRESIDENT", viewer.primaryRole) ||
    hasAnyAdminSubtype(viewer.adminSubtypes, [
      "SUPER_ADMIN",
      "MENTORSHIP_ADMIN",
      "LEADERSHIP",
    ]);

  const candidateOptions = mentorCandidates.map((c) => ({
    id: c.id,
    name: c.name?.trim() || "Unknown",
    role: c.primaryRole,
    title: c.title?.trim() || c.canonicalTitle?.trim() || null,
  }));
  const chairCandidateOptions = chairCandidates.map((c) => ({
    id: c.id,
    name: c.name?.trim() || "Unknown",
    role: c.primaryRole,
    title: c.title?.trim() || c.canonicalTitle?.trim() || null,
  }));

  return (
    <div
      className={
        embedded
          ? "flex w-full min-w-0 flex-col gap-4 pt-2"
          : "mx-auto w-full max-w-[1200px] px-1 pb-12 pt-2"
      }
    >
      {!embedded ? <PeopleHubNav active="reviews" showPerformance /> : null}

      {!hideHeading ? (
        <div className="mb-1">
          {embedded ? (
            <h2 className="m-0 text-[18px] font-bold tracking-[-0.3px] text-ink">
              People
            </h2>
          ) : (
            <h1 className="m-0 text-[25px] font-extrabold tracking-[-0.4px] text-[#1c1a2e]">
              People
            </h1>
          )}
          <p className="m-0 mt-1 text-[13.5px] text-ink-muted">
            Find someone. See if they need a review or a mentor. Tap to open.
          </p>
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
          filterParam={filterParam}
          activeFilter={view}
          boardRollupHref={showBoardRollupLink ? "/actions/people/board-rollup" : null}
          monthLabel={monthLabel}
          monthShortLabel={monthShortLabel}
          quarter={currentQuarter}
          quarterlyEnabled={quarterlyEnabled}
          mentorCandidates={candidateOptions}
          chairCandidates={chairCandidateOptions}
          canAssignMentors={canAssignMentors}
        />
      </Suspense>
    </div>
  );
}
