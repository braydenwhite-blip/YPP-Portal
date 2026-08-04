"use client";

import Link from "next/link";

import { cn } from "@/components/ui-v2";
import type { PeopleRosterOverview } from "@/lib/people-strategy/people-roster-overview";
import type { PerformanceFilter } from "@/lib/people-strategy/people-performance-selectors";

function filterHref(
  basePath: string,
  filterParam: string,
  filter: PerformanceFilter
): string {
  const path = basePath.split("?")[0] || basePath;
  const isMentorship = path === "/mentorship";

  if (isMentorship) {
    if (filter === "all") return "/mentorship?view=people";
    return `/mentorship?view=people&${filterParam}=${encodeURIComponent(filter)}`;
  }

  if (filter === "all") return path;
  return `${path}?${filterParam}=${encodeURIComponent(filter)}`;
}

const TABS: Array<{
  filter: PerformanceFilter;
  label: string;
  countKey: "total" | "reviewNeeded" | "needsMentor";
  hint: string;
}> = [
  { filter: "all", label: "Everyone", countKey: "total", hint: "On this list" },
  {
    filter: "review-needed",
    label: "Needs a review",
    countKey: "reviewNeeded",
    hint: "Mentor must finish",
  },
  {
    filter: "no-mentor",
    label: "Needs a mentor",
    countKey: "needsMentor",
    hint: "Assign someone",
  },
];

/**
 * Ultra-simple People header — three big tabs + one progress line.
 */
export function PeopleRosterOverviewPanel({
  overview,
  activeFilter,
  basePath,
  filterParam = "view",
  boardRollupHref,
}: {
  overview: PeopleRosterOverview;
  activeFilter: PerformanceFilter;
  basePath: string;
  filterParam?: string;
  boardRollupHref?: string | null;
}) {
  const href = (filter: PerformanceFilter) =>
    filterHref(basePath, filterParam, filter);

  const reviewTrack = overview.reviewNeeded + overview.reviewDone;
  const donePct =
    reviewTrack > 0 ? Math.round((overview.reviewDone / reviewTrack) * 100) : 0;

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[14px] text-[#717189]">
          Pick a group, then tap someone to open them.
        </p>
        {boardRollupHref ? (
          <Link
            href={boardRollupHref}
            className="text-[12.5px] font-semibold text-[#c0392b] no-underline hover:underline"
          >
            Board roll-up
          </Link>
        ) : null}
      </div>

      <div
        role="tablist"
        aria-label="People groups"
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {TABS.map((tab) => {
          const count = overview[tab.countKey];
          const selected = activeFilter === tab.filter;
          const urgent =
            (tab.filter === "review-needed" || tab.filter === "no-mentor") && count > 0;

          return (
            <Link
              key={tab.filter}
              role="tab"
              aria-selected={selected}
              href={href(tab.filter)}
              className={cn(
                "flex flex-col gap-1 rounded-[14px] border px-4 py-3.5 no-underline transition-colors",
                selected
                  ? "border-[#6b21c8] bg-[#f7f2ff] shadow-[0_0_0_1px_#6b21c8]"
                  : urgent
                    ? "border-[#f0d4d4] bg-white hover:border-[#e8b4b4]"
                    : "border-[#ebebf2] bg-white hover:border-[#d8d8e4]"
              )}
            >
              <span
                className={cn(
                  "text-[28px] font-extrabold leading-none tracking-[-0.02em]",
                  urgent && !selected ? "text-[#c0392b]" : "text-[#1c1a2e]"
                )}
              >
                {count}
              </span>
              <span className="text-[14px] font-semibold text-[#1c1a2e]">{tab.label}</span>
              <span className="text-[12px] text-[#9a9ab0]">{tab.hint}</span>
            </Link>
          );
        })}
      </div>

      {reviewTrack > 0 ? (
        <div className="rounded-[12px] border border-[#ebebf2] bg-[#fafafd] px-4 py-3">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <span className="text-[13px] font-medium text-[#3a3a52]">
              Reviews finished this month
            </span>
            <span className="text-[13px] tabular-nums text-[#717189]">
              {overview.reviewDone} of {reviewTrack}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[#ebebf2]">
            <div
              className="h-full rounded-full bg-[#0e9f6e] transition-[width] duration-300"
              style={{ width: `${donePct}%` }}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
