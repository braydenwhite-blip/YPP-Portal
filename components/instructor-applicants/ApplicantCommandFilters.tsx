"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import { cn } from "@/components/ui-v2";
import {
  PIPELINE_STAGE_FILTERS,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STATUS_LABELS,
} from "./ApplicantPipelineCard";

const selectClass =
  "h-8 min-w-0 max-w-full rounded-[8px] border border-line bg-surface px-2.5 text-[12.5px] text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400 sm:w-auto";

const KIND_OPTIONS = [
  { value: "", label: "All Roles" },
  { value: "instructor", label: "Instructor" },
  { value: "cp", label: "Chapter President" },
  { value: "staff", label: "Social Media Manager" },
] as const;

const TRACK_OPTIONS = [
  { value: "", label: "All Instructor Tracks" },
  { value: "standard", label: "Full Instructor" },
  { value: "summer_workshop", label: "Summer Workshop" },
] as const;

interface ApplicantCommandFiltersProps {
  isAdmin?: boolean;
  chapters?: Array<{ id: string; name: string }>;
  /** When false, hide the Instructor / CP role filter (chapter-lead instructor-only boards). */
  showKindFilter?: boolean;
}

function filterLabel(
  key: string,
  value: string,
  chapters: Array<{ id: string; name: string }>
): string {
  switch (key) {
    case "chapterId":
      return chapters.find((c) => c.id === value)?.name ?? "Chapter";
    case "kind":
      return KIND_OPTIONS.find((o) => o.value === value)?.label ?? value;
    case "track":
      return TRACK_OPTIONS.find((o) => o.value === value)?.label ?? value;
    case "status":
      return PIPELINE_STAGE_LABELS[value] ?? PIPELINE_STATUS_LABELS[value] ?? value;
    default:
      return value;
  }
}

export default function ApplicantCommandFilters({
  isAdmin = false,
  chapters = [],
  showKindFilter = false,
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
      // Instructor track only applies to instructor apps.
      if (key === "kind" && (value === "cp" || value === "staff")) {
        params.delete("track");
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const chapterId = getParam("chapterId");
  const kind = getParam("kind").toLowerCase();
  const track = getParam("track").toLowerCase();
  const status = getParam("status");
  const showTrack = kind !== "cp" && kind !== "staff";

  const activeFilters = useMemo(() => {
    const entries: Array<{ key: string; value: string }> = [];
    for (const key of ["kind", "status", "track", "chapterId"] as const) {
      const value = getParam(key);
      if (value) entries.push({ key, value });
    }
    return entries;
  }, [getParam]);

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
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {showKindFilter ? (
        <select
          className={cn(selectClass, "sm:min-w-[9rem]")}
          aria-label="Applicant role"
          value={
            kind === "instructor" || kind === "cp" || kind === "staff" ? kind : ""
          }
          onChange={(e) => setParam("kind", e.target.value)}
        >
          {KIND_OPTIONS.map((opt) => (
            <option key={opt.value || "all-roles"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}

      <select
        className={cn(selectClass, "sm:min-w-[8rem]")}
        aria-label="Stage"
        value={PIPELINE_STAGE_LABELS[status] ? status : ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        {PIPELINE_STAGE_FILTERS.map((opt) => (
          <option key={opt.value || "all-stages"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {showTrack ? (
        <select
          className={cn(selectClass, "sm:min-w-[9rem]")}
          aria-label="Instructor track"
          value={track}
          onChange={(e) => setParam("track", e.target.value)}
        >
          {TRACK_OPTIONS.map((opt) => (
            <option key={opt.value || "all-tracks"} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}

      {isAdmin && chapters.length > 0 ? (
        <select
          className={cn(selectClass, "sm:min-w-[8rem]")}
          aria-label="Chapter"
          value={chapterId}
          onChange={(e) => setParam("chapterId", e.target.value)}
        >
          <option value="">All Chapters</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}

      {activeFilters.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilters.map(({ key, value }) => (
              <button
                key={`${key}-${value}`}
                type="button"
                onClick={() => setParam(key, "")}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-surface-soft px-2 text-[11.5px] font-medium text-ink-muted hover:border-brand-300 hover:text-brand-800"
              >
                {filterLabel(key, value, chapters)}
                <span aria-hidden>×</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="h-8 text-[12.5px] font-semibold text-brand-700 hover:text-brand-800"
          >
            Clear
          </button>
        </>
      ) : null}
    </div>
  );
}
