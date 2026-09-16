"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useState, useTransition } from "react";

import {
  PIPELINE_STAGE_FILTERS,
  PIPELINE_STAGE_LABELS,
} from "./ApplicantPipelineCard";

const selectClass =
  "h-10 min-w-[9.5rem] rounded-[10px] border border-brand-100 bg-white px-3 text-[13px] text-ink shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400";

const KIND_OPTIONS = [
  { value: "", label: "All roles" },
  { value: "instructor", label: "Instructor" },
  { value: "cp", label: "Chapter President" },
  { value: "staff", label: "Technology Manager" },
] as const;

interface ApplicantCommandFiltersProps {
  isAdmin?: boolean;
  chapters?: Array<{ id: string; name: string }>;
  showKindFilter?: boolean;
  resultCount?: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

export default function ApplicantCommandFilters({
  isAdmin = false,
  chapters = [],
  showKindFilter = false,
  resultCount,
  searchQuery,
  onSearchChange,
}: ApplicantCommandFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [draftSearch, setDraftSearch] = useState(searchQuery);
  const deferredSearch = useDeferredValue(draftSearch);

  useEffect(() => {
    setDraftSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (deferredSearch === searchQuery) return;
    onSearchChange(deferredSearch);
  }, [deferredSearch, onSearchChange, searchQuery]);

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      startTransition(() => {
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, searchParams]
  );

  const chapterId = searchParams.get("chapterId") ?? "";
  const kind = (searchParams.get("kind") ?? "").toLowerCase();
  const status = searchParams.get("status") ?? "";

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2.5">
      <label className="relative min-w-[14rem] flex-1 basis-[16rem]">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-ink-muted">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={draftSearch}
          onChange={(event) => setDraftSearch(event.target.value)}
          placeholder="Search applicants..."
          className="h-10 w-full rounded-[10px] border border-line-soft bg-white py-2 pl-9 pr-3 text-[13px] text-ink shadow-sm placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400"
        />
      </label>

      {showKindFilter ? (
        <select
          className={selectClass}
          aria-label="Role"
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
        className={selectClass}
        aria-label="Stage"
        value={PIPELINE_STAGE_LABELS[status] ? status : ""}
        onChange={(e) => setParam("status", e.target.value)}
      >
        {PIPELINE_STAGE_FILTERS.filter((opt) => opt.value !== "decided").map((opt) => (
          <option key={opt.value || "all-stages"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {isAdmin && chapters.length > 0 ? (
        <select
          className={selectClass}
          aria-label="Chapter or location"
          value={chapterId}
          onChange={(e) => setParam("chapterId", e.target.value)}
        >
          <option value="">All chapters / locations</option>
          {chapters.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      ) : null}

      {typeof resultCount === "number" ? (
        <span className="ml-auto text-[12.5px] font-medium text-ink-muted">
          {resultCount} result{resultCount === 1 ? "" : "s"}
        </span>
      ) : null}
    </div>
  );
}
