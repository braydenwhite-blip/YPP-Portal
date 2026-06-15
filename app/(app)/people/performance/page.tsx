import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { PeoplePerformanceClient } from "@/components/people-strategy/people-performance-client";
import { requireLeadership } from "@/lib/authorization";
import {
  isPeopleDashboardEnabled,
  isQuarterlyReviewsEnabled,
} from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isBoard, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import { loadPeopleCockpit } from "@/lib/people-strategy/people-cockpit-queries";
import {
  filterPerformanceRows,
  loadPeoplePerformance,
} from "@/lib/people-strategy/people-performance";
import {
  countMatchingFilter,
  monthLabelUTC,
  parseMonthKey,
  PERFORMANCE_FILTER_LABELS,
  type PerformanceFilter,
} from "@/lib/people-strategy/people-performance-selectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "People & Performance — Pathways Portal" };

export default async function PeoplePerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isPeopleDashboardEnabled()) notFound();

  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) notFound();

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;

  // The high-signal People-memory views, "All" last. Filters are URL links so
  // the CPO review queue and the Help Agent can deep-link a filtered view.
  const FILTER_CHIPS = [
    "needs-attention",
    "needs-checkin",
    "feedback-pending",
    "reviews-due",
    "no-mentor",
    "growth",
    "workload",
    "all",
  ] as const satisfies readonly PerformanceFilter[];
  const rawView = typeof sp.view === "string" ? sp.view : undefined;
  const view: PerformanceFilter =
    rawView && (FILTER_CHIPS as readonly string[]).includes(rawView)
      ? (rawView as PerformanceFilter)
      : "all";

  const { rows, currentQuarter, currentMonthKey } = await loadPeoplePerformance();
  const visible = filterPerformanceRows(rows, view, q);

  function chipHref(key: PerformanceFilter): string {
    const params = new URLSearchParams();
    if (key !== "all") params.set("view", key);
    if (q) params.set("q", q);
    const query = params.toString();
    return query ? `/people/performance?${query}` : "/people/performance";
  }

  const currentMonth = parseMonthKey(currentMonthKey);
  const monthLabel = currentMonth ? monthLabelUTC(currentMonth) : currentMonthKey;
  const monthShortLabel = currentMonth
    ? new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
        currentMonth
      )
    : currentMonthKey;

  const quarterlyEnabled = isQuarterlyReviewsEnabled();
  // The cockpit is the guided briefing — built from the WHOLE team (never the
  // search subset) plus recent meeting follow-ups. Search/filter only narrow the
  // secondary Browse-all table below.
  const cockpit = await loadPeopleCockpit({
    performanceRows: rows,
    monthLabel,
    quarter: currentQuarter,
  });
  const showBoardRollupLink = isBoard(viewer);

  const hubViewer: ActionViewer = {
    id: viewer.id,
    roles: viewer.roles,
    primaryRole: viewer.primaryRole,
    adminSubtypes: viewer.adminSubtypes,
  };
  const hubAccess = getPeopleHubAccess(hubViewer);

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-5">
      <PeopleHubNav
        active="performance"
        showPerformance
        showClasses={hubAccess.showClasses}
      />

      <PageHeaderV2
        title="People Strategy"
        subtitle="The leadership decisions and follow-ups across YPP people — grouped by what needs to happen next."
        actions={
          showBoardRollupLink ? (
            <Link
              href="/actions/people/board-rollup"
              className="text-[13px] font-semibold text-danger-700 no-underline hover:underline"
            >
              Board roll-up
            </Link>
          ) : null
        }
      />

      <PeoplePerformanceClient
        cockpit={cockpit}
        rows={rows}
        tableRows={visible}
        monthLabel={monthLabel}
        monthShortLabel={monthShortLabel}
        quarter={currentQuarter}
        quarterlyEnabled={quarterlyEnabled}
        browseControls={
          <>
            <UrlSyncedSearchInput
              placeholder="Search name…"
              wrapClassName="w-full"
              aria-label="Search team"
            />
            <FilterBar aria-label="Filter people">
              {FILTER_CHIPS.map((key) => (
                <FilterChipLink
                  key={key}
                  href={chipHref(key)}
                  active={key === view}
                  count={key === "all" ? undefined : countMatchingFilter(rows, key)}
                >
                  {PERFORMANCE_FILTER_LABELS[key]}
                </FilterChipLink>
              ))}
            </FilterBar>
            <p className="m-0 text-[12.5px] text-ink-muted">
              {visible.length === rows.length
                ? `${rows.length} ${rows.length === 1 ? "person" : "people"}`
                : `${visible.length} of ${rows.length}`}
              {q ? ` · “${q}”` : ""}
            </p>
          </>
        }
      />
    </div>
  );
}
