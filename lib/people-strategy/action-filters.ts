import type {
  ActionItemStatus,
  ActionItemVisibility,
  ActionPriority,
} from "@prisma/client";

import {
  ACTION_PRIORITY_VALUES,
  ACTION_PRIORITY_WEIGHT,
  RELATED_ENTITY_TYPE_VALUES,
  relatedEntityTypeLabel,
  type RelatedEntityType,
} from "./constants";
import { ACTION_TYPE_VALUES, type ActionType } from "./action-types";
import type { ActionItemWithRelations } from "./action-queries";
import { effectiveDeadline, isActionOverdue } from "./my-actions-selectors";
import { addDays, startOfDay } from "@/lib/leadership-action-center/dates";

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
export type ActionTypeFilter = ActionType | "ALL";
export type ActionDeadlineSort = "deadline_asc" | "deadline_desc" | "priority_desc";

/**
 * Where an action came from: generated from a meeting (carries officerMeetingId)
 * vs. created by hand. Lets leadership separate "what our meetings put on the
 * team" from ad-hoc work — the core of making meetings + actions feel connected.
 */
export type ActionSourceFilter = "ALL" | "meeting" | "manual";
export const ACTION_SOURCE_LABELS: Record<Exclude<ActionSourceFilter, "ALL">, string> = {
  meeting: "From a meeting",
  manual: "Created manually",
};

/**
 * Strategic one-click "view presets" surfaced as chips on the Action Tracker
 * (and as quick links on the Command Center). Each is a saved *lens* over the
 * existing filter pipeline — it narrows the same already-visibility-checked
 * items, so the list, counts, charts, and CSV export all stay in agreement.
 * Kept as a TEXT vocabulary (no Prisma enum) per house style.
 */
export const ACTION_PRESET_VALUES = [
  "unassigned",
  "due_soon",
  "high_priority",
  "blocked",
  "waiting",
] as const;
export type ActionPreset = (typeof ACTION_PRESET_VALUES)[number];
export type ActionPresetFilter = ActionPreset | "ALL";

export const ACTION_PRESET_LABELS: Record<ActionPreset, string> = {
  unassigned: "Unassigned",
  due_soon: "Due soon",
  high_priority: "High priority",
  blocked: "Blocked",
  waiting: "Waiting",
};

/** One-line "what this lens shows", used as chip tooltips + a11y descriptions. */
export const ACTION_PRESET_DESCRIPTIONS: Record<ActionPreset, string> = {
  unassigned: "Open actions with no lead owner yet",
  due_soon: "Open actions due within the next 7 days",
  high_priority: "Open High or Urgent priority actions",
  blocked: "Actions that are currently blocked",
  waiting: "Open actions waiting on someone's requested input",
};

/** Number of days ahead the "Due soon" lens looks (mirrors the urgency buckets). */
export const ACTION_DUE_SOON_DAYS = 7;

export type ActionPresetMeta = {
  value: ActionPreset;
  label: string;
  description: string;
};

/** Ordered preset metadata for rendering chip rows on either surface. */
export const ACTION_PRESETS: readonly ActionPresetMeta[] = ACTION_PRESET_VALUES.map(
  (value) => ({
    value,
    label: ACTION_PRESET_LABELS[value],
    description: ACTION_PRESET_DESCRIPTIONS[value],
  })
);

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
  /** Action type (OUTREACH / FOLLOW_UP / PARTNERSHIP / …), or "ALL". */
  actionType: ActionTypeFilter;
  /** Origin: meeting-generated / manual, or "ALL". */
  source: ActionSourceFilter;
  /** Free-text search over title / description / lead. */
  search: string;
  sort: ActionDeadlineSort;
  /** Strategic one-click view preset (Unassigned / Due soon / …), or "ALL". */
  preset: ActionPresetFilter;
};

export const ACTION_FILTER_DEFAULTS: ActionFilters = {
  department: "ALL",
  status: "ALL",
  priority: "ALL",
  visibility: "ALL",
  relatedType: "ALL",
  actionType: "ALL",
  source: "ALL",
  search: "",
  sort: "deadline_asc",
  preset: "ALL",
};

/** Query-string keys used on `/all-actions` and the export route. */
export const ACTION_FILTER_PARAM_KEYS = {
  department: "dept",
  status: "status",
  priority: "priority",
  visibility: "vis",
  relatedType: "rel",
  actionType: "type",
  source: "source",
  search: "q",
  sort: "sort",
  preset: "preset",
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
  const actionType = firstValue(params[ACTION_FILTER_PARAM_KEYS.actionType]);
  const source = firstValue(params[ACTION_FILTER_PARAM_KEYS.source]);
  const search = firstValue(params[ACTION_FILTER_PARAM_KEYS.search]) ?? "";
  const sort = firstValue(params[ACTION_FILTER_PARAM_KEYS.sort]);
  const preset = firstValue(params[ACTION_FILTER_PARAM_KEYS.preset]);

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
    actionType: (ACTION_TYPE_VALUES as readonly string[]).includes(
      actionType as ActionType
    )
      ? (actionType as ActionType)
      : "ALL",
    source: source === "meeting" || source === "manual" ? source : "ALL",
    search: search.trim(),
    sort:
      sort === "deadline_desc"
        ? "deadline_desc"
        : sort === "priority_desc"
          ? "priority_desc"
          : "deadline_asc",
    preset: (ACTION_PRESET_VALUES as readonly string[]).includes(
      preset as ActionPreset
    )
      ? (preset as ActionPreset)
      : "ALL",
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
    filters.actionType !== "ALL" ||
    filters.source !== "ALL" ||
    filters.preset !== "ALL" ||
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

/**
 * Does an item belong to a strategic preset lens? Pure and composable: it is
 * AND-ed on top of the granular filters in {@link applyActionFilters}, so a
 * preset can be combined with (e.g.) a department filter. Each lens is a
 * "needs attention" read, so settled work (COMPLETE / DROPPED) is excluded by
 * every preset. "ALL" matches everything (no preset active).
 */
export function matchesActionPreset(
  item: ActionItemWithRelations,
  preset: ActionPresetFilter,
  now: Date = new Date()
): boolean {
  if (preset === "ALL") return true;
  if (item.status === "COMPLETE" || item.status === "DROPPED") return false;

  switch (preset) {
    case "unassigned":
      // No lead owner — surfaces work that still needs someone to own it.
      return item.leadId == null;
    case "due_soon": {
      // Open and landing within the next 7 days, but not yet overdue (overdue
      // has its own lens). Mirrors the "due today + this week" urgency buckets.
      if (isActionOverdue(item, now)) return false;
      const due = startOfDay(effectiveDeadline(item)).getTime();
      const windowEnd = startOfDay(addDays(now, ACTION_DUE_SOON_DAYS)).getTime();
      return due <= windowEnd;
    }
    case "high_priority":
      return ACTION_PRIORITY_WEIGHT[item.priority] >= ACTION_PRIORITY_WEIGHT.HIGH;
    case "blocked":
      return effectiveStatus(item, now) === "BLOCKED";
    case "waiting":
      return smartBucket(item, now) === "WAITING";
    default:
      return true;
  }
}

/** Count how many items fall into each preset lens (for the chip badges). */
export function countActionPresets(
  items: ActionItemWithRelations[],
  now: Date = new Date()
): Record<ActionPreset, number> {
  const counts: Record<ActionPreset, number> = {
    unassigned: 0,
    due_soon: 0,
    high_priority: 0,
    blocked: 0,
    waiting: 0,
  };
  for (const item of items) {
    for (const preset of ACTION_PRESET_VALUES) {
      if (matchesActionPreset(item, preset, now)) counts[preset] += 1;
    }
  }
  return counts;
}

/** Canonical Action Tracker URL for a strategic preset on its own (no other filters). */
export function actionPresetHref(preset: ActionPreset): string {
  return `/actions/all?${ACTION_FILTER_PARAM_KEYS.preset}=${preset}`;
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
    if (filters.actionType !== "ALL" && item.actionType !== filters.actionType) {
      return false;
    }
    // The legacy meeting-source link column has been removed; the "from a
    // meeting" lens can no longer match anything, and "manual" matches every
    // item that isn't otherwise excluded.
    if (filters.source === "meeting") return false;
    if (!matchesActionPreset(item, filters.preset, now)) return false;
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
  if (filters.preset !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.preset, filters.preset);
  }
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
  if (filters.actionType !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.actionType, filters.actionType);
  }
  if (filters.source !== "ALL") {
    params.set(ACTION_FILTER_PARAM_KEYS.source, filters.source);
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

/** Just enough of a resolved entity to title its group. */
export type LinkedEntityDisplay = { label: string; typeLabel: string };

/**
 * Human heading for a {@link groupActionsByLinkedEntity} group, using the linked
 * entity's OWN name plus its type ("Algebra 101 · Class") when it could be
 * resolved (via a batch label loader). Falls back to the bare type label for a
 * dangling link whose target no longer exists, and to "Not linked" for the
 * unlinked bucket. Pure — the page passes in an already-loaded label map, so
 * this stays unit-testable with a plain Map.
 */
export function linkedGroupHeading(
  group: LinkedEntityGroup,
  labels: ReadonlyMap<string, LinkedEntityDisplay>
): string {
  if (group.relatedType == null || group.relatedId == null) return "Not linked";
  const display = labels.get(group.key);
  if (display) return `${display.label} · ${display.typeLabel}`;
  return `${relatedEntityTypeLabel(group.relatedType)} · link no longer available`;
}
