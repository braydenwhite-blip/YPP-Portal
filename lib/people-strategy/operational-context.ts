import {
  MEETING_CATEGORY_VALUES,
  meetingCategoryLabel,
  type MeetingCategory,
} from "./meeting-categories";
import {
  isRelatedEntityType,
  RELATED_ENTITY_TYPE_VALUES,
  relatedEntityTypeLabel,
  type RelatedEntityType,
} from "./constants";

/**
 * People Strategy Operating System — Operational Context foundation.
 *
 * This is the canonical, pure (no DB, no session, no React) vocabulary that lets
 * meetings, actions, and follow-ups speak one shared language about WHICH part of
 * YPP they belong to. The two existing axes the prior passes shipped are joined
 * here for the first time:
 *
 *   - "Operational area" — the YPP operating area (Classes, Mentorship, …). This
 *     is exactly the {@link MeetingCategory} vocabulary a meeting already carries
 *     in `OfficerMeeting.category`; we re-export it under an operations-neutral
 *     name so an action / follow-up / dashboard can talk about an "area" without
 *     anyone thinking it is meetings-only.
 *   - "Related entity" — the concrete domain object a meeting / action points at
 *     (a class, a mentorship, a person, …), the {@link RelatedEntityType} the
 *     polymorphic `relatedEntityType` columns already use.
 *
 * The bridge functions below map between the two so a single class page, a single
 * area pulse, or a single operations rollup can pull BOTH the meetings (linked by
 * category/entity) AND the actions (linked by entity/department) that belong to
 * it. Kept dependency-free so the client forms, the cards, the server queries,
 * and the unit tests can all share one source of truth.
 */

// --- operational area (the YPP operating area) ------------------------------

/** An operational area is the canonical YPP operating area — the meeting category. */
export type OperationalArea = MeetingCategory;

/** Every operational area, in the canonical display order. */
export const OPERATIONAL_AREA_VALUES = MEETING_CATEGORY_VALUES;

/** Human label for an operational area, falling back to "Other" then the raw value. */
export function operationalAreaLabel(value: string | null | undefined): string {
  return meetingCategoryLabel(value);
}

// --- area <-> related-entity bridge -----------------------------------------

/**
 * The operational AREA a concrete related-entity type rolls up to. Lets an
 * action that is linked to a class ("this belongs to a class") also answer "this
 * belongs to the Classes area" without a second field. A USER link is genuinely
 * cross-cutting (a person can touch any area), so it defaults to LEADERSHIP —
 * the home of people / accountability work — and callers that know better (an
 * action with its own department / a meeting with its own category) should
 * prefer that more-specific signal over this default.
 */
const AREA_BY_RELATED_ENTITY: Record<RelatedEntityType, OperationalArea> = {
  CLASS_OFFERING: "CLASSES",
  MENTORSHIP: "MENTORSHIP",
  USER: "LEADERSHIP",
  INSTRUCTOR_APPLICATION: "APPLICATIONS",
  PARTNER: "PARTNERSHIPS",
};

/** The operational area a related-entity type belongs to (LEADERSHIP for a person). */
export function areaForRelatedEntityType(type: RelatedEntityType): OperationalArea {
  return AREA_BY_RELATED_ENTITY[type];
}

/**
 * The PRIMARY shipped related-entity type for an area, or null when the area has
 * no concrete polymorphic entity (Chapters / Marketing / Technology / Operations
 * / Finance link by meeting category + department, not by a related-entity row).
 * Used by an "area context" loader to know which entity rows to fan out over.
 */
const PRIMARY_ENTITY_BY_AREA: Partial<Record<OperationalArea, RelatedEntityType>> = {
  CLASSES: "CLASS_OFFERING",
  MENTORSHIP: "MENTORSHIP",
  APPLICATIONS: "INSTRUCTOR_APPLICATION",
  PARTNERSHIPS: "PARTNER",
  INSTRUCTORS: "USER",
  LEADERSHIP: "USER",
};

/** The primary related-entity type an area maps to, or null when it has none. */
export function primaryEntityTypeForArea(
  area: OperationalArea
): RelatedEntityType | null {
  return PRIMARY_ENTITY_BY_AREA[area] ?? null;
}

/**
 * Best-effort normalization of a free-text related-entity hint (e.g. a `relatedType`
 * query param on `/actions/new`, or a casual "class" / "course" / "partner") to a
 * canonical {@link RelatedEntityType}. Matches the enum value, the label, and a
 * small synonym table, all case-insensitively. Returns null when nothing fits, so
 * a bad hint never produces a bogus link. Pure + unit-tested.
 */
const RELATED_ENTITY_SYNONYMS: Record<string, RelatedEntityType> = {
  class: "CLASS_OFFERING",
  classes: "CLASS_OFFERING",
  course: "CLASS_OFFERING",
  offering: "CLASS_OFFERING",
  mentorship: "MENTORSHIP",
  mentor: "MENTORSHIP",
  mentee: "MENTORSHIP",
  match: "MENTORSHIP",
  user: "USER",
  person: "USER",
  member: "USER",
  people: "USER",
  instructor: "USER",
  application: "INSTRUCTOR_APPLICATION",
  applicant: "INSTRUCTOR_APPLICATION",
  partner: "PARTNER",
  partnership: "PARTNER",
  school: "PARTNER",
};

export function normalizeRelatedEntityType(
  value: string | null | undefined
): RelatedEntityType | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (isRelatedEntityType(upper)) return upper;
  const lower = raw.toLowerCase();
  for (const type of RELATED_ENTITY_TYPE_VALUES) {
    if (relatedEntityTypeLabel(type).toLowerCase() === lower) return type;
  }
  return RELATED_ENTITY_SYNONYMS[lower] ?? null;
}

// --- operational health ------------------------------------------------------

/**
 * A four-step operating-health read for any surface (an entity, an area, an
 * owner). Deterministic and computed from raw signal counts — never AI-generated
 * — so the same inputs always yield the same badge.
 */
export type OperationalHealthLevel =
  | "healthy"
  | "attention"
  | "at_risk"
  | "critical";

/** Tone vocabulary shared with the `Pill` primitive (a subset of PillTone). */
export type OperationalHealthTone = "success" | "info" | "warning" | "overdue";

export type OperationalHealthMeta = {
  label: string;
  tone: OperationalHealthTone;
  /** Higher = more concerning. Lets callers sort areas worst-first. */
  rank: number;
};

export const OPERATIONAL_HEALTH_LEVELS: Record<
  OperationalHealthLevel,
  OperationalHealthMeta
> = {
  healthy: { label: "Healthy", tone: "success", rank: 0 },
  attention: { label: "Needs attention", tone: "info", rank: 1 },
  at_risk: { label: "At risk", tone: "warning", rank: 2 },
  critical: { label: "Critical", tone: "overdue", rank: 3 },
};

/**
 * Raw operating signals for one surface. Every field is optional and treated as
 * 0 when absent, so a caller only has to pass the signals it actually has (a
 * class page knows its actions; an area pulse also knows its meetings).
 */
export type OperationalHealthSignals = {
  openActions?: number;
  overdueActions?: number;
  blockedActions?: number;
  /** Open actions with no executor / lead — work nobody owns. */
  unassignedActions?: number;
  /** Open actions with no recent activity (stale). */
  staleActions?: number;
  openFollowUps?: number;
  overdueFollowUps?: number;
  /** Completed meetings that still have unresolved follow-ups. */
  meetingsNeedingFollowUp?: number;
};

export type OperationalHealth = {
  level: OperationalHealthLevel;
  label: string;
  tone: OperationalHealthTone;
  /** 0–100, 100 = perfectly clear. Useful for ranking many surfaces. */
  score: number;
  /** Human-readable contributing reasons, worst-first. Empty when healthy. */
  reasons: string[];
};

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Compute a deterministic operating-health read from raw signal counts.
 *
 * Thresholds (documented so they can never silently drift):
 *   - critical  — 3+ overdue actions, OR 3+ overdue follow-ups, OR at least one
 *                 overdue action while 2+ items are blocked (overdue + stuck).
 *   - at risk   — any overdue action / overdue follow-up / blocked action, OR
 *                 3+ stale actions.
 *   - attention — there is open work, an unowned action, or a meeting whose
 *                 follow-ups are still unresolved.
 *   - healthy   — nothing open or concerning.
 *
 * Pure + unit-tested.
 */
export function computeOperationalHealth(
  signals: OperationalHealthSignals
): OperationalHealth {
  const openActions = Math.max(0, signals.openActions ?? 0);
  const overdueActions = Math.max(0, signals.overdueActions ?? 0);
  const blockedActions = Math.max(0, signals.blockedActions ?? 0);
  const unassignedActions = Math.max(0, signals.unassignedActions ?? 0);
  const staleActions = Math.max(0, signals.staleActions ?? 0);
  const openFollowUps = Math.max(0, signals.openFollowUps ?? 0);
  const overdueFollowUps = Math.max(0, signals.overdueFollowUps ?? 0);
  const meetingsNeedingFollowUp = Math.max(0, signals.meetingsNeedingFollowUp ?? 0);

  const reasons: string[] = [];
  if (overdueActions > 0) reasons.push(`${plural(overdueActions, "overdue action")}`);
  if (overdueFollowUps > 0) {
    reasons.push(`${plural(overdueFollowUps, "overdue follow-up")}`);
  }
  if (blockedActions > 0) reasons.push(`${plural(blockedActions, "blocked action")}`);
  if (staleActions > 0) reasons.push(`${plural(staleActions, "stale action")}`);
  if (unassignedActions > 0) {
    reasons.push(`${plural(unassignedActions, "unassigned action")}`);
  }
  if (meetingsNeedingFollowUp > 0) {
    reasons.push(`${plural(meetingsNeedingFollowUp, "meeting")} needing follow-up`);
  }
  if (openFollowUps > 0) reasons.push(`${plural(openFollowUps, "open follow-up")}`);
  if (openActions > 0) reasons.push(`${plural(openActions, "open action")}`);

  let level: OperationalHealthLevel;
  if (
    overdueActions >= 3 ||
    overdueFollowUps >= 3 ||
    (overdueActions >= 1 && blockedActions >= 2)
  ) {
    level = "critical";
  } else if (
    overdueActions >= 1 ||
    overdueFollowUps >= 1 ||
    blockedActions >= 1 ||
    staleActions >= 3
  ) {
    level = "at_risk";
  } else if (
    openActions >= 1 ||
    openFollowUps >= 1 ||
    unassignedActions >= 1 ||
    staleActions >= 1 ||
    meetingsNeedingFollowUp >= 1
  ) {
    level = "attention";
  } else {
    level = "healthy";
  }

  // Weighted penalty → 0–100 score. Overdue work is weighted heaviest; plain
  // open work barely moves the needle. Clamped so the score stays in range.
  const penalty =
    overdueActions * 14 +
    overdueFollowUps * 12 +
    blockedActions * 9 +
    staleActions * 5 +
    unassignedActions * 4 +
    meetingsNeedingFollowUp * 4 +
    openFollowUps * 2 +
    openActions * 1;
  const score = Math.max(0, Math.min(100, 100 - penalty));

  const meta = OPERATIONAL_HEALTH_LEVELS[level];
  return {
    level,
    label: meta.label,
    tone: meta.tone,
    score,
    reasons: level === "healthy" ? [] : reasons,
  };
}

/** Compare two health reads worst-first (critical before healthy). */
export function compareOperationalHealth(
  a: OperationalHealth,
  b: OperationalHealth
): number {
  const byRank =
    OPERATIONAL_HEALTH_LEVELS[b.level].rank - OPERATIONAL_HEALTH_LEVELS[a.level].rank;
  if (byRank !== 0) return byRank;
  return a.score - b.score;
}
