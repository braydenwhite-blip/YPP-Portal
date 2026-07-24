"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import {
  DATE_RANGE_KEYS,
  type AttentionGroup,
  type Data360Overview,
  type DateRangeKey,
} from "@/lib/data-360/types";
import {
  DATA_360_LENSES,
  LENS_BLURBS,
  LENS_LABELS,
  type Data360Lens,
} from "@/lib/data-360/views";

import type { WorkflowIntelligence } from "@/lib/data-360/workflow-intelligence";
import type { MentorshipSnapshot } from "@/lib/data-360/mentorship-analytics";

import {
  ChaptersSection,
  DictionarySection,
  FundraisingSection,
  GeographySection,
  MentorshipSection,
  OverviewSection,
  PeopleSection,
  PerformanceSection,
  ProgramsSection,
  WorkflowsSection,
  type SectionData,
} from "./sections";

/**
 * Data 360 — the shell. Tabs + lens are client state (instant); the date range
 * is URL-driven (`?range=`) so the server recomputes — the filter is real, not
 * cosmetic. Scoped dark "terminal" surface; no global CSS touched.
 */

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "workflows", label: "Workflows" },
  { key: "mentorship", label: "Mentorship" },
  { key: "people", label: "People" },
  { key: "programs", label: "Programs" },
  { key: "chapters", label: "Chapters" },
  { key: "fundraising", label: "Fundraising" },
  { key: "performance", label: "Performance" },
  { key: "geography", label: "Geography" },
  { key: "dictionary", label: "Data Dictionary" },
] as const;

const RANGE_LABELS: Record<DateRangeKey, string> = {
  today: "Today",
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
  all: "All time",
};

function asOf(iso: string): string {
  const date = new Date(iso);
  const month = date.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = date.getUTCDate();
  const hour = date.getUTCHours();
  const minute = date.getUTCMinutes().toString().padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${month} ${day} at ${hour12}:${minute} ${period} UTC`;
}

function normalizeTab(tab: string | undefined): string {
  return TABS.some((t) => t.key === tab) ? (tab as string) : "overview";
}

export function Data360Shell({
  overview,
  attention,
  workflow,
  mentorship,
  defaultLens,
  rangeKey,
  initialTab,
}: {
  overview: Data360Overview;
  attention: AttentionGroup[];
  workflow: WorkflowIntelligence;
  mentorship: MentorshipSnapshot;
  defaultLens: Data360Lens;
  rangeKey: DateRangeKey;
  initialTab?: string;
}) {
  const [activeTab, setActiveTab] = useState<string>(() => normalizeTab(initialTab));
  const [lens, setLens] = useState<Data360Lens>(defaultLens);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return overview.search
      .filter((e) => `${e.label} ${e.sub}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, overview.search]);

  const sectionData: SectionData = { overview, attention, workflow, mentorship, lens };

  function renderSection() {
    switch (activeTab) {
      case "workflows":
        return <WorkflowsSection data={sectionData} />;
      case "mentorship":
        return <MentorshipSection data={sectionData} />;
      case "people":
        return <PeopleSection data={sectionData} />;
      case "programs":
        return <ProgramsSection data={sectionData} />;
      case "chapters":
        return <ChaptersSection data={sectionData} />;
      case "fundraising":
        return <FundraisingSection />;
      case "performance":
        return <PerformanceSection data={sectionData} />;
      case "geography":
        return <GeographySection data={sectionData} />;
      case "dictionary":
        return <DictionarySection />;
      default:
        return <OverviewSection data={sectionData} />;
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0a0e17] text-[#e6edf3] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.6)]">
        <div className="h-[3px] w-full bg-gradient-to-r from-[#6b21c8] via-[#8b3fe8] to-[#5ec5ff]" />

        <div className="flex flex-col gap-5 p-5 md:p-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-[24px] font-bold tracking-tight text-white">Org intelligence</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#34d399]/30 bg-[#34d399]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[#34d399]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#34d399]" />
                  Live
                </span>
              </div>
              <p className="mt-1 text-[13px] text-[#8b94a7]">
                Organizational intelligence for YPP
              </p>
            </div>
            <div className="text-right text-[11px] text-[#5f6b80]">
              <div>As of {asOf(overview.generatedAtISO)}</div>
              <div>{overview.range.label}</div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students, instructors, chapters, programs, partners…"
                className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 text-[13px] text-[#e6edf3] placeholder:text-[#5f6b80] outline-none transition-colors focus:border-[#8b3fe8]/60"
                aria-label="Search org intelligence"
              />
              {query.trim().length > 0 ? (
                <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-lg border border-white/10 bg-[#0f1420] shadow-xl">
                  {results.length === 0 ? (
                    <p className="px-3 py-2.5 text-[12px] text-[#5f6b80]">
                      No matches in chapters, partners, or programs.
                    </p>
                  ) : (
                    <ul className="max-h-72 overflow-y-auto py-1">
                      {results.map((e) => (
                        <li key={e.id}>
                          <Link
                            href={e.href}
                            prefetch={false}
                            className="flex items-center justify-between gap-3 px-3 py-1.5 transition-colors hover:bg-white/[0.05]"
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-[12.5px] text-[#dbe2ec]">
                                {e.label}
                              </span>
                              <span className="block truncate text-[11px] text-[#7c89a0]">
                                {e.sub}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-[#5f6b80]">
                              {e.kind}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Date range (URL-driven) */}
              <div
                className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
                role="group"
                aria-label="Date range"
              >
                {DATE_RANGE_KEYS.map((key) => {
                  const active = key === rangeKey;
                  return (
                    <Link
                      key={key}
                      href={`/data-360?tab=${activeTab}&range=${key}`}
                      prefetch={false}
                      scroll={false}
                      className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                        active
                          ? "bg-white/[0.12] text-white"
                          : "text-[#8b94a7] hover:text-[#e6edf3]"
                      }`}
                    >
                      {RANGE_LABELS[key]}
                    </Link>
                  );
                })}
              </div>

              {/* Lens (client state) */}
              <div
                className="inline-flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5"
                role="group"
                aria-label="View lens"
              >
                {DATA_360_LENSES.map((key) => {
                  const active = key === lens;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setLens(key)}
                      className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                        active
                          ? "bg-white/[0.12] text-white"
                          : "text-[#8b94a7] hover:text-[#e6edf3]"
                      }`}
                    >
                      {LENS_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {activeTab === "overview" ? (
            <p className="-mt-1 text-[11.5px] text-[#5f6b80]">
              {LENS_LABELS[lens]} lens · {LENS_BLURBS[lens]}
            </p>
          ) : null}

          {/* Tabs */}
          <div className="-mx-1 overflow-x-auto">
            <div className="flex items-center gap-1 border-b border-white/10 px-1">
              {TABS.map((tab) => {
                const active = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative whitespace-nowrap px-3 py-2 text-[13px] font-medium transition-colors ${
                      active ? "text-white" : "text-[#8b94a7] hover:text-[#e6edf3]"
                    }`}
                  >
                    {tab.label}
                    {active ? (
                      <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[#8b3fe8]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active section */}
          <div>{renderSection()}</div>
        </div>
      </div>
    </div>
  );
}
