/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — pure normalizers that map
 * Prisma-shaped rows into the matching engine's plain inputs.
 *
 * Kept free of Prisma so the messy text→slug mapping and candidate shaping are
 * unit-testable without a live DB. The data layer (queries.ts / actions.ts) does
 * the I/O and delegates the shaping here.
 */

import { expertiseProficiencyWeight } from "../constants";
import type {
  ApplicationInput,
  MentorCandidate,
} from "../matching/types";

/** The application fields the matcher needs, plus the applicant's goal signals. */
export interface ApplicationLike {
  goals: string | null;
  interests: string[];
  preferredExpertise: string[];
  availability: string | null;
  applicant?: {
    profile?: {
      careerGoal?: string | null;
      leadershipGoal?: string | null;
      grade?: number | null;
    } | null;
  } | null;
}

/** An ExpertiseArea taxonomy entry used to map free-text interests → slugs. */
export interface TaxonomyEntry {
  slug: string;
  name: string;
}

/** A mentor row (Prisma select shape) used to build a MentorCandidate. */
export interface MentorRowLike {
  id: string;
  name?: string | null;
  profile?: {
    mentorCapacity?: number | null;
    mentorAvailability?: string | null;
  } | null;
  mentorExpertise: {
    proficiency: string | null;
    expertiseArea: {
      slug: string;
      name: string;
      category?: string | null;
      isActive?: boolean;
    };
  }[];
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Normalize an application into the engine's ApplicationInput. The mentee's
 * explicit `preferredExpertise` slugs are unioned with any `interests` that map
 * onto a known ExpertiseArea (by name or slug), so the scorer's expertise overlap
 * stays purely slug-based. Goal text concatenates the application goals with the
 * applicant's career/leadership goals.
 */
export function buildApplicationInput(
  application: ApplicationLike,
  taxonomy: TaxonomyEntry[]
): ApplicationInput {
  const slugByKey = new Map<string, string>();
  for (const area of taxonomy) {
    slugByKey.set(norm(area.name), area.slug);
    slugByKey.set(norm(area.slug), area.slug);
  }

  const requested = new Set<string>();
  for (const raw of application.preferredExpertise ?? []) {
    const key = norm(raw);
    if (!key) continue;
    // preferredExpertise are stored as slugs; fall back to the raw slug if the
    // taxonomy lookup misses so a still-valid slug is not dropped.
    requested.add(slugByKey.get(key) ?? key);
  }
  for (const interest of application.interests ?? []) {
    const slug = slugByKey.get(norm(interest));
    if (slug) requested.add(slug);
  }

  const profile = application.applicant?.profile ?? null;
  const goalText = [
    application.goals,
    profile?.careerGoal,
    profile?.leadershipGoal,
  ]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ");

  return {
    requestedExpertiseSlugs: Array.from(requested),
    interests: application.interests ?? [],
    goalText,
    availability: application.availability,
    menteeGrade: profile?.grade ?? null,
  };
}

/** Map a mentor row + precomputed active load into a MentorCandidate. */
export function toMentorCandidate(
  row: MentorRowLike,
  activeLoad: number
): MentorCandidate {
  return {
    userId: row.id,
    name: row.name ?? null,
    expertise: (row.mentorExpertise ?? [])
      .filter((me) => me.expertiseArea.isActive !== false)
      .map((me) => ({
        slug: me.expertiseArea.slug,
        name: me.expertiseArea.name,
        category: me.expertiseArea.category ?? null,
        proficiencyWeight: expertiseProficiencyWeight(me.proficiency),
      })),
    capacity: row.profile?.mentorCapacity ?? null,
    activeLoad,
    availability: row.profile?.mentorAvailability ?? null,
  };
}
