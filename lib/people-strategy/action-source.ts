import { getInitiativeDef } from "./strategic-initiatives";
import {
  getParentInitiative,
  getProjectDef,
  projectHref,
} from "./strategic-project-registry";
import { initiativeHref } from "./strategic-timeline";

/**
 * Action System 4.0 — ACTION SOURCE + STRATEGIC LINK contract (pure).
 *
 * The honest provenance + strategic-linkage vocabulary that backs the new
 * `ActionItem.sourceType` / `sourceId` / `sourceActionId` /
 * `strategicInitiativeId` / `strategicProjectId` columns. Pure: no DB, no
 * session, no React — exactly the pattern used by {@link RelatedEntityType} and
 * the action-type vocabulary, and safe in unit tests.
 *
 * Two jobs:
 *  1. Validate writes (create/update) — membership + both-or-neither +
 *     project↔initiative consistency, mirroring `parseRelatedEntityRef`.
 *  2. NORMALIZE reads — give every action (legacy or new) an honest source
 *     descriptor and resolved strategic linkage, with an `explicit` flag so the
 *     UI can distinguish a stored link from an inferred one and never lie.
 */

// --- source vocabulary -------------------------------------------------------

/** HOW an action came to exist. String-typed config; null = unlabeled/legacy. */
export const ACTION_SOURCE_TYPE_VALUES = [
  "MANUAL",
  "MEETING",
  "MEETING_DECISION",
  "PROJECT",
  "INITIATIVE",
  "ENTITY",
  "WEEKLY_REVIEW",
  "COMMAND_CENTER",
  "FOLLOW_UP",
] as const;
export type ActionSourceType = (typeof ACTION_SOURCE_TYPE_VALUES)[number];

/** Short badge label. */
export const ACTION_SOURCE_TYPE_LABELS: Record<ActionSourceType, string> = {
  MANUAL: "Manual",
  MEETING: "Meeting",
  MEETING_DECISION: "Meeting decision",
  PROJECT: "Project",
  INITIATIVE: "Initiative",
  ENTITY: "Entity",
  WEEKLY_REVIEW: "Weekly review",
  COMMAND_CENTER: "Command center",
  FOLLOW_UP: "Follow-up",
};

/** Context-aware creation-page header copy. */
export const ACTION_SOURCE_HEADER: Record<ActionSourceType, string> = {
  MANUAL: "New manual action",
  MEETING: "Action from meeting",
  MEETING_DECISION: "Action from a meeting decision",
  PROJECT: "Project action",
  INITIATIVE: "Initiative action",
  ENTITY: "Entity action",
  WEEKLY_REVIEW: "Weekly review action",
  COMMAND_CENTER: "Command center action",
  FOLLOW_UP: "Follow-up action",
};

/** Why this provenance matters — one honest line for the source-context panel. */
export const ACTION_SOURCE_WHY: Record<ActionSourceType, string> = {
  MANUAL: "Created by hand — make sure it has an owner and a clear definition of done.",
  MEETING: "This came out of a meeting. Keep it tied to the meeting so the loop closes.",
  MEETING_DECISION: "This carries out a decision that was made — execution is the proof.",
  PROJECT: "This action moves a specific project forward.",
  INITIATIVE: "This action ladders up to a strategic initiative.",
  ENTITY: "This action is about a specific person, class, partner, or mentorship.",
  WEEKLY_REVIEW: "Created during weekly review — close it before the next review.",
  COMMAND_CENTER: "Created from a command-center recommendation — it was flagged as mattering now.",
  FOLLOW_UP: "This is a follow-up to another action — the original isn't done until this is.",
};

export function isActionSourceType(value: unknown): value is ActionSourceType {
  return (
    typeof value === "string" &&
    (ACTION_SOURCE_TYPE_VALUES as readonly string[]).includes(value)
  );
}

// --- completion outcome vocabulary ------------------------------------------

/** Controlled outcome captured when an action is completed. */
export const ACTION_COMPLETION_OUTCOME_VALUES = [
  "DELIVERED",
  "PARTIAL",
  "SUPERSEDED",
  "ABANDONED",
] as const;
export type ActionCompletionOutcome =
  (typeof ACTION_COMPLETION_OUTCOME_VALUES)[number];

export const ACTION_COMPLETION_OUTCOME_LABELS: Record<
  ActionCompletionOutcome,
  string
> = {
  DELIVERED: "Delivered",
  PARTIAL: "Partially delivered",
  SUPERSEDED: "Superseded by other work",
  ABANDONED: "Abandoned",
};

export function isActionCompletionOutcome(
  value: unknown
): value is ActionCompletionOutcome {
  return (
    typeof value === "string" &&
    (ACTION_COMPLETION_OUTCOME_VALUES as readonly string[]).includes(value)
  );
}

export function parseActionCompletionOutcome(
  value?: string | null
):
  | { ok: true; value: ActionCompletionOutcome | null }
  | { ok: false; error: string } {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length === 0) return { ok: true, value: null };
  if (!isActionCompletionOutcome(trimmed)) {
    return { ok: false, error: "Unknown completion outcome." };
  }
  return { ok: true, value: trimmed };
}

/** Label for a source type, falling back to a humanized raw value. */
export function actionSourceTypeLabel(value: string | null | undefined): string {
  if (isActionSourceType(value)) return ACTION_SOURCE_TYPE_LABELS[value];
  return "Manual";
}

// --- write validation: source type ------------------------------------------

export type ParsedActionSourceType =
  | { ok: true; value: ActionSourceType | null }
  | { ok: false; error: string };

/**
 * Validate an incoming `sourceType`. Empty / null → no source (null), a perfectly
 * valid "unlabeled" action. A non-empty value must be in the vocabulary.
 */
export function parseActionSourceType(
  value?: string | null
): ParsedActionSourceType {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (trimmed.length === 0) return { ok: true, value: null };
  if (!isActionSourceType(trimmed)) {
    return { ok: false, error: "Unknown action source type." };
  }
  return { ok: true, value: trimmed };
}

// --- write validation: strategic link ----------------------------------------

export type StrategicLink = {
  initiativeId: string | null;
  projectId: string | null;
};

export type ParsedStrategicLink =
  | { ok: true; link: StrategicLink }
  | { ok: false; error: string };

/**
 * Validate an explicit strategic link against the curated registries. Rules:
 *  - both empty → no link (both null), valid.
 *  - a project id must exist; its parent initiative is AUTHORITATIVE. If an
 *    initiative id is also supplied it must match the project's parent.
 *  - an initiative id (without a project) must exist.
 * This keeps a stored link honest: it can never point at a project/initiative the
 * registry doesn't define, and a project always resolves its real parent.
 */
export function parseStrategicLink(input: {
  strategicInitiativeId?: string | null;
  strategicProjectId?: string | null;
}): ParsedStrategicLink {
  const initiativeId =
    typeof input.strategicInitiativeId === "string"
      ? input.strategicInitiativeId.trim()
      : "";
  const projectId =
    typeof input.strategicProjectId === "string"
      ? input.strategicProjectId.trim()
      : "";

  if (!initiativeId && !projectId) {
    return { ok: true, link: { initiativeId: null, projectId: null } };
  }

  if (projectId) {
    const project = getProjectDef(projectId);
    if (!project) return { ok: false, error: "Unknown strategic project." };
    const parent = getParentInitiative(project);
    if (!parent) return { ok: false, error: "Strategic project has no valid initiative." };
    if (initiativeId && initiativeId !== parent.id) {
      return {
        ok: false,
        error: "Strategic project does not belong to the chosen initiative.",
      };
    }
    return { ok: true, link: { initiativeId: parent.id, projectId } };
  }

  // initiative only
  if (!getInitiativeDef(initiativeId)) {
    return { ok: false, error: "Unknown strategic initiative." };
  }
  return { ok: true, link: { initiativeId, projectId: null } };
}

/**
 * Interpret a strategic link on UPDATE. `undefined` for BOTH fields → unchanged
 * (so an unrelated edit can never silently clear the link). Empty strings →
 * clear. A valid pair → set. Mirrors `parseRelatedEntityUpdate`.
 */
export type StrategicLinkUpdate =
  | { kind: "unchanged" }
  | { kind: "clear" }
  | { kind: "set"; link: StrategicLink }
  | { kind: "error"; error: string };

export function parseStrategicLinkUpdate(input: {
  strategicInitiativeId?: string | null;
  strategicProjectId?: string | null;
}): StrategicLinkUpdate {
  if (
    input.strategicInitiativeId === undefined &&
    input.strategicProjectId === undefined
  ) {
    return { kind: "unchanged" };
  }
  const parsed = parseStrategicLink(input);
  if (!parsed.ok) return { kind: "error", error: parsed.error };
  if (parsed.link.initiativeId === null && parsed.link.projectId === null) {
    return { kind: "clear" };
  }
  return { kind: "set", link: parsed.link };
}

// --- read normalization: source descriptor ----------------------------------

export type ActionSourceDescriptor = {
  type: ActionSourceType;
  /** true when stored on the row; false when inferred for a legacy/unlabeled row. */
  explicit: boolean;
  label: string;
  header: string;
  why: string;
  sourceId: string | null;
  /** Officer-meeting id when the source is a meeting (single source of truth). */
  meetingId: string | null;
  /** Parent action id when the source is a follow-up. */
  parentActionId: string | null;
};

/** The minimal action shape the source normalizer needs. */
export type ActionSourceInput = {
  sourceType?: string | null;
  sourceId?: string | null;
  sourceActionId?: string | null;
  officerMeetingId?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
};

function describe(
  type: ActionSourceType,
  explicit: boolean,
  input: ActionSourceInput
): ActionSourceDescriptor {
  return {
    type,
    explicit,
    label: ACTION_SOURCE_TYPE_LABELS[type],
    header: ACTION_SOURCE_HEADER[type],
    why: ACTION_SOURCE_WHY[type],
    sourceId: input.sourceId?.trim() || null,
    meetingId: input.officerMeetingId?.trim() || null,
    parentActionId: input.sourceActionId?.trim() || null,
  };
}

/**
 * Resolve the honest source of any action. An explicit, valid `sourceType` always
 * wins. Otherwise the source is INFERRED from the durable signals on the row
 * (a parent action → FOLLOW_UP, an officer meeting → MEETING, a related entity →
 * ENTITY, else MANUAL) and flagged `explicit: false` so the UI can phrase it as
 * "looks like it came from…" rather than asserting a stored fact.
 */
export function deriveActionSource(input: ActionSourceInput): ActionSourceDescriptor {
  if (isActionSourceType(input.sourceType)) {
    return describe(input.sourceType, true, input);
  }
  if (input.sourceActionId && input.sourceActionId.trim()) {
    return describe("FOLLOW_UP", false, input);
  }
  if (input.officerMeetingId && input.officerMeetingId.trim()) {
    return describe("MEETING", false, input);
  }
  if (
    input.relatedEntityType &&
    input.relatedEntityType.trim() &&
    input.relatedEntityId &&
    input.relatedEntityId.trim()
  ) {
    return describe("ENTITY", false, input);
  }
  return describe("MANUAL", false, input);
}

/** Short, human source label for a card ("From a meeting decision"). */
export function deriveActionSourceLabel(input: ActionSourceInput): string {
  const src = deriveActionSource(input);
  const prefix = src.explicit ? "From" : "Looks like";
  switch (src.type) {
    case "MANUAL":
      return src.explicit ? "Created manually" : "Manual";
    case "MEETING":
      return `${prefix} a meeting`;
    case "MEETING_DECISION":
      return `${prefix} a meeting decision`;
    case "PROJECT":
      return `${prefix} a project`;
    case "INITIATIVE":
      return `${prefix} an initiative`;
    case "ENTITY":
      return `${prefix} an entity`;
    case "WEEKLY_REVIEW":
      return `${prefix} weekly review`;
    case "COMMAND_CENTER":
      return `${prefix} the command center`;
    case "FOLLOW_UP":
      return `${prefix} a follow-up`;
  }
}

// --- read normalization: strategic linkage ----------------------------------

export type ActionStrategicLinkage = {
  /** true when the row carries a stored, registry-valid strategic id. */
  hasExplicitLink: boolean;
  initiativeId: string | null;
  initiativeTitle: string | null;
  initiativeHref: string | null;
  projectId: string | null;
  projectTitle: string | null;
  projectHref: string | null;
};

const EMPTY_LINKAGE: ActionStrategicLinkage = {
  hasExplicitLink: false,
  initiativeId: null,
  initiativeTitle: null,
  initiativeHref: null,
  projectId: null,
  projectTitle: null,
  projectHref: null,
};

/**
 * Resolve an action's EXPLICIT strategic link to registry titles + hrefs. A
 * project resolves (and back-fills) its parent initiative. Unknown ids resolve to
 * null rather than throwing, so a stale stored id degrades gracefully instead of
 * breaking the page. Returns `hasExplicitLink: false` when nothing is stored —
 * callers then fall back to the keyword matcher's *suggested* context.
 */
export function deriveActionStrategicLinkage(action: {
  strategicInitiativeId?: string | null;
  strategicProjectId?: string | null;
}): ActionStrategicLinkage {
  const initiativeId = action.strategicInitiativeId?.trim() || null;
  const projectId = action.strategicProjectId?.trim() || null;
  if (!initiativeId && !projectId) return EMPTY_LINKAGE;

  let resolvedInitiativeId = initiativeId;
  let projectTitle: string | null = null;
  let resolvedProjectId: string | null = null;

  if (projectId) {
    const project = getProjectDef(projectId);
    if (project) {
      resolvedProjectId = project.id;
      projectTitle = project.title;
      const parent = getParentInitiative(project);
      if (parent) resolvedInitiativeId = parent.id;
    }
  }

  const initiativeDef = resolvedInitiativeId
    ? getInitiativeDef(resolvedInitiativeId)
    : null;

  const hasExplicitLink = Boolean(initiativeDef || resolvedProjectId);
  return {
    hasExplicitLink,
    initiativeId: initiativeDef?.id ?? null,
    initiativeTitle: initiativeDef?.title ?? null,
    initiativeHref: initiativeDef ? initiativeHref(initiativeDef.id) : null,
    projectId: resolvedProjectId,
    projectTitle,
    projectHref: resolvedProjectId ? projectHref(resolvedProjectId) : null,
  };
}
