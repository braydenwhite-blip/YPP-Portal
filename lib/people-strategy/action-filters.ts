import type { ActionItemStatus, ActionItemVisibility } from "@prisma/client";

import type { ActionItemWithRelations } from "./action-queries";
import { effectiveDeadline, isActionOverdue } from "./my-actions-selectors";

/**
 * People Strategy — shared Action Tracker filter + sort logic.
 *
 * A single source of truth used by BOTH the `/all-actions` page and the CSV
 * export route so the list, the summary counts, the charts, and the exported
 * file always reflect exactly the same narrowed set of items.
 *
 * These are pure functions (no DB, no session) so they can be unit-tested and
 * reused on the server in either context.
 */

export type ActionStatusFilter = ActionItemStatus | "ALL";
export type ActionVisibilityFilter = ActionItemVisibility | "ALL";
export type ActionDeadlineSort = "deadline_asc" | "deadline_desc";

export type ActionFilters = {
  /** Department id, or "ALL". */
  department: string;
  /** Effective status (computed overdue overrides stored status), or "ALL". */
  status: ActionStatusFilter;
  visibility: ActionVisibilityFilter;
  /** Free-text search over title / description / lead. */
  search: string;
  sort: ActionDeadlineSort;
};

export const ACTION_FILTER_DEFAULTS: ActionFilters = {
  department: "ALL",
  status: "ALL",
  visibility: "ALL",
  search: "",
  sort: "deadline_asc",
};

/** Query-string keys used on `/all-actions` and the export route. */
export const ACTION_FILTER_PARAM_KEYS = {
  department: "dept",
  status: "status",
  visibility: "vis",
  search: "q",
  sort: "sort",
} as const;

const STATUS_VALUES: ActionItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETE",
  "OVERDUE",
];
const VISIBILITY_VALUES: ActionItemVisibility[] = [
  "ALL_LEADERSHIP",
  "OFFICERS_ONLY",
];

type RawParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/**
 * Parse untrusted query params into a validated `ActionFilters`. Unknown or
 * malformed values fall back to the "ALL" / default, so the page never throws
 * on a hand-edited URL.
 */
export function parseActionFilters(params: RawParams): ActionFilters {
  const status = firstValue(params[ACTION_FILTER_PARAM_KEYS.status]);
  const visibility = firstValue(params[ACTION_FILTER_PARAM_KEYS.visibility]);
  const department = firstValue(params[ACTION_FILTER_PARAM_KEYS.department]);
  const search = firstValue(params[ACTION_FILTER_PARAM_KEYS.search]) ?? "";
  const sort = firstValue(params[ACTION_FILTER_PARAM_KEYS.sort]);

  return {
    department: department && department.trim() ? department.trim() : "ALL",
    status: STATUS_VALUES.includes(status as ActionItemStatus)
      ? (status as ActionItemStatus)
      : "ALL",
    visibility: VISIBILITY_VALUES.includes(visibility as ActionItemVisibility)
      ? (visibility as ActionItemVisibility)
      : "ALL",
    search: search.trim(),
    sort: sort === "deadline_desc" ? "deadline_desc" : "deadline_asc",
  };
}

/** True when any filter is narrowing the view (used to show "Clear"). */
export function hasActiveFilters(filters: ActionFilters): boolean {
  return (
    filters.department !== "ALL" ||
    filters.status !== "ALL" ||
    filters.visibility !== "ALL" ||
    filters.search !== ""
  );
}

/**
 * The bucket an item belongs to for status filtering + the status chart:
 * COMPLETE wins; otherwise a past-due open item is OVERDUE; otherwise its
 * stored status. This is what makes "filter by Overdue" catch items whose
 * stored status is still IN_PROGRESS but whose deadline has passed, and keeps
 * the donut and the filter perfectly consistent.
 */
export function effectiveStatus(
  item: ActionItemWithRelations,
  now: Date = new Date()
): ActionItemStatus {
  if (item.status === "COMPLETE") return "COMPLETE";
  if (isActionOverdue(item, now)) return "OVERDUE";
  return item.status;
}

function matchesSearch(item: ActionItemWithRelations, needle: string): boolean {
  if (!needle) return true;
  const haystack = [
    item.title,
    item.description ?? "",
    item.department?.name ?? "",
    item.lead?.name ?? "",
    item.lead?.email ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle.toLowerCase());
}

/**
 * Apply filters + sort to a set of already-visibility-checked items. Pure and
 * deterministic — the same input always yields the same list/order, which is
 * what guarantees the page and the CSV agree.
 */
export function applyActionFilters(
  items: ActionItemWithRelations[],
  filters: ActionFilters,
  now: Date = new Date()
): ActionItemWithRelations[] {
  const filtered = items.filter((item) => {
    if (filters.department !== "ALL" && item.departmentId !== filters.department) {
      return false;
    }
    if (filters.status !== "ALL" && effectiveStatus(item, now) !== filters.status) {
      return false;
    }
    if (filters.visibility !== "ALL" && item.visibility !== filters.visibility) {
      return false;
    }
    if (!matchesSearch(item, filters.search)) return false;
    return true;
  });

  const dir = filters.sort === "deadline_desc" ? -1 : 1;
  return filtered.sort((a, b) => {
    const diff = effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime();
    if (diff !== 0) return diff * dir;
    // Stable tie-break so equal deadlines keep a deterministic order.
    return a.title.localeCompare(b.title);
  });
}

/** Serialize filters back to a query string (omitting defaults). */
export function buildActionFilterQuery(filters: ActionFilters): string {
  const params = new URLSearchParams();
  if (filters.department !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.department, filters.department);
  }
  if (filters.status !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.status, filters.status);
  }
  if (filters.visibility !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.visibility, filters.visibility);
  }
  if (filters.search) params.set(ACTION_FILTER_PARAM_KEYS.search, filters.search);
  if (filters.sort !== "deadline_asc") {
    params.set(ACTION_FILTER_PARAM_KEYS.sort, filters.sort);
  }
  return params.toString();
}
