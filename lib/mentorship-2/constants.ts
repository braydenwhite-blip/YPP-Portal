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
