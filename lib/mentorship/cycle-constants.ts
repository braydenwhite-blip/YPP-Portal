/**
 * Review cycle vocabulary (client-safe, pure).
 *
 * A ReviewCycle tracks a set of people through one review period — either the
 * monthly mentorship pipeline (self-reflection → mentor review → chair
 * approval → released) or the quarterly leadership calibration. Statuses are
 * strings validated in app code (mentorship-2 convention) so the vocabulary
 * can evolve without a migration.
 */

export const CYCLE_KINDS = ["monthly", "quarterly"] as const;
export type CycleKind = (typeof CYCLE_KINDS)[number];

export const CYCLE_STATUSES = ["active", "closed"] as const;
export type CycleStatus = (typeof CYCLE_STATUSES)[number];

export const CYCLE_SCOPE_TYPES = [
  "role-group",
  "chapter",
  "lane",
  "custom",
] as const;
export type CycleScopeType = (typeof CYCLE_SCOPE_TYPES)[number];

/**
 * Where one participant stands in the cycle, derived at read time from the
 * existing review artifacts — never stored (except the manual override).
 */
export const PARTICIPANT_STAGES = [
  "blocked-no-mentor",
  "waiting-self-input",
  "waiting-review",
  "ready-for-chair",
  "follow-ups-open",
  "released",
  "waived",
] as const;
export type ParticipantStage = (typeof PARTICIPANT_STAGES)[number];

export const PARTICIPANT_STAGE_OVERRIDES = ["waived"] as const;

export type StageTone = "danger" | "warning" | "info" | "brand" | "success" | "neutral";

export const STAGE_META: Record<
  ParticipantStage,
  { label: string; blurb: string; tone: StageTone; order: number }
> = {
  "blocked-no-mentor": {
    label: "Needs mentor",
    blurb: "No active mentor — assign one before the review can move.",
    tone: "danger",
    order: 0,
  },
  "waiting-self-input": {
    label: "Waiting on self-input",
    blurb: "Their monthly self-reflection hasn't been submitted yet.",
    tone: "warning",
    order: 1,
  },
  "waiting-review": {
    label: "Waiting on review",
    blurb: "Self-input is in — the mentor's review is the next move.",
    tone: "warning",
    order: 2,
  },
  "ready-for-chair": {
    label: "Ready for synthesis",
    blurb: "Review written — waiting on chair approval and release.",
    tone: "info",
    order: 3,
  },
  "follow-ups-open": {
    label: "Follow-ups open",
    blurb: "Review released, but follow-up actions are still open.",
    tone: "brand",
    order: 4,
  },
  released: {
    label: "Released",
    blurb: "Review released to them — this person is done.",
    tone: "success",
    order: 5,
  },
  waived: {
    label: "Waived",
    blurb: "Deliberately excused from this cycle.",
    tone: "neutral",
    order: 6,
  },
};

/** Stages that count as complete for cycle progress. */
export const COMPLETED_STAGES: readonly ParticipantStage[] = ["released", "waived"];

export function isCycleKind(value: string): value is CycleKind {
  return (CYCLE_KINDS as readonly string[]).includes(value);
}

export function isParticipantStage(value: string): value is ParticipantStage {
  return (PARTICIPANT_STAGES as readonly string[]).includes(value);
}
