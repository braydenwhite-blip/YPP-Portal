/**
 * Summer Workshop Instructor pathway — shared types, constants, and helpers.
 *
 * Implements the data contracts described in
 * `docs/summer-workshop-instructor-plan.md` §4 and §6.
 *
 * Kept intentionally additive: nothing here mutates standard instructor
 * behavior. Standard applicants (`applicationTrack === STANDARD_INSTRUCTOR`)
 * never read or render any of these structures.
 */

import type { ApplicationTrack, InstructorSubtype } from "@prisma/client";

// ---------------------------------------------------------------------------
// Timeline / audit event kinds
// ---------------------------------------------------------------------------

/**
 * New timeline event kinds added for the Summer Workshop Instructor pathway.
 * Reuses the existing `InstructorApplicationTimelineEvent` table — no new
 * audit log model.
 */
export const SUMMER_WORKSHOP_TIMELINE_KINDS = {
  TRACK_SELECTED: "TRACK_SELECTED",
  SUBTYPE_CHANGED: "SUBTYPE_CHANGED",
  WORKSHOP_OUTLINE_SUBMITTED: "WORKSHOP_OUTLINE_SUBMITTED",
  WORKSHOP_OUTLINE_UPDATED: "WORKSHOP_OUTLINE_UPDATED",
  PROMOTION_FLAGGED: "PROMOTION_FLAGGED",
  PROMOTED_TO_STANDARD: "PROMOTED_TO_STANDARD",
  DEMOTED_TO_SUMMER_WORKSHOP: "DEMOTED_TO_SUMMER_WORKSHOP",
} as const;

// ---------------------------------------------------------------------------
// Workshop Outline structure (stored as JSON on InstructorApplication)
// ---------------------------------------------------------------------------

export type WorkshopOutline = {
  title: string;
  ageRange: string;
  durationMinutes: number;
  learningGoals: string[];
  activityFlow: string;
  materialsNeeded: string[];
  engagementHook: string;
  adaptationNotes: string;
};

export const EMPTY_WORKSHOP_OUTLINE: WorkshopOutline = {
  title: "",
  ageRange: "",
  durationMinutes: 0,
  learningGoals: [],
  activityFlow: "",
  materialsNeeded: [],
  engagementHook: "",
  adaptationNotes: "",
};

/**
 * Soft-validate a workshop outline. Returns a list of human-readable warnings
 * for missing/weak fields. We intentionally do NOT throw or hard-block —
 * reviewers stay in control (plan §6.7).
 */
export function workshopOutlineWarnings(outline: WorkshopOutline | null | undefined): string[] {
  if (!outline) return ["Workshop outline is missing."];
  const warnings: string[] = [];
  if (!outline.title?.trim()) warnings.push("Title is missing.");
  if (!outline.ageRange?.trim()) warnings.push("Age range is missing.");
  if (!outline.durationMinutes || outline.durationMinutes <= 0)
    warnings.push("Duration is missing or invalid.");
  if (!outline.learningGoals?.length) warnings.push("Learning goals are missing.");
  if (!outline.activityFlow?.trim() || outline.activityFlow.trim().length < 30)
    warnings.push("Activity flow is missing or too short.");
  if (!outline.engagementHook?.trim()) warnings.push("Engagement hook is missing.");
  if (!outline.adaptationNotes?.trim()) warnings.push("Adaptation notes are missing.");
  return warnings;
}

export function isWorkshopOutlineComplete(outline: WorkshopOutline | null | undefined): boolean {
  return workshopOutlineWarnings(outline).length === 0;
}

// ---------------------------------------------------------------------------
// Promotion eligibility shape
// ---------------------------------------------------------------------------

export type PromotionEligibility = {
  workshopsCompleted: number;
  reviewerNotesPositive: boolean;
  outstandingRequirements: string[];
  flaggedForPromotion: boolean;
  flaggedAt: string | null;
  flaggedBy: string | null;
};

export const DEFAULT_PROMOTION_ELIGIBILITY: PromotionEligibility = {
  workshopsCompleted: 0,
  reviewerNotesPositive: false,
  outstandingRequirements: ["Lesson Design Studio capstone"],
  flaggedForPromotion: false,
  flaggedAt: null,
  flaggedBy: null,
};

// ---------------------------------------------------------------------------
// Track / subtype helpers
// ---------------------------------------------------------------------------

export function isSummerWorkshopTrack(track: ApplicationTrack | null | undefined): boolean {
  return track === "SUMMER_WORKSHOP_INSTRUCTOR";
}

export function isSummerWorkshopSubtype(subtype: InstructorSubtype | null | undefined): boolean {
  return subtype === "SUMMER_WORKSHOP";
}

export function subtypeForTrack(track: ApplicationTrack): InstructorSubtype {
  return track === "SUMMER_WORKSHOP_INSTRUCTOR" ? "SUMMER_WORKSHOP" : "STANDARD";
}

export function trackLabel(track: ApplicationTrack | null | undefined): string {
  return track === "SUMMER_WORKSHOP_INSTRUCTOR" ? "Summer Workshop" : "Standard";
}

export function subtypeLabel(subtype: InstructorSubtype | null | undefined): string {
  return subtype === "SUMMER_WORKSHOP" ? "Summer Workshop" : "Standard";
}

export function subtypeBadge(subtype: InstructorSubtype | null | undefined): string | null {
  return subtype === "SUMMER_WORKSHOP" ? "SW" : null;
}
