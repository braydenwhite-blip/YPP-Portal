/**
 * Unified instructor + leadership application flow (Anthea, Aug 2026).
 *
 * Target:
 * 1. One application for instructor and leadership tracks — not separate signup paths.
 * 2. Phase 1: basic info + resume only.
 * 3. Phase 2 (after team approval): prompts like CP — one required for everyone,
 *    plus up to four specialty prompts (applicant picks 0–4).
 * 4. Phase 3: place on relevant waitlists from interests + admin choices.
 *
 * Implementation status: Phase 1 signup still collects teaching fields on instructor
 * signup; CP uses a separate table. This module is the canonical spec for the migration.
 */

export type UnifiedApplicationPhase = "phase_1" | "phase_2" | "phase_3" | "complete";

/** Tracks an applicant may be considered for after Phase 3. */
export type UnifiedApplicationTrack =
  | "instructor"
  | "chapter_president"
  | "leadership"
  | "both";

export const UNIFIED_APPLICATION_PHASE_LABELS: Record<UnifiedApplicationPhase, string> = {
  phase_1: "Application",
  phase_2: "Prompts",
  phase_3: "Waitlist placement",
  complete: "Complete",
};

/** Applicant-facing steps shown on signup / status pages. */
export const UNIFIED_APPLICATION_STEPS = [
  {
    step: "1",
    title: "Basic info & resume",
    body: "Create your account and share contact details, school, chapter interest, and your resume. One application covers instructor and leadership paths.",
  },
  {
    step: "2",
    title: "Team review",
    body: "We review your Phase 1 submission. If it looks like a fit, we unlock the prompt section — similar to the chapter president flow.",
  },
  {
    step: "3",
    title: "Prompts",
    body: "Answer one required prompt everyone completes, then choose up to four specialty prompts that match your strengths (0–4 optional).",
  },
  {
    step: "4",
    title: "Waitlists & next steps",
    body: "Based on your interests and our needs, we add you to the relevant waitlists and follow up with interview or onboarding steps.",
  },
] as const;

/** Gate Phase 2 on instructor pipeline — maps to existing status until unified enum exists. */
export const PHASE_2_UNLOCK_INSTRUCTOR_STATUSES = [
  "PRE_APPROVED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "CHAIR_REVIEW",
  "APPROVED",
  "ON_HOLD",
  "WAITLISTED",
] as const;

/** Gate Phase 2 on CP pipeline. */
export const PHASE_2_UNLOCK_CP_STATUSES = [
  "INITIAL_REVIEW",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "INFO_REQUESTED",
  "INTERVIEW_NEEDED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETE",
  "INTERVIEW_COMPLETED",
  "DECISION_NEEDED",
  "RECOMMENDATION_SUBMITTED",
  "ACCEPTED",
  "APPROVED",
  "ONBOARDING",
  "ACTIVE_CP",
  "WAITLISTED",
] as const;

export function canAccessPhase2(
  kind: "instructor" | "chapter_president",
  status: string
): boolean {
  const allowed =
    kind === "instructor" ? PHASE_2_UNLOCK_INSTRUCTOR_STATUSES : PHASE_2_UNLOCK_CP_STATUSES;
  return (allowed as readonly string[]).includes(status);
}
