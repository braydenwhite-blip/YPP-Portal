"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  ACTION_FILTER_PARAM_KEYS,
  ACTION_SOURCE_LABELS,
  type ActionFilters,
} from "@/lib/people-strategy/action-filters";
import {
  ACTION_STATUS_LABELS,
  ACTION_STATUS_VALUES,
  ACTION_VISIBILITY_LABELS,
  RELATED_ENTITY_TYPE_VALUES,
  relatedEntityTypeLabel,
} from "@/lib/people-strategy/constants";
import {
  ACTION_TYPE_LABELS,
  ACTION_TYPE_VALUES,
} from "@/lib/people-strategy/action-types";

type DepartmentOption = { id: string; name: string };

const STATUS_OPTIONS = ACTION_STATUS_VALUES;
const VISIBILITY_OPTIONS = ["ALL_LEADERSHIP", "OFFICERS_ONLY"] as const;

/**
 * Action Tracker filter row. Drives the view entirely through the URL query
 * string so the server page, the analytics, and the CSV export all read the
 * exact same filters. Each control pushes a new query; the search box submits
 * on Enter (or via its button).
 */
const PRESERVE_PARAMS = ["who", "view", "initiative", "lane"] as const;

export function ActionFiltersBar({
  departments,
  filters,
  hasActive,
  basePath = "/actions/all",
  variant = "full",
}: {
  departments: DepartmentOption[];
  filters: ActionFilters;
  hasActive: boolean;
  /** Where filter changes navigate (defaults to legacy export table). */
  basePath?: string;
  /** Hub variant matches the Actions Hub mockup — fewer controls. */
  variant?: "full" | "hub";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(filters.search);
  const hub = variant === "hub";

  // Keep the local input in sync if the URL changes elsewhere (e.g. Clear).
  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  function pushParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") params.set(key, value);
    else params.delete(key);
    navigate(params);
  }

  function clearFilters() {
    const params = new URLSearchParams();
    for (const key of PRESERVE_PARAMS) {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    }
    navigate(params);
  }

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    pushParam(ACTION_FILTER_PARAM_KEYS.search, search.trim());
  }

  return (
    <div className={hub ? "flex flex-wrap items-center justify-end gap-2" : "ps-filter-bar"}>
      <select
        className={hub ? "h-9 rounded-[9px] border border-line-soft bg-surface px-3 text-[13px] font-semibold text-ink" : "ps-filter"}
        aria-label="Filter by department"
        value={filters.department}
        onChange={(e) => pushParam(ACTION_FILTER_PARAM_KEYS.department, e.target.value)}
      >
        <option value="ALL">All departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      {!hub ? (
      <select
        className="ps-filter"
        aria-label="Filter by status"
        value={filters.status}
        onChange={(e) => pushParam(ACTION_FILTER_PARAM_KEYS.status, e.target.value)}
      >
        <option value="ALL">All statuses</option>
        {STATUS_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {ACTION_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      ) : null}

      <select
        className={hub ? "h-9 rounded-[9px] border border-line-soft bg-surface px-3 text-[13px] font-semibold text-ink" : "ps-filter"}
        aria-label="Filter by visibility"
        value={filters.visibility}
        onChange={(e) => pushParam(ACTION_FILTER_PARAM_KEYS.visibility, e.target.value)}
      >
        <option value="ALL">All visibility</option>
        {VISIBILITY_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {ACTION_VISIBILITY_LABELS[v]}
          </option>
        ))}
      </select>

      {!hub ? (
      <>
      <select
        className="ps-filter"
        aria-label="Filter by action type"
        value={filters.actionType}
        onChange={(e) => pushParam(ACTION_FILTER_PARAM_KEYS.actionType, e.target.value)}
      >
        <option value="ALL">All types</option>
        {ACTION_TYPE_VALUES.map((t) => (
          <option key={t} value={t}>
            {ACTION_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <select
        className="ps-filter"
        aria-label="Filter by linked item"
        value={filters.relatedType}
        onChange={(e) => pushParam(ACTION_FILTER_PARAM_KEYS.relatedType, e.target.value)}
      >
        <option value="ALL">All linked items</option>
        {RELATED_ENTITY_TYPE_VALUES.map((t) => (
          <option key={t} value={t}>
            {relatedEntityTypeLabel(t)}
          </option>
        ))}
      </select>

      <select
        className="ps-filter"
        aria-label="Filter by source"
        value={filters.source}
        onChange={(e) => pushParam(ACTION_FILTER_PARAM_KEYS.source, e.target.value)}
      >
        <option value="ALL">Any source</option>
        <option value="meeting">{ACTION_SOURCE_LABELS.meeting}</option>
        <option value="manual">{ACTION_SOURCE_LABELS.manual}</option>
      </select>
      </>
      ) : null}

      {!hub ? (
      <select
        className="ps-filter"
        aria-label="Sort by deadline"
        value={filters.sort}
        onChange={(e) => pushParam(ACTION_FILTER_PARAM_KEYS.sort, e.target.value)}
      >
        <option value="deadline_asc">Deadline ↑ (soonest)</option>
        <option value="deadline_desc">Deadline ↓ (latest)</option>
      </select>
      ) : null}

      <form onSubmit={submitSearch} className={hub ? "flex items-center gap-2" : "ps-filter-search"}>
        <input
          className={hub ? "h-9 min-w-[180px] rounded-[9px] border border-line-soft bg-surface px-3 text-[13px] text-ink" : "ps-filter"}
          type="search"
          placeholder="Search actions…"
          aria-label="Search actions"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {!hub ? (
          <button type="submit" className="button outline small">
            Search
          </button>
        ) : null}
      </form>

      {hasActive ? (
        <button
          type="button"
          className={hub ? "h-9 rounded-[9px] border border-line-soft bg-surface px-3 text-[13px] font-semibold text-ink-muted" : "button outline small"}
          onClick={clearFilters}
        >
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
