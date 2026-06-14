import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeaderV2, UrlSyncedSearchInput } from "@/components/ui-v2";
import { PeopleHubNav } from "@/components/people/people-hub-nav";
import { MonthSnapshotStrip } from "@/components/people-strategy/month-snapshot-strip";
import { PeoplePerformanceClient } from "@/components/people-strategy/people-performance-client";
import { requireLeadership } from "@/lib/authorization";
import {
  isPeopleDashboardEnabled,
  isQuarterlyReviewsEnabled,
} from "@/lib/feature-flags";
import { getPeopleHubAccess } from "@/lib/people/hub-access";
import { isBoard, type ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  filterPerformanceRows,
  loadPeoplePerformance,
} from "@/lib/people-strategy/people-performance";
import {
  buildMonthSnapshot,
  monthLabelUTC,
  parseMonthKey,
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

  const { rows, currentQuarter, currentMonthKey } = await loadPeoplePerformance();
  const visible = filterPerformanceRows(rows, "all", q);

  const currentMonth = parseMonthKey(currentMonthKey);
  const monthLabel = currentMonth ? monthLabelUTC(currentMonth) : currentMonthKey;
  const monthShortLabel = currentMonth
    ? new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" }).format(
        currentMonth
      )
    : currentMonthKey;

  const quarterlyEnabled = isQuarterlyReviewsEnabled();
  // Snapshot reflects the whole team for the month — never just the search subset.
  const snapshot = buildMonthSnapshot(rows);
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
        title="People & Performance"
        subtitle="A quick operating snapshot — who needs feedback reviewed, a check-in compiled, or a review attended."
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

      <MonthSnapshotStrip
        snapshot={snapshot}
        monthLabel={monthLabel}
        quarterlyEnabled={quarterlyEnabled}
      />

      <UrlSyncedSearchInput
        placeholder="Search name…"
        wrapClassName="w-full"
        aria-label="Search team"
      />

      <p className="m-0 text-[12.5px] text-ink-muted">
        {visible.length === rows.length
          ? `${rows.length} ${rows.length === 1 ? "person" : "people"}`
          : `${visible.length} of ${rows.length}`}
        {q ? ` · “${q}”` : ""}
      </p>

      <PeoplePerformanceClient
        rows={visible}
        monthLabel={monthLabel}
        monthShortLabel={monthShortLabel}
        quarter={currentQuarter}
        quarterlyEnabled={quarterlyEnabled}
      />
    </div>
  );
}
