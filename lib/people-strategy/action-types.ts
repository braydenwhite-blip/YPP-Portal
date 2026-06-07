import type { ActionPriority } from "@prisma/client";

/**
 * People Strategy — Action Type system.
 *
 * An Action Type is a controlled vocabulary describing the KIND of work an
 * action represents (outreach, follow-up, instructor onboarding, a partnership
 * follow-up, …). Like `relatedEntityType`, it is stored as a loosely-typed
 * string column (no Postgres enum) and validated in application code by the
 * union + Zod, so adding a type never needs a migration. `null` is a valid,
 * first-class value meaning "untyped" — it renders as no badge and matches
 * every filter.
 *
 * Kept as a plain value module (no Prisma runtime, no "use server") so the
 * client form, the card, the filter bar, and the server actions can all share
 * one source of truth without bundling the Prisma client.
 */

export const ACTION_TYPE_VALUES = [
  "OUTREACH",
  "FOLLOW_UP",
  "INSTRUCTOR_RECRUITING",
  "INSTRUCTOR_ONBOARDING",
  "PARTNERSHIP",
  "CLASS_PLANNING",
  "CURRICULUM",
  "RELATIONSHIP",
  "APPLICATION_REVIEW",
  "MEETING_PREP",
  "MEETING_RECAP",
  "EMAIL",
  "CALL",
  "LOGISTICS",
  "OPERATIONS",
  "ADMIN_TASK",
  "OTHER",
] as const;

export type ActionType = (typeof ACTION_TYPE_VALUES)[number];

/** Human-readable labels for the type selector, card badge, and detail view. */
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  OUTREACH: "Outreach",
  FOLLOW_UP: "Follow-up",
  INSTRUCTOR_RECRUITING: "Instructor recruiting",
  INSTRUCTOR_ONBOARDING: "Instructor onboarding",
  PARTNERSHIP: "Partnership",
  CLASS_PLANNING: "Class planning",
  CURRICULUM: "Curriculum",
  RELATIONSHIP: "Relationship management",
  APPLICATION_REVIEW: "Application review",
  MEETING_PREP: "Meeting prep",
  MEETING_RECAP: "Meeting recap",
  EMAIL: "Email needed",
  CALL: "Call needed",
  LOGISTICS: "Logistics",
  OPERATIONS: "Internal operations",
  ADMIN_TASK: "Portal / admin task",
  OTHER: "Other",
};

export type ActionTypeGuidance = {
  /** One-line helper surfaced under the type selector in the create form. */
  helper: string;
  /**
   * Priority a fresh action of this type should default to. The form applies it
   * only on a NEW action and only until the user touches priority, so it nudges
   * without ever overriding a deliberate choice.
   */
  suggestedPriority: ActionPriority;
};

/**
 * Per-type guidance: a short prompt of what to capture (which fields matter for
 * this kind of work) plus a sensible default priority. Surfaced live in the
 * create form so the tracker helps the user define a real next step instead of
 * staring at a blank form.
 */
export const ACTION_TYPE_GUIDANCE: Record<ActionType, ActionTypeGuidance> = {
  OUTREACH: {
    helper:
      "Reaching out cold or warm — name the person or partner and set a follow-up date so it doesn't go quiet.",
    suggestedPriority: "MEDIUM",
  },
  FOLLOW_UP: {
    helper:
      "Closing a loop you already opened — link the person or partner and give it a tight deadline.",
    suggestedPriority: "HIGH",
  },
  INSTRUCTOR_RECRUITING: {
    helper:
      "Sourcing or courting an instructor — link the applicant and note the class they might fit.",
    suggestedPriority: "HIGH",
  },
  INSTRUCTOR_ONBOARDING: {
    helper:
      "Getting an approved instructor ready to teach — link the instructor and track the next onboarding step.",
    suggestedPriority: "MEDIUM",
  },
  PARTNERSHIP: {
    helper:
      "Moving a partner or school relationship forward — link the partner and keep its relationship lead in the loop.",
    suggestedPriority: "MEDIUM",
  },
  CLASS_PLANNING: {
    helper:
      "Standing up or scheduling a class — link the class and the lead instructor.",
    suggestedPriority: "MEDIUM",
  },
  CURRICULUM: {
    helper:
      "Building or revising what gets taught — link the class and assign a curriculum owner.",
    suggestedPriority: "MEDIUM",
  },
  RELATIONSHIP: {
    helper:
      "Tending an ongoing relationship — link the person or partner and capture the last contact in the notes.",
    suggestedPriority: "MEDIUM",
  },
  APPLICATION_REVIEW: {
    helper:
      "Reviewing an instructor application — link the application and set a quick turnaround.",
    suggestedPriority: "HIGH",
  },
  MEETING_PREP: {
    helper:
      "Getting ready for a meeting — note the agenda owner and the date you need it by.",
    suggestedPriority: "MEDIUM",
  },
  MEETING_RECAP: {
    helper:
      "Capturing decisions and next steps after a meeting — drop the recap in the description.",
    suggestedPriority: "MEDIUM",
  },
  EMAIL: {
    helper:
      "A specific email that needs to go out — name the recipient and what it should say.",
    suggestedPriority: "MEDIUM",
  },
  CALL: {
    helper:
      "A specific call that needs to happen — name who, and the goal of the call.",
    suggestedPriority: "MEDIUM",
  },
  LOGISTICS: {
    helper:
      "Rooms, materials, scheduling, supplies — link the class or event it supports.",
    suggestedPriority: "MEDIUM",
  },
  OPERATIONS: {
    helper:
      "Internal running of the org — assign one owner and a clear definition of done.",
    suggestedPriority: "MEDIUM",
  },
  ADMIN_TASK: {
    helper:
      "Portal or back-office upkeep — keep it small and assign one owner.",
    suggestedPriority: "LOW",
  },
  OTHER: {
    helper:
      "Anything that doesn't fit a type — give it a clear title so it's still scannable.",
    suggestedPriority: "MEDIUM",
  },
};

/** Type guard: is `value` a known Action Type? */
export function isActionType(value: unknown): value is ActionType {
  return (
    typeof value === "string" &&
    (ACTION_TYPE_VALUES as readonly string[]).includes(value)
  );
}

/** Label for an action type, falling back to the raw value. */
export function actionTypeLabel(value: string): string {
  return (ACTION_TYPE_LABELS as Record<string, string>)[value] ?? value;
}

/** Common free-text hints (e.g. template categories) → a canonical type. */
const ACTION_TYPE_SYNONYMS: Record<string, ActionType> = {
  recruiting: "INSTRUCTOR_RECRUITING",
  recruitment: "INSTRUCTOR_RECRUITING",
  onboarding: "INSTRUCTOR_ONBOARDING",
  outreach: "OUTREACH",
  "follow up": "FOLLOW_UP",
  followup: "FOLLOW_UP",
  partnership: "PARTNERSHIP",
  partner: "PARTNERSHIP",
  curriculum: "CURRICULUM",
  "class planning": "CLASS_PLANNING",
  logistics: "LOGISTICS",
  operations: "OPERATIONS",
  ops: "OPERATIONS",
  relationship: "RELATIONSHIP",
  "application review": "APPLICATION_REVIEW",
  email: "EMAIL",
  call: "CALL",
  meeting: "MEETING_PREP",
};

/**
 * Best-effort resolution of a free-text hint (a template's `category`, say) to a
 * known Action Type. Matches the label, the enum value, the spaced value, and a
 * small synonym table — all case-insensitively. Returns null when nothing fits,
 * so a hint never produces a bogus type. Pure + unit-tested.
 */
export function actionTypeFromHint(
  hint: string | null | undefined
): ActionType | null {
  const norm = typeof hint === "string" ? hint.trim().toLowerCase() : "";
  if (!norm) return null;
  for (const value of ACTION_TYPE_VALUES) {
    if (ACTION_TYPE_LABELS[value].toLowerCase() === norm) return value;
    if (value.toLowerCase() === norm) return value;
    if (value.replace(/_/g, " ").toLowerCase() === norm) return value;
  }
  return ACTION_TYPE_SYNONYMS[norm] ?? null;
}

export type ParsedActionType =
  | { ok: true; value: ActionType | null }
  | { ok: false; error: string };

/**
 * Pure validator for a submitted action type on CREATE. Empty / null → no type
 * (a perfectly valid untyped action). A non-empty value must be a known member.
 * Shared by the create Zod schema and unit-tested directly so the rule can
 * never drift.
 */
export function parseActionType(
  input: string | null | undefined
): ParsedActionType {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) return { ok: true, value: null };
  if (!isActionType(value)) return { ok: false, error: "Unknown action type." };
  return { ok: true, value };
}

/**
 * The result of interpreting an action type on UPDATE. Distinguishes "leave the
 * existing type untouched" (field omitted) from "intentionally clear it" (sent
 * empty) so an unrelated field edit can never silently erase a type.
 */
export type ActionTypeUpdate =
  | { kind: "unchanged" }
  | { kind: "clear" }
  | { kind: "set"; value: ActionType }
  | { kind: "error"; error: string };

/**
 * Pure interpreter for the action type on UPDATE. `undefined` means "not part
 * of this update" → unchanged. Empty/blank → clear; a valid member → set; an
 * unknown non-empty value → error.
 */
export function parseActionTypeUpdate(
  input: string | null | undefined
): ActionTypeUpdate {
  if (input === undefined) return { kind: "unchanged" };
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) return { kind: "clear" };
  if (!isActionType(value)) return { kind: "error", error: "Unknown action type." };
  return { kind: "set", value };
}
