import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BannerV2,
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  StatCardV2,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { PeoplePerformanceTable } from "@/components/people-strategy/people-performance-table";
import { requireLeadership } from "@/lib/authorization";
import {
  isActionTrackerEmailsEnabled,
  isPeopleDashboardEnabled,
} from "@/lib/feature-flags";
import { isBoard } from "@/lib/people-strategy/action-permissions";
import {
  filterPerformanceRows,
  loadPeoplePerformance,
} from "@/lib/people-strategy/people-performance";
import {
  asPerformanceFilter,
  monthLabelUTC,
  parseMonthKey,
  PERFORMANCE_FILTERS,
  PERFORMANCE_FILTER_LABELS,
} from "@/lib/people-strategy/people-performance-selectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "People & Performance — Pathways Portal" };

function performanceHref(params: { filter?: string; q?: string }): string {
  const search = new URLSearchParams();
  if (params.filter && params.filter !== "all") search.set("filter", params.filter);
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/people/performance?${qs}` : "/people/performance";
}

/**
 * People & Performance — the Leadership/Board people view (CPO dashboard).
 *
 * One table over everyone with a People-Strategy footprint: active work split
 * Lead vs Executing, quarterly review placement, monthly check-in dots,
 * concrete signals, and the REVIEWABLE Request Monthly Feedback workflow
 * (suggested collaborators with reasons + email preview before anything
 * sends). Compiles only live Action Tracker / Quarterly Review / Monthly
 * Check-In / FeedbackRequest data — no new metrics.
 *
 * Access mirrors the legacy People Dashboard exactly: the route 404s unless
 * ENABLE_PEOPLE_DASHBOARD is on AND the viewer passes `requireLeadership()`
 * (ADMIN with the Leadership or SUPER_ADMIN subtype — the CPO/Board tier).
 */
export default async function PeoplePerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Outer gate: with the flag off the route does not exist.
  if (!isPeopleDashboardEnabled()) notFound();

  // Leadership/Board only; deny with 404 so the route is not leaked.
  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) notFound();

  const sp = await searchParams;
  const filter = asPerformanceFilter(typeof sp.filter === "string" ? sp.filter : undefined);
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const { rows, stats, currentQuarter, currentMonthKey } = await loadPeoplePerformance();
  const visible = filterPerformanceRows(rows, filter, q);

  const canRequestFeedback = isActionTrackerEmailsEnabled();
  const currentMonth = parseMonthKey(currentMonthKey);
  const currentMonthLabel = currentMonth ? monthLabelUTC(currentMonth) : currentMonthKey;
  const showBoardRollupLink = isBoard(viewer);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6">
      <PageHeaderV2
        eyebrow="Knowledge OS · Leadership & Board only"
        title="People & Performance"
        subtitle="Review workload, check-ins, feedback requests, and leadership signals across YPP. Names open the person's 360 preview; feedback requests are reviewed before anything sends."
        backHref="/people"
        backLabel="People"
        actions={
          showBoardRollupLink ? (
            <Link
              href="/actions/people/board-rollup"
              className="text-[13px] font-semibold text-danger-700 no-underline hover:underline"
            >
              Board escalation roll-up →
            </Link>
          ) : null
        }
      >
        {/* Click-to-filter stat strip — every count lands on its filtered view. */}
        <div className="flex flex-wrap gap-3">
          <StatCardV2
            label="Needs check-in"
            value={stats.needsCheckIn}
            detail={`no ${currentMonthLabel} check-in`}
            tone={stats.needsCheckIn > 0 ? "attention" : "default"}
            href={performanceHref({ filter: "needs-checkin" })}
          />
          <StatCardV2
            label="Feedback pending"
            value={stats.feedbackPending}
            detail="members awaiting replies"
            href={performanceHref({ filter: "feedback-pending" })}
          />
          <StatCardV2
            label="Reviews due"
            value={stats.reviewsDue}
            detail={`no ${currentQuarter} review`}
            tone={stats.reviewsDue > 0 ? "attention" : "default"}
            href={performanceHref({ filter: "reviews-due" })}
          />
          <StatCardV2
            label="Workload flags"
            value={stats.workloadFlagged}
            detail="overdue or heavy load"
            tone={stats.workloadFlagged > 0 ? "attention" : "default"}
            href={performanceHref({ filter: "workload" })}
          />
          <StatCardV2
            label="Succession"
            value={stats.succession}
            detail="flagged by latest review"
            href={performanceHref({ filter: "succession" })}
          />
        </div>
      </PageHeaderV2>

      {!canRequestFeedback ? (
        <BannerV2
          tone="warning"
          title="Feedback requests are disabled"
          role="status"
        >
          Set ENABLE_ACTION_TRACKER_EMAILS to request monthly feedback from
          collaborators. The dashboard stays read-only until then.
        </BannerV2>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar aria-label="Performance filters">
          {PERFORMANCE_FILTERS.map((value) => (
            <FilterChipLink
              key={value}
              href={performanceHref({ filter: value, q })}
              active={filter === value}
            >
              {PERFORMANCE_FILTER_LABELS[value]}
            </FilterChipLink>
          ))}
        </FilterBar>
        <UrlSyncedSearchInput
          placeholder="Search name, role, department…"
          wrapClassName="w-full sm:w-72"
          aria-label="Search members"
        />
      </div>

      <p className="m-0 text-[12.5px] text-ink-muted">
        {visible.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "member" : "members"} with a people-strategy footprint`
          : `Showing ${visible.length} of ${rows.length} members`}
        {q ? ` · matching “${q}”` : ""}
        {" · Dot colors: At Risk · Needs Attention · On Track · Above & Beyond · gray = no rating · hollow = no check-in"}
      </p>

      <PeoplePerformanceTable
        rows={visible}
        currentQuarter={currentQuarter}
        canRequestFeedback={canRequestFeedback}
      />
    </div>
  );
}
