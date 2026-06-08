/**
 * Student Operating System / Growth Engine (Action Tracker 3.0, Phase N1) —
 * vocabularies + validators.
 *
 * Pure: no IO, no Prisma — safe to import anywhere (server or client) and fully
 * unit-testable. The TEXT vocabularies validated here (action status, achievement
 * category, opportunity kind/status, and — in events.ts — event type) mirror the
 * repo's actionType / partner.stage convention (see lib/mentorship-2/constants.ts):
 * the values stay editable in code without a Postgres-enum migration. The two
 * values that DO have Postgres enums (GrowthTrack, GrowthObjectiveStatus) are
 * re-declared here as string-literal unions so the pure engine never imports the
 * generated Prisma client.
 */

/* ------------------------------------------------------------------ *
 * Track — the progression lane a node/event belongs to. Different tracks,
 * one engine. Mirrors the `GrowthTrack` Postgres enum.
 * ------------------------------------------------------------------ */

export const GROWTH_TRACKS = [
  "STUDENT",
  "MENTORSHIP",
  "INSTRUCTOR",
  "LEADERSHIP",
  "CHAPTER",
  "HIRING",
  "ALUMNI",
] as const;
export type GrowthTrackId = (typeof GROWTH_TRACKS)[number];

export const GROWTH_TRACK_LABELS: Record<GrowthTrackId, string> = {
  STUDENT: "Student",
  MENTORSHIP: "Mentorship",
  INSTRUCTOR: "Instructor",
  LEADERSHIP: "Leadership",
  CHAPTER: "Chapter",
  HIRING: "Hiring",
  ALUMNI: "Alumni",
};

export function isGrowthTrack(value: unknown): value is GrowthTrackId {
  return typeof value === "string" && (GROWTH_TRACKS as readonly string[]).includes(value);
}

/* ------------------------------------------------------------------ *
 * Objective status — shared by Vision / Goal / Milestone. Mirrors the
 * `GrowthObjectiveStatus` Postgres enum.
 * ------------------------------------------------------------------ */

export const GROWTH_OBJECTIVE_STATUSES = ["ACTIVE", "ACHIEVED", "ARCHIVED"] as const;
export type GrowthObjectiveStatus = (typeof GROWTH_OBJECTIVE_STATUSES)[number];

export function isGrowthObjectiveStatus(value: unknown): value is GrowthObjectiveStatus {
  return (
    typeof value === "string" &&
    (GROWTH_OBJECTIVE_STATUSES as readonly string[]).includes(value)
  );
}

/* ------------------------------------------------------------------ *
 * Action status — the leaf's richer TEXT vocabulary (not a Postgres enum).
 * ------------------------------------------------------------------ */

export const GROWTH_ACTION_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
  "DROPPED",
] as const;
export type GrowthActionStatus = (typeof GROWTH_ACTION_STATUSES)[number];

export const GROWTH_ACTION_STATUS_LABELS: Record<GrowthActionStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  BLOCKED: "Blocked",
  DROPPED: "Dropped",
};

export function isGrowthActionStatus(value: unknown): value is GrowthActionStatus {
  return (
    typeof value === "string" &&
    (GROWTH_ACTION_STATUSES as readonly string[]).includes(value)
  );
}

/** Coerce any stored/raw value to a valid action status (defaults to TODO). */
export function normalizeActionStatus(value: unknown): GrowthActionStatus {
  if (isGrowthActionStatus(value)) return value;
  return "TODO";
}

/** A finished action (counts toward progress numerator). */
export function actionStatusIsComplete(value: unknown): boolean {
  return normalizeActionStatus(value) === "DONE";
}

/** An action that still counts toward the denominator (everything but DROPPED). */
export function actionStatusIsCountable(value: unknown): boolean {
  return normalizeActionStatus(value) !== "DROPPED";
}

/** An action that is open work the student can still act on. */
export function actionStatusIsOpen(value: unknown): boolean {
  const s = normalizeActionStatus(value);
  return s === "TODO" || s === "IN_PROGRESS";
}

/* ------------------------------------------------------------------ *
 * Achievement category — the growth dimension an achievement connects to.
 * ------------------------------------------------------------------ */

export const ACHIEVEMENT_CATEGORIES = [
  "LEADERSHIP",
  "IMPACT",
  "TEACHING",
  "MENTORSHIP",
  "PROJECT",
  "CHAPTER",
  "COMMUNITY",
] as const;
export type AchievementCategory = (typeof ACHIEVEMENT_CATEGORIES)[number];

export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  LEADERSHIP: "Leadership",
  IMPACT: "Impact",
  TEACHING: "Teaching",
  MENTORSHIP: "Mentorship",
  PROJECT: "Projects",
  CHAPTER: "Chapter building",
  COMMUNITY: "Community service",
};

export function isAchievementCategory(value: unknown): value is AchievementCategory {
  return (
    typeof value === "string" &&
    (ACHIEVEMENT_CATEGORIES as readonly string[]).includes(value)
  );
}

/* ------------------------------------------------------------------ *
 * Opportunity kind + status — the deterministic recommendation taxonomy.
 * ------------------------------------------------------------------ */

export const OPPORTUNITY_KINDS = [
  "CLASS",
  "LEADERSHIP_ROLE",
  "PROJECT",
  "MENTORSHIP_ACTION",
  "INSTRUCTOR_MILESTONE",
  "CHAPTER_RESPONSIBILITY",
] as const;
export type OpportunityKind = (typeof OPPORTUNITY_KINDS)[number];

export const OPPORTUNITY_KIND_LABELS: Record<OpportunityKind, string> = {
  CLASS: "Next class",
  LEADERSHIP_ROLE: "Leadership role",
  PROJECT: "Project",
  MENTORSHIP_ACTION: "Mentorship",
  INSTRUCTOR_MILESTONE: "Instructor milestone",
  CHAPTER_RESPONSIBILITY: "Chapter responsibility",
};

export function isOpportunityKind(value: unknown): value is OpportunityKind {
  return (
    typeof value === "string" && (OPPORTUNITY_KINDS as readonly string[]).includes(value)
  );
}

export const OPPORTUNITY_STATUSES = [
  "SUGGESTED",
  "DISMISSED",
  "ACCEPTED",
  "COMPLETED",
] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

export function isOpportunityStatus(value: unknown): value is OpportunityStatus {
  return (
    typeof value === "string" &&
    (OPPORTUNITY_STATUSES as readonly string[]).includes(value)
  );
}

/* ------------------------------------------------------------------ *
 * Small shared math helpers used across the pure engine.
 * ------------------------------------------------------------------ */

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/** A 0..1 ratio rendered as an integer percent (0..100). */
export function toPercent(ratio: number): number {
  return Math.round(clamp01(ratio) * 100);
}
