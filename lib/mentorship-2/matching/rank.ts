/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — deterministic ranking.
 *
 * Scores every mentor against the application and orders them by a total,
 * deterministic comparator so ties are always broken the same way regardless of
 * input order. An empty mentor pool returns `[]`.
 */

import { scoreMentor } from "./score";
import type { ApplicationInput, MentorCandidate, ScoredCandidate } from "./types";

/** Below this final score, a mentor is not a usable match — surfaces the admin
 *  "no strong mentor available" warning. */
export const RECOMMENDATION_MIN_USEFUL_SCORE = 25;

/**
 * Total order over scored candidates:
 *   1. higher finalScore first,
 *   2. then more open capacity first,
 *   3. then mentorUserId ascending (unique ⇒ fully deterministic, stable ties).
 */
export function compareScored(a: ScoredCandidate, b: ScoredCandidate): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.openSlots !== a.openSlots) return b.openSlots - a.openSlots;
  if (a.mentorUserId < b.mentorUserId) return -1;
  if (a.mentorUserId > b.mentorUserId) return 1;
  return 0;
}

/** Score + rank a mentor pool for one application. Deterministic; `[]` when empty. */
export function rankMentors(
  application: ApplicationInput,
  mentors: MentorCandidate[]
): ScoredCandidate[] {
  if (!mentors || mentors.length === 0) return [];
  return mentors.map((m) => scoreMentor(application, m)).sort(compareScored);
}

/** The top `limit` ranked candidates (default 5). */
export function topRecommendations(
  application: ApplicationInput,
  mentors: MentorCandidate[],
  limit = 5
): ScoredCandidate[] {
  return rankMentors(application, mentors).slice(0, Math.max(0, limit));
}

/** True when at least one ranked candidate clears the usable-match threshold. */
export function hasUsableMatch(ranked: ScoredCandidate[]): boolean {
  return ranked.some((r) => r.score >= RECOMMENDATION_MIN_USEFUL_SCORE);
}
