import Link from "next/link";
import { notFound } from "next/navigation";

import {
  FilterBar,
  FilterChipLink,
  PageHeaderV2,
  UrlSyncedSearchInput,
} from "@/components/ui-v2";
import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { PeoplePerformanceTable } from "@/components/people-strategy/people-performance-table";
import { requireLeadership } from "@/lib/authorization";
import { isPeopleDashboardEnabled } from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isBoard, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  filterPerformanceRows,
  loadPeoplePerformance,
} from "@/lib/people-strategy/people-performance";
import {
  asPerformanceFilter,
  monthLabelUTC,
  parseMonthKey,
  PERFORMANCE_FILTER_LABELS,
  PERFORMANCE_SIMPLE_FILTERS,
} from "@/lib/people-strategy/people-performance-selectors";

export const dynamic = "force-dynamic";
export const metadata = { title: "People & Performance — Pathways Portal" };

function performanceHref(params: { filter?: string; q?: string }): string {
  const search = new URLSearchParams();
  if (params.filter && params.filter !== "needs-attention") {
    search.set("filter", params.filter);
  }
  if (params.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/people/performance?${qs}` : "/people/performance";
}

export default async function PeoplePerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isPeopleDashboardEnabled()) notFound();

  const viewer = await requireLeadership().catch(() => null);
  if (!viewer) notFound();

  const sp = await searchParams;
  const filter = asPerformanceFilter(typeof sp.filter === "string" ? sp.filter : undefined);
  const q = typeof sp.q === "string" ? sp.q : undefined;

  const { rows, currentQuarter, currentMonthKey } = await loadPeoplePerformance();
  const visible = filterPerformanceRows(rows, filter, q);

  const currentMonth = parseMonthKey(currentMonthKey);
  const currentMonthLabel = currentMonth ? monthLabelUTC(currentMonth) : currentMonthKey;
  const showBoardRollupLink = isBoard(viewer);

  const hubViewer: ActionViewer = {
    id: viewer.id,
    roles: viewer.roles,
    primaryRole: viewer.primaryRole,
    adminSubtypes: viewer.adminSubtypes,
  };
  const hubAccess = getPeopleHubAccess(hubViewer);

  return (
    <div className="mx-auto flex w-full max-w-[960px] flex-col gap-5">
      <PeopleHubNav
        active="performance"
        showPerformance
        showClasses={hubAccess.showClasses}
      />

      <PageHeaderV2
        title="Who needs attention"
        subtitle="Open someone to follow up on check-ins, reviews, or workload."
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

      <UrlSyncedSearchInput
        placeholder="Search name…"
        wrapClassName="w-full"
        aria-label="Search team"
      />

      <FilterBar aria-label="Performance views">
        {PERFORMANCE_SIMPLE_FILTERS.map((value) => (
          <FilterChipLink
            key={value}
            href={performanceHref({ filter: value, q })}
            active={filter === value}
          >
            {PERFORMANCE_FILTER_LABELS[value]}
          </FilterChipLink>
        ))}
      </FilterBar>

      <p className="m-0 text-[12.5px] text-ink-muted">
        {visible.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "person" : "people"}`
          : `${visible.length} of ${rows.length}`}
        {q ? ` · “${q}”` : ""}
      </p>

      <PeoplePerformanceTable
        rows={visible}
        currentQuarter={currentQuarter}
        currentMonthLabel={currentMonthLabel}
      />
    </div>
  );
}
