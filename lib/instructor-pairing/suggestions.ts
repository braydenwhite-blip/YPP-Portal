// Instructor Pairing — deterministic instructor match suggestions.
//
// Pure, explainable, no AI. Mirrors the weighting of the existing
// rankInstructorsForOffering scorer but operates on already-loaded candidate
// data so it can be unit-tested and run once over a shared candidate pool.

import type { InstructorSuggestion } from "./types";

export type PairingCandidate = {
  id: string;
  name: string;
  chapterId: string | null;
  interests: string[];
  /** Training + interview complete (placement-ready). */
  baseReady: boolean;
  /** Training complete (may still need the interview). */
  trained: boolean;
  /** Current active assignment count. */
  activeLoad: number;
};

export type PairingTarget = {
  subject: string | null;
  chapterId: string | null;
};

/** A suggestion at/above this score is "strong" enough to route an uncovered
 *  class into Suggested matches rather than Needs instructor. */
export const STRONG_MATCH_SCORE = 25;

function subjectMatches(subject: string | null, interests: string[]): string | null {
  if (!subject) return null;
  const needle = subject.trim().toLowerCase();
  if (!needle) return null;
  for (const raw of interests) {
    const i = raw.trim().toLowerCase();
    if (!i) continue;
    if (i === needle || i.includes(needle) || needle.includes(i)) return raw.trim();
  }
  return null;
}

export function scoreInstructorForUnit(
  target: PairingTarget,
  candidate: PairingCandidate,
): InstructorSuggestion {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const matchedSubject = subjectMatches(target.subject, candidate.interests);
  if (matchedSubject) {
    score += 18;
    reasons.push(`${matchedSubject} interest`);
  }

  if (target.chapterId && candidate.chapterId === target.chapterId) {
    score += 20;
    reasons.push("Same chapter");
  }

  if (candidate.baseReady) {
    score += 30;
    reasons.push("Training + interview complete");
  } else if (candidate.trained) {
    score += 10;
    reasons.push("Training complete");
    warnings.push("Interview not yet passed");
  } else {
    warnings.push("Needs training before placement");
  }

  if (candidate.activeLoad === 0) {
    score += 5;
    reasons.push("No current class assignments");
  } else if (candidate.activeLoad <= 2) {
    reasons.push(`${candidate.activeLoad} current class${candidate.activeLoad === 1 ? "" : "es"}`);
  } else if (candidate.activeLoad <= 4) {
    score -= 5;
    warnings.push(`Already on ${candidate.activeLoad} classes`);
  } else {
    score -= 15;
    warnings.push(`Overloaded (${candidate.activeLoad} classes)`);
  }

  if (reasons.length === 0) reasons.push("Available instructor");

  return {
    instructorId: candidate.id,
    instructorName: candidate.name,
    score,
    reasons,
    warnings,
    trained: candidate.trained,
    activeLoad: candidate.activeLoad,
  };
}

/**
 * Rank a candidate pool for a target. Deterministic total order:
 * score desc → lighter load → name asc.
 */
export function buildInstructorMatchSuggestions(
  target: PairingTarget,
  candidates: PairingCandidate[],
  limit = 3,
): InstructorSuggestion[] {
  return candidates
    .map((c) => scoreInstructorForUnit(target, c))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.activeLoad !== b.activeLoad) return a.activeLoad - b.activeLoad;
      return a.instructorName.localeCompare(b.instructorName);
    })
    .slice(0, limit);
}
