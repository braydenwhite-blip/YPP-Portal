/**
 * Partner Pipeline vocabularies (Phase 4 — YPP Operating System pass).
 *
 * `stage`, `priority`, `partnerType` and note `kind` are stored as TEXT on the
 * `Partner` / `PartnerNote` tables (no Postgres enum), mirroring the repo's
 * `actionType` / `relatedEntityType` convention. The canonical vocabulary and
 * validation live here so the values stay editable without a migration.
 *
 * This module is pure (no server-only imports) so it can be shared by server
 * components, server actions, and client components alike.
 */

// --- Stages -----------------------------------------------------------------

export const PARTNER_STAGES = [
  "NOT_STARTED",
  "RESEARCHING",
  "REACHED_OUT",
  "RESPONDED",
  "MEETING_SCHEDULED",
  "NEEDS_PROPOSAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
  "ACTIVE_PARTNERSHIP",
  "COMPLETED",
  "PAUSED",
  "NOT_A_FIT",
] as const;

export type PartnerStage = (typeof PARTNER_STAGES)[number];

export const PARTNER_STAGE_LABELS: Record<PartnerStage, string> = {
  NOT_STARTED: "Not started",
  RESEARCHING: "Researching",
  REACHED_OUT: "Reached out",
  RESPONDED: "Responded",
  MEETING_SCHEDULED: "Meeting scheduled",
  NEEDS_PROPOSAL: "Needs proposal",
  PROPOSAL_SENT: "Proposal sent",
  NEGOTIATING: "Negotiating",
  ACTIVE_PARTNERSHIP: "Active partnership",
  COMPLETED: "Completed",
  PAUSED: "Paused",
  NOT_A_FIT: "Not a fit",
};

/** Short helper text shown under each stage column / on the profile. */
export const PARTNER_STAGE_HINTS: Record<PartnerStage, string> = {
  NOT_STARTED: "On the list, not yet contacted.",
  RESEARCHING: "Gathering contacts and fit before reaching out.",
  REACHED_OUT: "First message sent — waiting to hear back.",
  RESPONDED: "They replied. Keep the momentum going.",
  MEETING_SCHEDULED: "A conversation is on the calendar.",
  NEEDS_PROPOSAL: "They're interested — draft and send a proposal.",
  PROPOSAL_SENT: "Proposal is out. Follow up so it doesn't stall.",
  NEGOTIATING: "Working out dates, scope, and logistics.",
  ACTIVE_PARTNERSHIP: "Live partnership — assign instructors and deliver.",
  COMPLETED: "Program delivered. Capture the outcome.",
  PAUSED: "On hold for now — revisit later.",
  NOT_A_FIT: "Not a fit right now. Archived from the active board.",
};

/**
 * Board grouping: stages that are still "in flight" and want a next step, vs.
 * won/parked. Used to decide stuck/cold flags and which columns lead the board.
 */
export const PARTNER_ACTIVE_STAGES: readonly PartnerStage[] = [
  "NOT_STARTED",
  "RESEARCHING",
  "REACHED_OUT",
  "RESPONDED",
  "MEETING_SCHEDULED",
  "NEEDS_PROPOSAL",
  "PROPOSAL_SENT",
  "NEGOTIATING",
];

export const PARTNER_WON_STAGES: readonly PartnerStage[] = [
  "ACTIVE_PARTNERSHIP",
  "COMPLETED",
];

export const PARTNER_PARKED_STAGES: readonly PartnerStage[] = ["PAUSED", "NOT_A_FIT"];

export function isActivePartnerStage(stage: PartnerStage): boolean {
  return PARTNER_ACTIVE_STAGES.includes(stage);
}

export function partnerStageIndex(stage: PartnerStage): number {
  const i = PARTNER_STAGES.indexOf(stage);
  return i === -1 ? 0 : i;
}

// --- Priority ---------------------------------------------------------------

export const PARTNER_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type PartnerPriority = (typeof PARTNER_PRIORITIES)[number];

export const PARTNER_PRIORITY_LABELS: Record<PartnerPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

// --- Types ------------------------------------------------------------------

export const PARTNER_TYPES = [
  "CAMP",
  "SCHOOL",
  "COMMUNITY_CENTER",
  "SYNAGOGUE",
  "LIBRARY",
  "NONPROFIT",
  "PARENT_GROUP",
  "CHAPTER_PARTNER",
  "OTHER",
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  CAMP: "Camp",
  SCHOOL: "School",
  COMMUNITY_CENTER: "Community center",
  SYNAGOGUE: "Synagogue",
  LIBRARY: "Library",
  NONPROFIT: "Nonprofit",
  PARENT_GROUP: "Parent group",
  CHAPTER_PARTNER: "Chapter partner",
  OTHER: "Other",
};

// --- Note kinds -------------------------------------------------------------

export const PARTNER_NOTE_KINDS = [
  "NOTE",
  "FOLLOW_UP",
  "MEETING",
  "CONCERN",
  "WIN",
  "DECISION",
  "OUTCOME",
  "STAGE_CHANGE",
] as const;
export type PartnerNoteKind = (typeof PARTNER_NOTE_KINDS)[number];

export const PARTNER_NOTE_KIND_LABELS: Record<PartnerNoteKind, string> = {
  NOTE: "Note",
  FOLLOW_UP: "Follow-up",
  MEETING: "Meeting",
  CONCERN: "Concern",
  WIN: "Win",
  DECISION: "Decision",
  OUTCOME: "Outcome",
  STAGE_CHANGE: "Stage change",
};

// --- Safe coercion (TEXT columns may hold legacy/null values) ---------------

export function asPartnerStage(value: string | null | undefined): PartnerStage {
  return value && (PARTNER_STAGES as readonly string[]).includes(value)
    ? (value as PartnerStage)
    : "NOT_STARTED";
}

export function asPartnerPriority(value: string | null | undefined): PartnerPriority {
  return value && (PARTNER_PRIORITIES as readonly string[]).includes(value)
    ? (value as PartnerPriority)
    : "MEDIUM";
}

export function asPartnerType(value: string | null | undefined): PartnerType | null {
  return value && (PARTNER_TYPES as readonly string[]).includes(value)
    ? (value as PartnerType)
    : null;
}

export function asPartnerNoteKind(value: string | null | undefined): PartnerNoteKind {
  return value && (PARTNER_NOTE_KINDS as readonly string[]).includes(value)
    ? (value as PartnerNoteKind)
    : "NOTE";
}

export function partnerStageLabel(value: string | null | undefined): string {
  return PARTNER_STAGE_LABELS[asPartnerStage(value)];
}

export function partnerPriorityLabel(value: string | null | undefined): string {
  return PARTNER_PRIORITY_LABELS[asPartnerPriority(value)];
}

export function partnerTypeLabel(value: string | null | undefined): string | null {
  const t = asPartnerType(value);
  return t ? PARTNER_TYPE_LABELS[t] : null;
}

export function partnerNoteKindLabel(value: string | null | undefined): string {
  return PARTNER_NOTE_KIND_LABELS[asPartnerNoteKind(value)];
}

// --- Stuck / cold detection -------------------------------------------------

export type PartnerStuckInput = {
  stage: string | null;
  nextFollowUpAt: Date | null;
  relationshipLeadId: string | null;
};

/**
 * Returns the human reasons a partner is "stuck" — overdue follow-up, an active
 * conversation with no next step, or no relationship owner. Empty array = fine.
 * Pure + cheap so it can run per-row on the board and on the profile header.
 */
export function partnerStuckReasons(
  partner: PartnerStuckInput,
  now: Date = new Date()
): string[] {
  const stage = asPartnerStage(partner.stage);
  const reasons: string[] = [];

  // Parked / won partners don't need a live next step.
  if (!isActivePartnerStage(stage)) return reasons;

  if (partner.nextFollowUpAt && partner.nextFollowUpAt.getTime() < now.getTime()) {
    reasons.push("Follow-up is overdue");
  } else if (!partner.nextFollowUpAt) {
    reasons.push("No next follow-up scheduled");
  }

  if (!partner.relationshipLeadId) {
    reasons.push("No relationship lead");
  }

  return reasons;
}

// --- Pipeline report aggregate ----------------------------------------------

export type PartnerPipelineInput = {
  stage: string | null;
  priority: string | null;
  nextFollowUpAt: Date | null;
  relationshipLeadId: string | null;
};

export type PartnerPipelineSummary = {
  total: number;
  /** In-flight conversations (active stages). */
  active: number;
  /** Won = active partnership or completed. */
  won: number;
  /** Parked = paused or not-a-fit. */
  parked: number;
  /** Active partners with at least one stuck/cold reason. */
  stuck: number;
  byStage: Record<PartnerStage, number>;
  byPriority: Record<PartnerPriority, number>;
};

/**
 * Pure aggregate for the Partnership Report — counts partners by stage and
 * priority and rolls up active / won / parked / stuck buckets, reusing the same
 * stage groupings and stuck-detection the board uses so the report and the
 * board never disagree. Settled (won/parked) partners are never counted stuck.
 */
export function summarizePartnerPipeline(
  partners: PartnerPipelineInput[],
  now: Date = new Date()
): PartnerPipelineSummary {
  const byStage = Object.fromEntries(
    PARTNER_STAGES.map((s) => [s, 0])
  ) as Record<PartnerStage, number>;
  const byPriority = Object.fromEntries(
    PARTNER_PRIORITIES.map((p) => [p, 0])
  ) as Record<PartnerPriority, number>;

  let active = 0;
  let won = 0;
  let parked = 0;
  let stuck = 0;

  for (const partner of partners) {
    const stage = asPartnerStage(partner.stage);
    byStage[stage] += 1;
    byPriority[asPartnerPriority(partner.priority)] += 1;

    if (isActivePartnerStage(stage)) {
      active += 1;
      if (partnerStuckReasons(partner, now).length > 0) stuck += 1;
    } else if ((PARTNER_WON_STAGES as readonly string[]).includes(stage)) {
      won += 1;
    } else {
      parked += 1;
    }
  }

  return { total: partners.length, active, won, parked, stuck, byStage, byPriority };
}
