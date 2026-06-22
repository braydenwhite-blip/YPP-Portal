import type { ActionPriority } from "@prisma/client";

import {
  DEFAULT_ACTION_DEADLINE_DAYS,
  isRelatedEntityType,
  relatedEntityTypeLabel,
  type RelatedEntityType,
} from "./constants";
import { isMeetingCategory } from "./meeting-categories";
import type { MeetingType } from "./meeting-operating-model";
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
  /** Exact suggested deadline for source records that already have one. */
  dueDate?: string;
  // --- Action System 4.0 honest context ---
  /** How the action came to exist (ACTION_SOURCE_TYPE_VALUES). */
  sourceType?: string;
  /** Fine-grained source id (decision id, registry id, …). */
  sourceId?: string;
  /** Parent action id for FOLLOW_UP actions. */
  sourceActionId?: string;
  /** Explicit strategic-initiative registry id. */
  strategicInitiativeId?: string;
  /** Explicit strategic-project registry id. */
  strategicProjectId?: string;
  /** A suggested owner (user id) — never invented, only passed from a real source. */
  suggestedOwnerId?: string;
  /** A suggested definition of done. */
  successDefinition?: string;
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
  dueDate: "due",
  sourceType: "sourceType",
  sourceId: "sourceId",
  sourceActionId: "fromAction",
  strategicInitiativeId: "initiativeId",
  strategicProjectId: "projectId",
  suggestedOwnerId: "owner",
  successDefinition: "success",
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
  /** The MeetingDecision id, stored as the action's fine-grained sourceId. */
  decisionId?: string | null;
  meetingTitle?: string | null;
  meetingCategory?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  /** A real meeting participant suggested as owner — never invented. */
  suggestedOwnerId?: string | null;
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
    // Action 4.0: this action carries out a specific meeting decision — record
    // that provenance honestly (source type + the decision id), suggest the
    // owner the meeting picked (never invented), and seed a definition of done.
    sourceType: "MEETING_DECISION",
    sourceId: src.decisionId ?? undefined,
    suggestedOwnerId: src.suggestedOwnerId ?? undefined,
    successDefinition: decision ? `Done when this decision is carried out and confirmed.` : undefined,
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
    sourceType: "ENTITY",
    area: areaForRelatedEntityType(src.type),
    actionType: src.actionType,
    priority: "MEDIUM",
    dueInDays: DEFAULT_ACTION_DEADLINE_DAYS,
  };
}

export type FollowUpActionPrefillSource = {
  parentActionId: string;
  parentTitle?: string | null;
  /** Inherit the parent's strategic/entity context so the chain stays connected. */
  relatedType?: RelatedEntityType;
  relatedId?: string;
  strategicInitiativeId?: string;
  strategicProjectId?: string;
};

/**
 * Prefill a follow-up to an existing action. Records the parent action id as the
 * honest source, seeds a "Follow-up: …" title, and inherits the parent's
 * strategic/entity context so the follow-up chain stays connected.
 */
export function buildActionPrefillFromFollowUp(
  src: FollowUpActionPrefillSource
): ActionPrefill {
  const parent = src.parentTitle?.trim();
  return {
    title: parent ? `Follow-up: ${parent}` : undefined,
    sourceType: "FOLLOW_UP",
    sourceActionId: src.parentActionId,
    relatedType: src.relatedType,
    relatedId: src.relatedId,
    strategicInitiativeId: src.strategicInitiativeId,
    strategicProjectId: src.strategicProjectId,
    actionType: "FOLLOW_UP",
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
    sourceType: "MEETING",
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

export type MeetingFollowUpActionPrefillSource = {
  followUpId: string;
  title: string;
  description?: string | null;
  meetingId: string;
  meetingTitle?: string | null;
  meetingCategory?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  suggestedOwnerId?: string | null;
  dueDate?: string | null;
};

/** Prefill an action from a meeting follow-up that has not become tracked work. */
export function buildActionPrefillFromMeetingFollowUp(
  src: MeetingFollowUpActionPrefillSource
): ActionPrefill {
  const title = (src.title ?? "").trim() || "Follow-up from meeting";
  const description = src.description?.trim();
  const parts = [`Meeting follow-up: ${title}`];
  if (description) parts.push(`Context: ${description}`);
  parts.push(
    src.meetingTitle && src.meetingTitle.trim()
      ? `From the follow-up captured in "${src.meetingTitle.trim()}."`
      : "From a meeting follow-up."
  );

  const hasEntity =
    !!src.relatedEntityType &&
    isRelatedEntityType(src.relatedEntityType) &&
    !!src.relatedEntityId;

  return {
    title,
    description: parts.join("\n\n"),
    sourceMeetingId: src.meetingId,
    sourceType: "MEETING",
    sourceId: src.followUpId,
    suggestedOwnerId: src.suggestedOwnerId ?? undefined,
    successDefinition: "Done when this follow-up is completed and confirmed in the meeting record.",
    area:
      src.meetingCategory && isMeetingCategory(src.meetingCategory)
        ? src.meetingCategory
        : undefined,
    actionType: "FOLLOW_UP",
    priority: "MEDIUM",
    dueDate: src.dueDate ?? undefined,
    dueInDays: src.dueDate ? undefined : DEFAULT_ACTION_DEADLINE_DAYS,
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
  if (prefill.dueDate) params.set(k.dueDate, prefill.dueDate);
  if (prefill.sourceType) params.set(k.sourceType, prefill.sourceType);
  if (prefill.sourceId) params.set(k.sourceId, prefill.sourceId);
  if (prefill.sourceActionId) params.set(k.sourceActionId, prefill.sourceActionId);
  if (prefill.strategicInitiativeId) params.set(k.strategicInitiativeId, prefill.strategicInitiativeId);
  if (prefill.strategicProjectId) params.set(k.strategicProjectId, prefill.strategicProjectId);
  if (prefill.suggestedOwnerId) params.set(k.suggestedOwnerId, prefill.suggestedOwnerId);
  if (prefill.successDefinition) params.set(k.successDefinition, prefill.successDefinition);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * Read a prefill back from a query source (the create page's searchParams). The
 * inverse of {@link actionPrefillToQuery}, with light coercion (numbers, enum
 * membership). The page still revalidates everything server-side; this is the
 * single tested reader so the create surface and its CTAs never drift.
 */
export function actionPrefillFromQuery(
  source: URLSearchParams | Record<string, string | string[] | undefined>
): ActionPrefill {
  const get = (key: string): string | undefined => {
    if (source instanceof URLSearchParams) return source.get(key) ?? undefined;
    const v = source[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const k = ACTION_PREFILL_PARAM_KEYS;
  const out: ActionPrefill = {};
  const title = get(k.title);
  if (title) out.title = title;
  const desc = get(k.description);
  if (desc) out.description = desc;
  const relatedType = get(k.relatedType);
  const relatedId = get(k.relatedId);
  if (relatedType && relatedId && isRelatedEntityType(relatedType)) {
    out.relatedType = relatedType;
    out.relatedId = relatedId;
  }
  const sourceMeetingId = get(k.sourceMeetingId);
  if (sourceMeetingId) out.sourceMeetingId = sourceMeetingId;
  const area = get(k.area);
  if (area) out.area = area;
  const priority = get(k.priority);
  if (priority) out.priority = priority as ActionPriority;
  const dueInDays = get(k.dueInDays);
  if (dueInDays != null && dueInDays !== "" && Number.isFinite(Number(dueInDays))) {
    out.dueInDays = Math.max(0, Math.min(365, Math.round(Number(dueInDays))));
  }
  const dueDate = get(k.dueDate);
  if (dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) out.dueDate = dueDate;
  const sourceType = get(k.sourceType);
  if (sourceType) out.sourceType = sourceType;
  const sourceId = get(k.sourceId);
  if (sourceId) out.sourceId = sourceId;
  const sourceActionId = get(k.sourceActionId);
  if (sourceActionId) out.sourceActionId = sourceActionId;
  const initiativeId = get(k.strategicInitiativeId);
  if (initiativeId) out.strategicInitiativeId = initiativeId;
  const projectId = get(k.strategicProjectId);
  if (projectId) out.strategicProjectId = projectId;
  const owner = get(k.suggestedOwnerId);
  if (owner) out.suggestedOwnerId = owner;
  const success = get(k.successDefinition);
  if (success) out.successDefinition = success;
  return out;
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
  meetingType?: MeetingType;
  relatedType?: RelatedEntityType;
  relatedId?: string;
  /** Meeting category (operating area). */
  area?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  facilitatorId?: string;
  attendeeIds?: string[];
  agendaTitles?: string[];
};

export const MEETING_PREFILL_PARAM_KEYS = {
  title: "title",
  purpose: "purpose",
  meetingType: "meetingType",
  relatedType: "relatedType",
  relatedId: "relatedId",
  area: "area",
  date: "date",
  startTime: "start",
  endTime: "end",
  facilitatorId: "facilitatorId",
  attendeeIds: "attendeeIds",
  agendaTitles: "agenda",
} as const;

/** Serialize a meeting prefill to a `/actions/meetings/new?…` href. */
export function meetingPrefillToQuery(
  prefill: MeetingPrefillSpec,
  base = "/actions/meetings/new"
): string {
  const params = new URLSearchParams();
  const k = MEETING_PREFILL_PARAM_KEYS;
  if (prefill.relatedType && prefill.relatedId) {
    params.set(k.relatedType, prefill.relatedType);
    params.set(k.relatedId, prefill.relatedId);
  }
  if (prefill.title) params.set(k.title, prefill.title);
  if (prefill.purpose) params.set(k.purpose, prefill.purpose);
  if (prefill.meetingType) params.set(k.meetingType, prefill.meetingType);
  if (prefill.area) params.set(k.area, prefill.area);
  if (prefill.date) params.set(k.date, prefill.date);
  if (prefill.startTime) params.set(k.startTime, prefill.startTime);
  if (prefill.endTime) params.set(k.endTime, prefill.endTime);
  if (prefill.facilitatorId) params.set(k.facilitatorId, prefill.facilitatorId);
  for (const id of prefill.attendeeIds ?? []) {
    if (id) params.append(k.attendeeIds, id);
  }
  for (const item of prefill.agendaTitles ?? []) {
    const title = item.trim();
    if (title) params.append(k.agendaTitles, title);
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
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
