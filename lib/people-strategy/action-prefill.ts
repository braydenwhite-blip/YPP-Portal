import type { ActionPriority } from "@prisma/client";

import {
  DEFAULT_ACTION_DEADLINE_DAYS,
  isRelatedEntityType,
  relatedEntityTypeLabel,
  type RelatedEntityType,
} from "./constants";
import { isMeetingCategory } from "./meeting-categories";
import { areaForRelatedEntityType } from "./operational-context";
import { type ActionType } from "./action-types";

/**
 * People Strategy Execution OS — Action creation prefill + duplicate detection.
 *
 * PURE helpers (no DB, no session, no React) that turn an operational source —
 * a meeting decision today; entities + meetings in the Phase 8 polish — into a
 * prefilled action shape, plus a deterministic "have we already done this?"
 * duplicate check. Shared by the `convertDecisionToAction` server action (which
 * builds its `createActionItem` input from the prefill) and the create-from-
 * context CTAs, so the mapping has one tested source of truth.
 */

export type ActionPrefill = {
  title?: string;
  description?: string;
  relatedType?: RelatedEntityType;
  relatedId?: string;
  sourceMeetingId?: string;
  /** Operating area / meeting category (stored as the action's goalCategory). */
  area?: string;
  actionType?: ActionType;
  priority?: ActionPriority;
  /** Suggested deadline offset in days from "now". */
  dueInDays?: number;
};

/** Query-string keys a prefilled `/actions/new` link uses. */
export const ACTION_PREFILL_PARAM_KEYS = {
  title: "title",
  description: "desc",
  relatedType: "relatedType",
  relatedId: "relatedId",
  sourceMeetingId: "fromMeeting",
  area: "area",
  actionType: "type",
  priority: "priority",
  dueInDays: "dueInDays",
} as const;

/** Max length of an action title derived from a longer decision / note body. */
export const DERIVED_TITLE_MAX = 140;

/** Title-similarity at or above which two actions are "likely the same work". */
export const DUPLICATE_TITLE_THRESHOLD = 0.6;

// --- title helpers -----------------------------------------------------------

/** Lowercase, strip punctuation, collapse whitespace — for stable comparison. */
export function normalizeActionTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Derive a concise, non-empty action title from a decision / note body. */
export function actionTitleFromDecision(decision: string): string {
  const firstLine = (decision ?? "").split(/\r?\n/)[0]?.trim() ?? "";
  if (!firstLine) return "Action from meeting decision";
  if (firstLine.length <= DERIVED_TITLE_MAX) return firstLine;
  return `${firstLine.slice(0, DERIVED_TITLE_MAX - 1).trimEnd()}…`;
}

function meaningfulTokens(value: string): Set<string> {
  return new Set(normalizeActionTitle(value).split(" ").filter((t) => t.length > 2));
}

/**
 * Similarity of two action titles in [0, 1]. Blends Jaccard token overlap with a
 * containment boost (so "Email Lincoln HS" vs "Email Lincoln High School about
 * the partnership" still reads as related). Deterministic + symmetric.
 */
export function titleSimilarity(a: string, b: string): number {
  const A = meaningfulTokens(a);
  const B = meaningfulTokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const union = A.size + B.size - inter;
  const jaccard = union === 0 ? 0 : inter / union;
  const smaller = A.size <= B.size ? A : B;
  const containment = inter / smaller.size;
  return Math.max(jaccard, containment * 0.9);
}

// --- decision → action prefill ----------------------------------------------

export type DecisionPrefillSource = {
  decision: string;
  rationale?: string | null;
  meetingId: string;
  meetingTitle?: string | null;
  meetingCategory?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

/**
 * Map a logged meeting decision to a prefilled action. The title is the decision
 * itself (truncated); the description carries the decision + rationale + a
 * provenance line; the source meeting, area, and any related entity are inherited
 * so the new action stays connected to where it came from. Owner is intentionally
 * left for the converter / form to resolve (never invented here).
 */
export function buildActionPrefillFromDecision(src: DecisionPrefillSource): ActionPrefill {
  const decision = (src.decision ?? "").trim();
  const parts: string[] = [];
  if (decision) parts.push(`Decision: ${decision}`);
  if (src.rationale && src.rationale.trim()) parts.push(`Rationale: ${src.rationale.trim()}`);
  parts.push(
    src.meetingTitle && src.meetingTitle.trim()
      ? `From the decision logged in “${src.meetingTitle.trim()}.”`
      : "From a logged meeting decision."
  );

  const hasEntity =
    !!src.relatedEntityType &&
    isRelatedEntityType(src.relatedEntityType) &&
    !!src.relatedEntityId;

  return {
    title: actionTitleFromDecision(decision),
    description: parts.join("\n\n"),
    sourceMeetingId: src.meetingId,
    area:
      src.meetingCategory && isMeetingCategory(src.meetingCategory)
        ? src.meetingCategory
        : undefined,
    actionType: "FOLLOW_UP",
    priority: "MEDIUM",
    dueInDays: DEFAULT_ACTION_DEADLINE_DAYS,
    relatedType: hasEntity ? (src.relatedEntityType as RelatedEntityType) : undefined,
    relatedId: hasEntity ? (src.relatedEntityId as string) : undefined,
  };
}

export type EntityActionPrefillSource = {
  type: RelatedEntityType;
  id: string;
  actionType?: ActionType;
  title?: string;
};

/**
 * Prefill an action started from a YPP entity page (a class / mentorship /
 * person / partner). Carries the entity link and its operating area so the new
 * action is born connected to where it came from.
 */
export function buildActionPrefillFromEntity(src: EntityActionPrefillSource): ActionPrefill {
  return {
    title: src.title,
    relatedType: src.type,
    relatedId: src.id,
    area: areaForRelatedEntityType(src.type),
    actionType: src.actionType,
    priority: "MEDIUM",
    dueInDays: DEFAULT_ACTION_DEADLINE_DAYS,
  };
}

export type MeetingActionPrefillSource = {
  meetingId: string;
  title?: string;
  meetingCategory?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

/** Prefill an action started from a meeting (a recap / follow-through item). */
export function buildActionPrefillFromMeeting(src: MeetingActionPrefillSource): ActionPrefill {
  const hasEntity =
    !!src.relatedEntityType &&
    isRelatedEntityType(src.relatedEntityType) &&
    !!src.relatedEntityId;
  return {
    title: src.title,
    sourceMeetingId: src.meetingId,
    area:
      src.meetingCategory && isMeetingCategory(src.meetingCategory)
        ? src.meetingCategory
        : undefined,
    actionType: "MEETING_RECAP",
    priority: "MEDIUM",
    dueInDays: DEFAULT_ACTION_DEADLINE_DAYS,
    relatedType: hasEntity ? (src.relatedEntityType as RelatedEntityType) : undefined,
    relatedId: hasEntity ? (src.relatedEntityId as string) : undefined,
  };
}

/** Serialize a prefill to a `/actions/new` href (omitting empty fields). */
export function actionPrefillToQuery(prefill: ActionPrefill, base = "/actions/new"): string {
  const params = new URLSearchParams();
  const k = ACTION_PREFILL_PARAM_KEYS;
  if (prefill.title) params.set(k.title, prefill.title);
  if (prefill.description) params.set(k.description, prefill.description);
  if (prefill.relatedType && prefill.relatedId) {
    params.set(k.relatedType, prefill.relatedType);
    params.set(k.relatedId, prefill.relatedId);
  }
  if (prefill.sourceMeetingId) params.set(k.sourceMeetingId, prefill.sourceMeetingId);
  if (prefill.area) params.set(k.area, prefill.area);
  if (prefill.actionType) params.set(k.actionType, prefill.actionType);
  if (prefill.priority) params.set(k.priority, prefill.priority);
  if (prefill.dueInDays != null) params.set(k.dueInDays, String(prefill.dueInDays));
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

// --- duplicate detection -----------------------------------------------------

export type ExistingActionLite = {
  id: string;
  title: string;
  /** ActionItemStatus; COMPLETE / DROPPED are treated as settled. */
  status: string;
  officerMeetingId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

export type DuplicateCandidate = {
  id: string;
  title: string;
  /** Why it might be the same work, worst-first. */
  reasons: string[];
  score: number;
};

const SETTLED_STATUS = new Set(["COMPLETE", "DROPPED"]);

export type DuplicateProbeInput = {
  title: string;
  sourceMeetingId?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
};

/**
 * Deterministically find OPEN actions that might already cover this work. An
 * existing action is a candidate when it shares the source meeting, shares the
 * related entity, or has a similar-enough title; the score weights same-meeting +
 * similar-title highest. Settled (complete/dropped) actions never match — we are
 * guarding against duplicate OPEN work, not history. Returns most-likely first.
 */
export function findDuplicateActionCandidates(
  input: DuplicateProbeInput,
  existing: ExistingActionLite[]
): DuplicateCandidate[] {
  const out: DuplicateCandidate[] = [];
  for (const action of existing) {
    if (SETTLED_STATUS.has(action.status)) continue;

    const sameMeeting =
      !!input.sourceMeetingId && action.officerMeetingId === input.sourceMeetingId;
    const sameEntity =
      !!input.relatedType &&
      !!input.relatedId &&
      action.relatedEntityType === input.relatedType &&
      action.relatedEntityId === input.relatedId;
    const similarity = titleSimilarity(input.title, action.title);
    const similarTitle = similarity >= DUPLICATE_TITLE_THRESHOLD;

    if (!sameMeeting && !sameEntity && !similarTitle) continue;

    const reasons: string[] = [];
    let score = 0;
    if (similarTitle) {
      reasons.push("similar title");
      score += 50 + Math.round(similarity * 30);
    }
    if (sameMeeting) {
      reasons.push("from the same meeting");
      score += 25;
    }
    if (sameEntity) {
      reasons.push("on the same entity");
      score += 20;
    }
    out.push({ id: action.id, title: action.title, reasons, score });
  }
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

// --- meeting creation prefill ------------------------------------------------

export type MeetingPrefillSpec = {
  title?: string;
  purpose?: string;
  relatedType?: RelatedEntityType;
  relatedId?: string;
  /** Meeting category (operating area). */
  area?: string;
};

export const MEETING_PREFILL_PARAM_KEYS = {
  title: "title",
  purpose: "purpose",
  relatedType: "relatedType",
  relatedId: "relatedId",
  area: "area",
} as const;

/** Serialize a meeting prefill to a `/actions/meetings?new=1&…` href. */
export function meetingPrefillToQuery(
  prefill: MeetingPrefillSpec,
  base = "/actions/meetings"
): string {
  const params = new URLSearchParams();
  params.set("new", "1");
  const k = MEETING_PREFILL_PARAM_KEYS;
  if (prefill.relatedType && prefill.relatedId) {
    params.set(k.relatedType, prefill.relatedType);
    params.set(k.relatedId, prefill.relatedId);
  }
  if (prefill.title) params.set(k.title, prefill.title);
  if (prefill.purpose) params.set(k.purpose, prefill.purpose);
  if (prefill.area) params.set(k.area, prefill.area);
  return `${base}?${params.toString()}`;
}

export type EntityMeetingPrefillSource = {
  type: RelatedEntityType;
  id: string;
  label?: string | null;
};

/** Prefill a meeting scheduled from a YPP entity page — linked + area-tagged. */
export function buildMeetingPrefillFromEntity(
  src: EntityMeetingPrefillSource
): MeetingPrefillSpec {
  const label = src.label?.trim();
  return {
    relatedType: src.type,
    relatedId: src.id,
    area: areaForRelatedEntityType(src.type),
    title: label ? `${relatedEntityTypeLabel(src.type)} check-in: ${label}` : undefined,
  };
}

export type OperationalIssueMeetingSource = {
  /** The thing that needs a conversation (e.g. an entity label or a problem). */
  title: string;
  purpose?: string;
  relatedType?: string | null;
  relatedId?: string | null;
  area?: string | null;
};

/**
 * Prefill a meeting scheduled to address an operational issue surfaced by the
 * digest (a critical entity, a stuck area). Inherits the entity link + area when
 * known so the meeting lands tagged to the right part of YPP.
 */
export function buildMeetingPrefillFromOperationalIssue(
  src: OperationalIssueMeetingSource
): MeetingPrefillSpec {
  const hasEntity =
    !!src.relatedType && isRelatedEntityType(src.relatedType) && !!src.relatedId;
  const area =
    src.area && isMeetingCategory(src.area)
      ? src.area
      : hasEntity
        ? areaForRelatedEntityType(src.relatedType as RelatedEntityType)
        : undefined;
  return {
    title: src.title,
    purpose: src.purpose,
    area,
    relatedType: hasEntity ? (src.relatedType as RelatedEntityType) : undefined,
    relatedId: hasEntity ? (src.relatedId as string) : undefined,
  };
}

/** Lighter title-only variant for surfaces that only have action titles. */
export function findSimilarActionTitles(
  title: string,
  candidates: Array<{ id: string; title: string; status?: string }>
): Array<{ id: string; title: string; score: number }> {
  const out: Array<{ id: string; title: string; score: number }> = [];
  for (const c of candidates) {
    if (c.status && SETTLED_STATUS.has(c.status)) continue;
    const score = titleSimilarity(title, c.title);
    if (score >= DUPLICATE_TITLE_THRESHOLD) out.push({ id: c.id, title: c.title, score });
  }
  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
