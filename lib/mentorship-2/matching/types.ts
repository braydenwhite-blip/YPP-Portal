/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — matching engine types.
 *
 * Pure module: no Prisma, no `"use server"`. The scorer/ranker consume plain
 * normalized objects so they are deterministic and unit-testable without a DB.
 * The recommendations data layer (lib/mentorship-2/recommendations/) is what maps
 * Prisma rows → these inputs and persists the results.
 */

/** A mentor's claim on one expertise area, normalized for scoring. */
export interface MentorExpertiseInput {
  /** ExpertiseArea slug (matched against the application's requested slugs). */
  slug: string;
  /** Display name — used for goal-alignment keyword matching and explanations. */
  name: string;
  /** Optional taxonomy category (e.g. "STEM"), also fed into goal alignment. */
  category?: string | null;
  /**
   * Proficiency weight 1–3 (FAMILIAR/PROFICIENT/EXPERT) — precomputed by the data
   * layer via `expertiseProficiencyWeight` so this module stays free of constants.
   */
  proficiencyWeight: number;
}

/** A candidate mentor, normalized for scoring. */
export interface MentorCandidate {
  userId: string;
  name?: string | null;
  /** Claimed expertise areas (empty ⇒ a completeness gap). */
  expertise: MentorExpertiseInput[];
  /** UserProfile.mentorCapacity — target max active mentees. `null` ⇒ undeclared. */
  capacity: number | null;
  /** Count of the mentor's currently ACTIVE mentorships. */
  activeLoad: number;
  /** UserProfile.mentorAvailability free text — `null` ⇒ a completeness gap. */
  availability?: string | null;
  /** Reserved for future grade/age appropriateness. Unused by the current scorer. */
  gradeBand?: { min: number; max: number } | null;
}

/** The mentee application + applicant profile signals, normalized for scoring. */
export interface ApplicationInput {
  /**
   * ExpertiseArea slugs the mentee is seeking. The data layer normalizes
   * `preferredExpertise` AND maps free-text `interests` onto known slugs here, so
   * the scorer's expertise overlap stays purely slug-based and unambiguous.
   */
  requestedExpertiseSlugs: string[];
  /** Free-text interests — feed goal alignment (not expertise overlap). */
  interests: string[];
  /** goals + applicant careerGoal + leadershipGoal, joined — feeds goal alignment. */
  goalText: string;
  /** Free-text availability — feeds availability fit. */
  availability?: string | null;
  /** Reserved for future grade/age appropriateness. Unused by the current scorer. */
  menteeGrade?: number | null;
}

/**
 * Per-factor score breakdown persisted as
 * MentorshipMatchRecommendation.scoreBreakdownJson and rendered as prose by
 * explain.ts (never raw JSON as the primary UI).
 */
export interface ScoreBreakdown {
  expertiseOverlap: number;
  confidence: number;
  capacity: number;
  loadPenalty: number;
  goalAlignment: number;
  availabilityFit: number;
  completenessPenalty: number;
  finalScore: number;
}

/** Output of scoring one mentor against one application. */
export interface ScoredCandidate {
  mentorUserId: string;
  /** finalScore, duplicated at top level for convenient sorting/persistence. */
  score: number;
  breakdown: ScoreBreakdown;
  /** Requested areas the mentor covers — drives the human-readable explanation. */
  matchedExpertise: { slug: string; name: string }[];
  /** Open slots = capacity − activeLoad (0 when capacity undeclared). Tiebreak + UI. */
  openSlots: number;
  /** The original candidate, carried for explanations and UI. */
  candidate: MentorCandidate;
}
