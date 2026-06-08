/**
 * Student Operating System / Growth Engine (Phase N1) — Growth Profile derivation.
 *
 * Pure helpers that turn existing signals (mentorship application interests,
 * career/leadership goals, passions, earned achievements) into the development
 * profile, and produce the deterministic "who you're becoming" summary line the
 * /my-growth header renders. Interest/skill arrays are merged ADDITIVELY (never
 * silently overwritten). No IO.
 */

import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_CATEGORY_LABELS,
  type AchievementCategory,
} from "./constants";

export interface GrowthProfileSignals {
  careerInterests: string[];
  leadershipInterests: string[];
  impactInterests: string[];
  skills: string[];
  confidenceAreas: string[];
  growthAreas: string[];
}

export interface ProfileDerivationInput {
  /** Interests stated on the mentorship application. */
  applicationInterests?: string[];
  /** Passions / interest areas the student declared elsewhere. */
  passions?: string[];
  careerGoal?: string | null;
  leadershipGoal?: string | null;
  impactInterests?: string[];
  /** Categories the student has earned at least one achievement in. */
  earnedCategories?: AchievementCategory[];
  /** Existing profile to merge additively onto (e.g. user-edited arrays). */
  existing?: Partial<GrowthProfileSignals>;
}

/** Trim, drop empties, and de-dupe case-insensitively while keeping first form. */
export function mergeSignals(...lists: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const value = (raw ?? "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

const MAX_GROWTH_AREAS = 3;

/**
 * Derive the development profile deterministically. Confidence areas come from
 * the dimensions the student has *demonstrated* (earned achievements); growth
 * areas are the dimensions they have not yet (the next frontiers).
 */
export function deriveProfileSignals(
  input: ProfileDerivationInput
): GrowthProfileSignals {
  const existing = input.existing ?? {};

  const careerInterests = mergeSignals(
    existing.careerInterests,
    input.careerGoal ? [input.careerGoal] : [],
    input.applicationInterests,
    input.passions
  );
  const leadershipInterests = mergeSignals(
    existing.leadershipInterests,
    input.leadershipGoal ? [input.leadershipGoal] : []
  );
  const impactInterests = mergeSignals(existing.impactInterests, input.impactInterests);

  const earnedCategories = input.earnedCategories ?? [];
  const earnedSet = new Set<AchievementCategory>(earnedCategories);

  const confidenceAreas = mergeSignals(
    existing.confidenceAreas,
    earnedCategories.map((c) => ACHIEVEMENT_CATEGORY_LABELS[c])
  );

  // Growth areas = dimensions with no achievement yet, in stable category order.
  const derivedGrowthAreas = ACHIEVEMENT_CATEGORIES.filter(
    (c) => !earnedSet.has(c)
  ).map((c) => ACHIEVEMENT_CATEGORY_LABELS[c]);
  const growthAreas = mergeSignals(existing.growthAreas, derivedGrowthAreas).slice(
    0,
    MAX_GROWTH_AREAS
  );

  return {
    careerInterests,
    leadershipInterests,
    impactInterests,
    skills: mergeSignals(existing.skills),
    confidenceAreas,
    growthAreas,
  };
}

export interface BecomingSummaryInput {
  careerInterests: string[];
  leadershipInterests: string[];
  impactInterests: string[];
  topAchievementCategory?: AchievementCategory | null;
  completedExperiences?: number;
}

/**
 * The deterministic "Who is this student becoming?" line. Built only from the
 * student's own signals — same input, same sentence.
 */
export function becomingSummary(input: BecomingSummaryInput): string {
  const career = input.careerInterests[0];
  const leadership = input.leadershipInterests[0];
  const impact = input.impactInterests[0];

  if (!career && !leadership && !impact) {
    const done = input.completedExperiences ?? 0;
    if (done > 0) {
      return `You've completed ${done} experience${
        done === 1 ? "" : "s"
      } — set a vision to define who you're becoming next.`;
    }
    return "Just getting started — set your first goal to define who you're becoming.";
  }

  const parts: string[] = [];
  if (career) parts.push(`growing toward ${career}`);
  if (leadership) parts.push(`building leadership in ${leadership}`);
  if (impact) parts.push(`creating impact through ${impact}`);

  const lead = parts.length > 0 ? capitalize(parts[0]) : "Growing";
  const rest = parts.slice(1);
  if (rest.length === 0) return `${lead}.`;
  if (rest.length === 1) return `${lead}, and ${rest[0]}.`;
  return `${lead}, ${rest.slice(0, -1).join(", ")}, and ${rest[rest.length - 1]}.`;
}

function capitalize(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}
