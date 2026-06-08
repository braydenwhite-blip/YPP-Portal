/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M1) — shared vocabularies.
 *
 * Pure module (no `"use server"`, no Prisma) so it is safe to import from both
 * server actions and client components, and is unit-testable. These vocabularies
 * are validated in app code rather than as Postgres enums, matching the repo's
 * `actionType` / `partner.stage` convention (see migration
 * 20260608170000_add_mentorship_2_foundation).
 */

// ----------------------------------------------------------------------------
// Mentorship application status
// ----------------------------------------------------------------------------

export const MENTORSHIP_APPLICATION_STATUSES = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "MATCHED",
  "DECLINED",
  "WITHDRAWN",
] as const;

export type MentorshipApplicationStatus =
  (typeof MENTORSHIP_APPLICATION_STATUSES)[number];

export const MENTORSHIP_APPLICATION_STATUS_LABELS: Record<
  MentorshipApplicationStatus,
  string
> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  MATCHED: "Matched",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

/** Statuses where the application is still actionable in the matching queue. */
export const OPEN_APPLICATION_STATUSES: readonly MentorshipApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
];

/** Statuses that close the application (no further transitions). */
export const TERMINAL_APPLICATION_STATUSES: readonly MentorshipApplicationStatus[] =
  ["MATCHED", "DECLINED", "WITHDRAWN"];

export function isMentorshipApplicationStatus(
  value: unknown
): value is MentorshipApplicationStatus {
  return (
    typeof value === "string" &&
    (MENTORSHIP_APPLICATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isOpenApplicationStatus(
  status: MentorshipApplicationStatus
): boolean {
  return OPEN_APPLICATION_STATUSES.includes(status);
}

export function isTerminalApplicationStatus(
  status: MentorshipApplicationStatus
): boolean {
  return TERMINAL_APPLICATION_STATUSES.includes(status);
}

/**
 * Allowed status transitions. An open application may move forward to any other
 * state; terminal states are final. Used by the officer review action to reject
 * illegal moves (e.g. re-opening a MATCHED application).
 */
export const APPLICATION_STATUS_TRANSITIONS: Record<
  MentorshipApplicationStatus,
  readonly MentorshipApplicationStatus[]
> = {
  SUBMITTED: ["UNDER_REVIEW", "MATCHED", "DECLINED", "WITHDRAWN"],
  UNDER_REVIEW: ["MATCHED", "DECLINED", "WITHDRAWN"],
  MATCHED: [],
  DECLINED: [],
  WITHDRAWN: [],
};

export function canTransitionApplication(
  from: MentorshipApplicationStatus,
  to: MentorshipApplicationStatus
): boolean {
  if (from === to) return false;
  return APPLICATION_STATUS_TRANSITIONS[from].includes(to);
}

// ----------------------------------------------------------------------------
// Expertise proficiency
// ----------------------------------------------------------------------------

export const EXPERTISE_PROFICIENCIES = [
  "FAMILIAR",
  "PROFICIENT",
  "EXPERT",
] as const;

export type ExpertiseProficiency = (typeof EXPERTISE_PROFICIENCIES)[number];

export const EXPERTISE_PROFICIENCY_LABELS: Record<ExpertiseProficiency, string> =
  {
    FAMILIAR: "Familiar",
    PROFICIENT: "Proficient",
    EXPERT: "Expert",
  };

export function isExpertiseProficiency(
  value: unknown
): value is ExpertiseProficiency {
  return (
    typeof value === "string" &&
    (EXPERTISE_PROFICIENCIES as readonly string[]).includes(value)
  );
}

/**
 * Proficiency → weight, consumed by the Phase M2 matching engine when scoring
 * mentor expertise fit. Higher proficiency contributes more to the match score.
 */
export const EXPERTISE_PROFICIENCY_WEIGHT: Record<ExpertiseProficiency, number> =
  {
    FAMILIAR: 1,
    PROFICIENT: 2,
    EXPERT: 3,
  };

export function expertiseProficiencyWeight(
  proficiency: string | null | undefined
): number {
  if (isExpertiseProficiency(proficiency)) {
    return EXPERTISE_PROFICIENCY_WEIGHT[proficiency];
  }
  // An unscored/claimed-but-unrated expertise still counts as a baseline signal.
  return 1;
}

// ----------------------------------------------------------------------------
// Match recommendation status (Phase M2)
//
// Status vocabulary for MentorshipMatchRecommendation. TEXT validated here
// rather than as a Postgres enum, mirroring the application-status convention
// above. One application fans out to many SUGGESTED rows; at most one becomes
// APPROVED (the rest are auto-SUPERSEDED).
// ----------------------------------------------------------------------------

export const MENTORSHIP_RECOMMENDATION_STATUSES = [
  "SUGGESTED",
  "SHORTLISTED",
  "APPROVED",
  "REJECTED",
  "HELD",
  "SUPERSEDED",
] as const;

export type MentorshipRecommendationStatus =
  (typeof MENTORSHIP_RECOMMENDATION_STATUSES)[number];

export const MENTORSHIP_RECOMMENDATION_STATUS_LABELS: Record<
  MentorshipRecommendationStatus,
  string
> = {
  SUGGESTED: "Suggested",
  SHORTLISTED: "Shortlisted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  HELD: "Held",
  SUPERSEDED: "Superseded",
};

/** Statuses where a recommendation is still in play for the admin to act on. */
export const ACTIVE_RECOMMENDATION_STATUSES: readonly MentorshipRecommendationStatus[] =
  ["SUGGESTED", "SHORTLISTED", "HELD"];

/** Statuses representing a recorded decision. */
export const DECIDED_RECOMMENDATION_STATUSES: readonly MentorshipRecommendationStatus[] =
  ["APPROVED", "REJECTED", "SUPERSEDED"];

export function isMentorshipRecommendationStatus(
  value: unknown
): value is MentorshipRecommendationStatus {
  return (
    typeof value === "string" &&
    (MENTORSHIP_RECOMMENDATION_STATUSES as readonly string[]).includes(value)
  );
}

export function isActiveRecommendationStatus(
  status: MentorshipRecommendationStatus
): boolean {
  return ACTIVE_RECOMMENDATION_STATUSES.includes(status);
}

/**
 * Allowed status transitions for a recommendation. APPROVED is terminal (undoing
 * an active match is a deliberate, separate operation, out of M2 scope). REJECTED
 * and SUPERSEDED can be revived by an admin re-considering or by re-running the
 * engine. Used by the data layer to reject illegal moves.
 */
export const RECOMMENDATION_STATUS_TRANSITIONS: Record<
  MentorshipRecommendationStatus,
  readonly MentorshipRecommendationStatus[]
> = {
  SUGGESTED: ["SHORTLISTED", "HELD", "REJECTED", "APPROVED", "SUPERSEDED"],
  SHORTLISTED: ["SUGGESTED", "HELD", "REJECTED", "APPROVED", "SUPERSEDED"],
  HELD: ["SUGGESTED", "SHORTLISTED", "REJECTED", "APPROVED", "SUPERSEDED"],
  REJECTED: ["SHORTLISTED", "HELD", "SUGGESTED"],
  SUPERSEDED: ["SUGGESTED", "SHORTLISTED"],
  APPROVED: [],
};

export function canTransitionRecommendation(
  from: MentorshipRecommendationStatus,
  to: MentorshipRecommendationStatus
): boolean {
  if (from === to) return false;
  return RECOMMENDATION_STATUS_TRANSITIONS[from].includes(to);
}
