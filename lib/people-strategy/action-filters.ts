import type {
  ActionItemStatus,
  ActionItemVisibility,
  ActionPriority,
} from "@prisma/client";

import {
  ACTION_PRIORITY_VALUES,
  ACTION_PRIORITY_WEIGHT,
  RELATED_ENTITY_TYPE_VALUES,
  type RelatedEntityType,
} from "./constants";
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
export type ActionPriorityFilter = ActionPriority | "ALL";
export type ActionVisibilityFilter = ActionItemVisibility | "ALL";
export type ActionRelatedTypeFilter = RelatedEntityType | "ALL";
export type ActionDeadlineSort = "deadline_asc" | "deadline_desc" | "priority_desc";

export type ActionFilters = {
  /** Department id, or "ALL". */
  department: string;
  /** Effective status (computed overdue overrides stored status), or "ALL". */
  status: ActionStatusFilter;
  /** Priority, or "ALL". */
  priority: ActionPriorityFilter;
  visibility: ActionVisibilityFilter;
  /** Linked-entity type (CLASS_OFFERING / MENTORSHIP / USER / …), or "ALL". */
  relatedType: ActionRelatedTypeFilter;
  /** Free-text search over title / description / lead. */
  search: string;
  sort: ActionDeadlineSort;
};

export const ACTION_FILTER_DEFAULTS: ActionFilters = {
  department: "ALL",
  status: "ALL",
  priority: "ALL",
  visibility: "ALL",
  relatedType: "ALL",
  search: "",
  sort: "deadline_asc",
};

/** Query-string keys used on `/all-actions` and the export route. */
export const ACTION_FILTER_PARAM_KEYS = {
  department: "dept",
  status: "status",
  priority: "priority",
  visibility: "vis",
  relatedType: "rel",
  search: "q",
  sort: "sort",
} as const;

const STATUS_VALUES: ActionItemStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "BLOCKED",
  "COMPLETE",
  "OVERDUE",
  "DROPPED",
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
  const priority = firstValue(params[ACTION_FILTER_PARAM_KEYS.priority]);
  const visibility = firstValue(params[ACTION_FILTER_PARAM_KEYS.visibility]);
  const department = firstValue(params[ACTION_FILTER_PARAM_KEYS.department]);
  const relatedType = firstValue(params[ACTION_FILTER_PARAM_KEYS.relatedType]);
  const search = firstValue(params[ACTION_FILTER_PARAM_KEYS.search]) ?? "";
  const sort = firstValue(params[ACTION_FILTER_PARAM_KEYS.sort]);

  return {
    department: department && department.trim() ? department.trim() : "ALL",
    status: STATUS_VALUES.includes(status as ActionItemStatus)
      ? (status as ActionItemStatus)
      : "ALL",
    priority: ACTION_PRIORITY_VALUES.includes(priority as ActionPriority)
      ? (priority as ActionPriority)
      : "ALL",
    visibility: VISIBILITY_VALUES.includes(visibility as ActionItemVisibility)
      ? (visibility as ActionItemVisibility)
      : "ALL",
    relatedType: (RELATED_ENTITY_TYPE_VALUES as readonly string[]).includes(
      relatedType as RelatedEntityType
    )
      ? (relatedType as RelatedEntityType)
      : "ALL",
    search: search.trim(),
    sort:
      sort === "deadline_desc"
        ? "deadline_desc"
        : sort === "priority_desc"
          ? "priority_desc"
          : "deadline_asc",
  };
}

/** True when any filter is narrowing the view (used to show "Clear"). */
export function hasActiveFilters(filters: ActionFilters): boolean {
  return (
    filters.department !== "ALL" ||
    filters.status !== "ALL" ||
    filters.priority !== "ALL" ||
    filters.visibility !== "ALL" ||
    filters.relatedType !== "ALL" ||
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
  // Settled states win outright. BLOCKED is preserved over a computed OVERDUE so
  // "filter by Blocked" still finds a blocked item whose deadline has passed —
  // the blocker is the more actionable fact.
  if (item.status === "COMPLETE") return "COMPLETE";
  if (item.status === "DROPPED") return "DROPPED";
  if (item.status === "BLOCKED") return "BLOCKED";
  if (isActionOverdue(item, now)) return "OVERDUE";
  return item.status;
}

/**
 * Richer "Smart Status Bucket" for the My Commitments view + Command Center.
 * Layered on top of the stored status with two derived buckets the raw enum
 * cannot express:
 *   - NEEDS_DECISION — flagged for officer attention and not yet resolved.
 *   - WAITING        — someone has been asked for input (an INPUT_REQUESTED
 *                      comment exists) and the item is still open.
 * Precedence is most-actionable-first.
 */
export type SmartBucket =
  | "DROPPED"
  | "COMPLETE"
  | "NEEDS_DECISION"
  | "BLOCKED"
  | "OVERDUE"
  | "WAITING"
  | "IN_PROGRESS"
  | "NOT_STARTED";

export const SMART_BUCKET_LABELS: Record<SmartBucket, string> = {
  NEEDS_DECISION: "Needs decision",
  BLOCKED: "Blocked",
  OVERDUE: "Overdue",
  WAITING: "Waiting on input",
  IN_PROGRESS: "In progress",
  NOT_STARTED: "Not started",
  COMPLETE: "Complete",
  DROPPED: "Dropped",
};

/** Most-actionable-first ordering used to sort bucket groups in the UI. */
export const SMART_BUCKET_ORDER: SmartBucket[] = [
  "NEEDS_DECISION",
  "BLOCKED",
  "OVERDUE",
  "WAITING",
  "IN_PROGRESS",
  "NOT_STARTED",
  "COMPLETE",
  "DROPPED",
];

export function smartBucket(
  item: ActionItemWithRelations,
  now: Date = new Date()
): SmartBucket {
  if (item.status === "DROPPED") return "DROPPED";
  if (item.status === "COMPLETE") return "COMPLETE";
  if (item.flaggedAt != null && item.resolvedAt == null) return "NEEDS_DECISION";
  if (item.status === "BLOCKED") return "BLOCKED";
  if (isActionOverdue(item, now)) return "OVERDUE";
  if (item.comments.some((c) => c.type === "INPUT_REQUESTED")) return "WAITING";
  if (item.status === "IN_PROGRESS") return "IN_PROGRESS";
  return "NOT_STARTED";
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
    if (filters.priority !== "ALL" && item.priority !== filters.priority) {
      return false;
    }
    if (filters.visibility !== "ALL" && item.visibility !== filters.visibility) {
      return false;
    }
    if (
      filters.relatedType !== "ALL" &&
      item.relatedEntityType !== filters.relatedType
    ) {
      return false;
    }
    if (!matchesSearch(item, filters.search)) return false;
    return true;
  });

  if (filters.sort === "priority_desc") {
    return filtered.sort((a, b) => {
      const diff = ACTION_PRIORITY_WEIGHT[b.priority] - ACTION_PRIORITY_WEIGHT[a.priority];
      if (diff !== 0) return diff;
      // Within a priority, soonest deadline first, then a stable title tie-break.
      const byDeadline = effectiveDeadline(a).getTime() - effectiveDeadline(b).getTime();
      if (byDeadline !== 0) return byDeadline;
      return a.title.localeCompare(b.title);
    });
  }

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
  if (filters.priority !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.priority, filters.priority);
  }
  if (filters.visibility !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.visibility, filters.visibility);
  }
  if (filters.relatedType !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.relatedType, filters.relatedType);
  }
  if (filters.search) params.set(ACTION_FILTER_PARAM_KEYS.search, filters.search);
  if (filters.sort !== "deadline_asc") {
    params.set(ACTION_FILTER_PARAM_KEYS.sort, filters.sort);
  }
  return params.toString();
}

export type LinkedEntityGroup = {
  /** `${type}:${id}` for a linked group, or "none" for unlinked actions. */
  key: string;
  relatedType: RelatedEntityType | null;
  relatedId: string | null;
  items: ActionItemWithRelations[];
};

/**
 * Group actions by their linked entity for the Action Tracker "group by linked
 * entity" view. Actions with no link are collected under a single "unlinked"
 * group (key "none"), which is always ordered last. Linked groups keep the
 * order in which they first appear in `items` (so an upstream sort carries
 * through). Pure — unit-tested alongside the filters.
 */
export function groupActionsByLinkedEntity(
  items: ActionItemWithRelations[]
): LinkedEntityGroup[] {
  const NONE = "none";
  const groups = new Map<string, LinkedEntityGroup>();

  for (const item of items) {
    const hasLink = Boolean(item.relatedEntityType && item.relatedEntityId);
    const key = hasLink ? `${item.relatedEntityType}:${item.relatedEntityId}` : NONE;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        relatedType: hasLink ? (item.relatedEntityType as RelatedEntityType) : null,
        relatedId: hasLink ? item.relatedEntityId : null,
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return Array.from(groups.values()).sort((a, b) => {
    if (a.key === NONE) return 1;
    if (b.key === NONE) return -1;
    return 0;
  });
}
