"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import { cn } from "@/components/ui-v2";

const selectClass =
  "h-9 min-w-0 flex-1 rounded-[8px] border border-line bg-surface px-2.5 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400 sm:max-w-[180px] sm:flex-none";

function chipClass(active: boolean, tone: "warning" | "brand" = "brand") {
  return cn(
    "cursor-pointer rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors duration-100",
    active
      ? tone === "warning"
        ? "border-warning-600 bg-amber-50 text-warning-600"
        : "border-brand-600 bg-brand-50 text-brand-700"
      : "border-line bg-surface text-ink-muted hover:bg-surface-soft hover:text-ink"
  );
}

const TRACK_OPTIONS = [
  { value: "", label: "All types" },
  { value: "standard", label: "Standard" },
  { value: "summer_workshop", label: "Summer workshop" },
] as const;

type FilterUser = { id: string; name: string | null; email: string };

interface ApplicantCommandFiltersProps {
  isAdmin?: boolean;
  chapters?: Array<{ id: string; name: string }>;
  reviewers?: FilterUser[];
  interviewers?: FilterUser[];
  actorId?: string;
}

function filterLabel(
  key: string,
  value: string,
  chapters: Array<{ id: string; name: string }>,
  reviewers: FilterUser[],
  interviewers: FilterUser[]
): string {
  switch (key) {
    case "chapterId":
      return chapters.find((c) => c.id === value)?.name ?? "Chapter";
    case "reviewerId":
      return reviewers.find((r) => r.id === value)?.name ?? reviewers.find((r) => r.id === value)?.email ?? "Reviewer";
    case "interviewerId":
      return interviewers.find((i) => i.id === value)?.name ?? interviewers.find((i) => i.id === value)?.email ?? "Interviewer";
    case "source":
      return (
        {
          portal: "Portal",
          google_forms: "Google Forms",
          csv_import: "CSV import",
          manual: "Manual entry",
        }[value] ?? value
      );
    case "track":
      return TRACK_OPTIONS.find((o) => o.value === value)?.label ?? value;
    case "overdueOnly":
      return "Overdue";
    case "myCasesOnly":
      return "My cases";
    default:
      return value;
  }
}

export default function ApplicantCommandFilters({
  isAdmin = false,
  chapters = [],
  reviewers = [],
  interviewers = [],
  actorId,
}: ApplicantCommandFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const getParam = (key: string) => searchParams.get(key) ?? "";

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const toggleParam = useCallback(
    (key: string) => {
      const current = searchParams.get(key);
      setParam(key, current ? "" : "1");
    },
    [searchParams, setParam]
  );

  const activeTrack = getParam("track").toLowerCase();
  const overdueOnly = searchParams.get("overdueOnly") === "1";
  const myCasesOnly = searchParams.get("myCasesOnly") === "1";

  const activeFilters = useMemo(() => {
    const entries: Array<{ key: string; value: string }> = [];
    for (const key of ["chapterId", "reviewerId", "interviewerId", "source", "track"] as const) {
      const value = getParam(key);
      if (value) entries.push({ key, value });
    }
    if (overdueOnly) entries.push({ key: "overdueOnly", value: "1" });
    if (myCasesOnly) entries.push({ key: "myCasesOnly", value: "1" });
    return entries;
  }, [getParam, myCasesOnly, overdueOnly]);

  const clearFilters = useCallback(() => {
    const params = new URLSearchParams();
    const view = searchParams.get("view") ?? searchParams.get("tab");
    if (view) params.set("view", view);
    startTransition(() => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }, [pathname, router, searchParams]);

  return (
    <div className="mb-3 rounded-[12px] border border-line-soft bg-surface p-3">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-[13px] font-semibold text-ink">Filters</p>
        {activeFilters.length > 0 ? (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[12px] font-semibold text-brand-700 hover:text-brand-800"
          >
            Clear all
          </button>
        ) : (
          <span className="text-[12px] text-ink-muted">Showing everyone on the board</span>
        )}
      </div>

      <div
        role="group"
        aria-label="Applicant type"
        className="mb-2.5 flex flex-wrap items-center gap-1.5"
      >
        {TRACK_OPTIONS.map((opt) => {
          const active = activeTrack === opt.value;
          return (
            <button
              key={opt.value || "all"}
              type="button"
              onClick={() => setParam("track", opt.value)}
              aria-pressed={active}
              className={chipClass(active)}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {isAdmin && chapters.length > 0 && (
          <select
            className={selectClass}
            aria-label="Chapter"
            value={getParam("chapterId")}
            onChange={(e) => setParam("chapterId", e.target.value)}
          >
            <option value="">All chapters</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {reviewers.length > 0 && (
          <select
            className={selectClass}
            aria-label="Reviewer"
            value={getParam("reviewerId")}
            onChange={(e) => setParam("reviewerId", e.target.value)}
          >
            <option value="">Any reviewer</option>
            {reviewers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name ?? r.email}
              </option>
            ))}
          </select>
        )}

        {interviewers.length > 0 && (
          <select
            className={selectClass}
            aria-label="Interviewer"
            value={getParam("interviewerId")}
            onChange={(e) => setParam("interviewerId", e.target.value)}
          >
            <option value="">Any interviewer</option>
            {interviewers.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name ?? i.email}
              </option>
            ))}
          </select>
        )}

        <select
          className={selectClass}
          aria-label="Application source"
          value={getParam("source")}
          onChange={(e) => setParam("source", e.target.value)}
        >
          <option value="">Any source</option>
          <option value="portal">Portal</option>
          <option value="google_forms">Google Forms</option>
          <option value="csv_import">CSV import</option>
          <option value="manual">Manual entry</option>
        </select>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={overdueOnly}
          className={chipClass(overdueOnly, "warning")}
          onClick={() => toggleParam("overdueOnly")}
        >
          Overdue only
        </button>

        {actorId ? (
          <button
            type="button"
            aria-pressed={myCasesOnly}
            className={chipClass(myCasesOnly)}
            onClick={() => toggleParam("myCasesOnly")}
          >
            My cases only
          </button>
        ) : null}
      </div>

      {activeFilters.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.05em] text-ink-muted">
            Active
          </span>
          {activeFilters.map(({ key, value }) => (
            <button
              key={`${key}-${value}`}
              type="button"
              onClick={() => setParam(key, "")}
              className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700 hover:bg-brand-100"
            >
              {filterLabel(key, value, chapters, reviewers, interviewers)}
              <span aria-hidden className="text-brand-500">
                ×
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
