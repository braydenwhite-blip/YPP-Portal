import Link from "next/link";
import { Suspense } from "react";

import { EmptyStateV2 } from "@/components/ui-v2";
import { ActionHubCard } from "@/components/people-strategy/action-hub-card";
import { ActionsHubAnalytics } from "@/components/people-strategy/actions-hub-analytics";
import { ActionFiltersBar } from "@/components/people-strategy/action-filters-bar";
import { ActionsHubTabs, type ActionsHubTab } from "@/components/people-strategy/actions-hub-tabs";
import type { ActionChapterOption, ActionDepartmentOption, ActionItemWithRelations } from "@/lib/people-strategy/action-queries";
import type { ActionViewer } from "@/lib/people-strategy/action-permissions";
import {
  summarizeDepartments,
  summarizeStatuses,
} from "@/lib/people-strategy/action-analytics";
import type { ActionFilters } from "@/lib/people-strategy/action-filters";
import {
  departmentHeaderColor,
  groupActionsByDepartment,
} from "@/lib/people-strategy/actions-hub-grouping";
import { isRecentlyApprovedOnHub } from "@/lib/people-strategy/action-approval";
import { ActionsHubGraceRefresh } from "@/components/people-strategy/actions-hub-grace-refresh";

export function ActionsHub({
  items,
  now,
  filters,
  hasActiveFilters,
  departments,
  chapters,
  activeTab,
  officer,
  createHref,
  canCreate,
  viewer,
}: {
  items: ActionItemWithRelations[];
  now: Date;
  filters: ActionFilters;
  hasActiveFilters: boolean;
  departments: ActionDepartmentOption[];
  chapters: ActionChapterOption[];
  activeTab: ActionsHubTab;
  officer: boolean;
  createHref: string;
  canCreate: boolean;
  viewer: ActionViewer;
}) {
  const breakdown = summarizeStatuses(items, now);
  const bars = summarizeDepartments(items, now);
  const groups = groupActionsByDepartment(items, now);
  const graceRefreshTimes = items
    .filter((item) => isRecentlyApprovedOnHub(item, now))
    .map((item) => item.approvedAt!.toISOString());

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 pb-12 pt-4">
      <ActionsHubGraceRefresh approvedAtValues={graceRefreshTimes} />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
        <Suspense
          fallback={
            <div className="flex flex-wrap gap-2" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className="inline-flex h-9 w-24 animate-pulse rounded-full bg-surface-soft"
                />
              ))}
            </div>
          }
        >
          <ActionsHubTabs active={activeTab} officer={officer} />
        </Suspense>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <ActionFiltersBar
            departments={departments}
            chapters={chapters}
            filters={filters}
            hasActive={hasActiveFilters}
            basePath="/actions"
            variant="hub"
          />
          {canCreate ? (
            <Link
              href={createHref}
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-brand-600 bg-brand-600 px-4 text-[13px] font-semibold text-white no-underline shadow-sm hover:bg-brand-700"
            >
              ＋ New Action
            </Link>
          ) : null}
        </div>
      </div>

      <ActionsHubAnalytics breakdown={breakdown} bars={bars} />

      {groups.length === 0 ? (
        <EmptyStateV2
          icon="✓"
          title={hasActiveFilters ? "No matches" : activeTab === "approved" ? "No recent approvals" : "All clear"}
          body={
            hasActiveFilters
              ? "Try clearing a filter or searching with different words."
              : activeTab === "approved"
                ? "Nothing was approved in the last 10 minutes. Newly approved actions appear here briefly, then roll off the hub."
                : "Nothing is open in this view right now."
          }
        />
      ) : (
        <section className="overflow-hidden rounded-[14px] border border-line-card bg-surface shadow-card">
          {groups.map((group, groupIndex) => (
            <div key={group.id}>
              <header className="flex items-center justify-between gap-3 border-b border-line-soft bg-[#fafafc] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: departmentHeaderColor(group.slug) }}
                  />
                  <h2
                    className="m-0 text-[11.5px] font-extrabold uppercase tracking-[0.1em]"
                    style={{ color: departmentHeaderColor(group.slug) }}
                  >
                    {group.name}
                  </h2>
                </div>
                <span className="text-[12px] text-ink-muted">
                  {group.items.length} item{group.items.length === 1 ? "" : "s"}
                  {group.overdueCount > 0 ? (
                    <span className="font-semibold text-[#e5484d]">
                      {" "}
                      · {group.overdueCount} overdue
                    </span>
                  ) : null}
                </span>
              </header>

              {group.items.map((item, itemIndex) => {
                const isLast =
                  groupIndex === groups.length - 1 && itemIndex === group.items.length - 1;
                return (
                  <ActionHubCard key={item.id} item={item} now={now} viewer={viewer} isLast={isLast} />
                );
              })}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
