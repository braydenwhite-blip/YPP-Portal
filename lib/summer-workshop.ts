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

// ---------------------------------------------------------------------------
// Interview prompts (Summer Workshop track only)
// ---------------------------------------------------------------------------

/**
 * Workshop-specific interview prompts appended to the existing question bank
 * when the applicant is on the SUMMER_WORKSHOP_INSTRUCTOR track. These are
 * static (code-defined) rather than DB rows because they are conditional on
 * applicant subtype — adding them to the global question bank would surface
 * them for standard applicants too.
 *
 * Shape mirrors `InstructorInterviewQuestionBank` so the existing interview
 * review editor can render them without modification (plan §7).
 */
export type SummerWorkshopInterviewPrompt = {
  id: string;
  slug: string;
  prompt: string;
  helperText: string | null;
  followUpPrompt: string | null;
  topic: string | null;
  competency: string | null;
  whyItMatters: string | null;
  interviewerGuidance: string | null;
  listenFor: string | null;
  suggestedFollowUps: unknown;
  strongSignals: unknown;
  concernSignals: unknown;
  notePrompts: unknown;
  sortOrder: number;
};

export const SUMMER_WORKSHOP_INTERVIEW_PROMPTS: SummerWorkshopInterviewPrompt[] = [
  {
    id: "summer-workshop-walkthrough",
    slug: "summer_workshop_walkthrough",
    prompt:
      "Walk me through how you'd run a 45-minute workshop at a camp for 12 kids. What does the flow look like minute-by-minute?",
    helperText: "Looking for: a clear pacing plan, age-appropriate activities, and a sense of how they think on their feet.",
    followUpPrompt: "What would you cut first if you ran out of time?",
    topic: "Workshop Delivery",
    competency: "ENGAGEMENT_AND_CLARITY",
    whyItMatters:
      "Summer workshop instructors run short sessions. We need to see they can structure 30–60 minutes well.",
    interviewerGuidance: null,
    listenFor: "Concrete time blocks. Hooks. A real activity. Realism about what fits in 45 minutes.",
    suggestedFollowUps: [],
    strongSignals: [],
    concernSignals: [],
    notePrompts: [],
    sortOrder: 1001,
  },
  {
    id: "summer-workshop-engagement-hook",
    slug: "summer_workshop_engagement_hook",
    prompt:
      "How do you grab attention in the first 5 minutes? Give me a specific example you've used or would use.",
    helperText: "Looking for: a concrete hook, energy, awareness of camp dynamics.",
    followUpPrompt: "What if it doesn't land?",
    topic: "Engagement",
    competency: "ENGAGEMENT_AND_CLARITY",
    whyItMatters: "Camp attention spans are short. The first five minutes set the tone.",
    interviewerGuidance: null,
    listenFor: "Specificity. Energy in the answer itself. A backup plan.",
    suggestedFollowUps: [],
    strongSignals: [],
    concernSignals: [],
    notePrompts: [],
    sortOrder: 1002,
  },
  {
    id: "summer-workshop-adaptability",
    slug: "summer_workshop_adaptability",
    prompt:
      "When the group's energy or skill level isn't what you expected, how do you adapt mid-session?",
    helperText: "Looking for: composure, real adaptation tactics, willingness to abandon a plan.",
    followUpPrompt: "Tell me about a time this actually happened.",
    topic: "Adaptability",
    competency: "CLASSROOM_PRESENCE",
    whyItMatters: "Camps are unpredictable. We need instructors who can read a room and pivot.",
    interviewerGuidance: null,
    listenFor: "A real story. Specific tactics. Not just 'I'd be flexible.'",
    suggestedFollowUps: [],
    strongSignals: [],
    concernSignals: [],
    notePrompts: [],
    sortOrder: 1003,
  },
  {
    id: "summer-workshop-disruption",
    slug: "summer_workshop_disruption",
    prompt:
      "How do you handle a disengaged or disruptive student in a short session, when you don't have weeks to build a relationship?",
    helperText: "Looking for: classroom control without escalation, age-appropriate interventions.",
    followUpPrompt: "What if redirecting them doesn't work?",
    topic: "Classroom Control",
    competency: "CLASSROOM_PRESENCE",
    whyItMatters: "Without relationship runway, instructors need quick, calm de-escalation tactics.",
    interviewerGuidance: null,
    listenFor: "Concrete moves. Calm tone. Not punitive-first thinking.",
    suggestedFollowUps: [],
    strongSignals: [],
    concernSignals: [],
    notePrompts: [],
    sortOrder: 1004,
  },
];

