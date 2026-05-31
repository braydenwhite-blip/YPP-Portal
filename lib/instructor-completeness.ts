/**
 * Profile-completeness scoring for the admin Instructor Database.
 *
 * This is a pure, side-effect-free computation. It is intentionally NOT
 * persisted — the score and missing-field list are derived on read from data
 * that already exists on the instructor's user/profile/application records.
 *
 * It is consumed by `buildOpsRecord` in `lib/instructor-ops.ts` (attached to
 * each `InstructorOpsRecord`) and surfaced on the database table and profile.
 */

export type MissingField = {
  code: string;
  label: string;
  href: string;
};

export type InstructorCompleteness = {
  /** 0-100, rounded. */
  score: number;
  /** Fields that are absent and counted against the score. */
  missing: MissingField[];
  /** How many checks applied to this instructor. */
  totalChecks: number;
  /** How many of those checks passed. */
  completeChecks: number;
};

export type CompletenessInput = {
  isInstructor: boolean;
  phone?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  school?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  /** Derived availability tags (e.g. "Weekends", "Virtual"). */
  availabilityTags?: string[];
  /** Raw availability free-text from the application, if any. */
  availabilityText?: string | null;
  /** Subjects / interests / general tags. */
  subjectTags?: string[];
  /** Whether the instructor has an active instructor mentor. */
  hasActiveMentor?: boolean;
  /** Whether required training is complete. */
  trainingComplete?: boolean;
  /** Link used for the "fix this" affordance (the admin profile page). */
  profileHref: string;
};

type Check = {
  code: string;
  label: string;
  /** Relative weight; defaults to 1. */
  weight?: number;
  /** Only applies to confirmed instructors when true. */
  instructorOnly?: boolean;
  passes: (input: CompletenessInput) => boolean;
};

function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * The completeness checklist. Order here is the order shown to admins.
 */
const CHECKS: Check[] = [
  {
    code: "phone",
    label: "Phone number",
    passes: (i) => hasText(i.phone),
  },
  {
    code: "location",
    label: "Location (city/state)",
    passes: (i) => hasText(i.city) || hasText(i.stateProvince),
  },
  {
    code: "school",
    label: "School",
    passes: (i) => hasText(i.school),
  },
  {
    code: "bio",
    label: "Bio",
    passes: (i) => hasText(i.bio),
  },
  {
    code: "avatar",
    label: "Profile photo",
    weight: 0.5,
    passes: (i) => hasText(i.avatarUrl),
  },
  {
    code: "availability",
    label: "Availability",
    passes: (i) =>
      (i.availabilityTags?.length ?? 0) > 0 || hasText(i.availabilityText),
  },
  {
    code: "subjects",
    label: "Subjects / interests",
    passes: (i) => (i.subjectTags?.length ?? 0) > 0,
  },
  {
    code: "mentor",
    label: "Assigned mentor",
    instructorOnly: true,
    passes: (i) => Boolean(i.hasActiveMentor),
  },
  {
    code: "training",
    label: "Training complete",
    instructorOnly: true,
    passes: (i) => Boolean(i.trainingComplete),
  },
];

export function computeInstructorCompleteness(
  input: CompletenessInput
): InstructorCompleteness {
  const applicable = CHECKS.filter(
    (check) => !check.instructorOnly || input.isInstructor
  );

  let totalWeight = 0;
  let completeWeight = 0;
  let completeChecks = 0;
  const missing: MissingField[] = [];

  for (const check of applicable) {
    const weight = check.weight ?? 1;
    totalWeight += weight;
    if (check.passes(input)) {
      completeWeight += weight;
      completeChecks += 1;
    } else {
      missing.push({
        code: check.code,
        label: check.label,
        href: input.profileHref,
      });
    }
  }

  const score =
    totalWeight > 0 ? Math.round((completeWeight / totalWeight) * 100) : 100;

  return {
    score,
    missing,
    totalChecks: applicable.length,
    completeChecks,
  };
}

/** Visual tone bucket for a completeness score. */
export function completenessTone(score: number): "success" | "warning" | "danger" {
  if (score >= 80) return "success";
  if (score >= 50) return "warning";
  return "danger";
}
