// Student Advising — deterministic advisor match suggestions.
//
// Pure, explainable, no AI. Given a student and a pool of candidate advisors
// (with their current caseload band + activity health already computed), rank
// the advisors and explain each suggestion in plain English. Capacity is
// respected: overloaded advisors are penalised, never silently hidden.

import type {
  AdvisingAdvisorRow,
  AdvisingStudentRow,
  AdvisorMatchSuggestion,
} from "./types";

/** A suggestion at or above this score is "strong" enough to route an
 *  unadvised student into the Suggested-matches lane instead of Needs-advisor. */
export const STRONG_SUGGESTION_SCORE = 18;

const INTEREST_POINTS = 12;
const INTEREST_CAP = 36;
const SAME_CHAPTER_POINTS = 20;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function sharedInterests(a: string[], b: string[]): string[] {
  const setB = new Set(b.map(normalize));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of a) {
    const key = normalize(raw);
    if (key && setB.has(key) && !seen.has(key)) {
      seen.add(key);
      out.push(raw.trim());
    }
  }
  return out;
}

/**
 * Score one advisor against one student. Deterministic and additive so the
 * reasons array always explains the exact number.
 */
export function scoreAdvisorForStudent(
  student: Pick<AdvisingStudentRow, "interests" | "chapterId" | "chapterName">,
  advisor: AdvisingAdvisorRow,
): AdvisorMatchSuggestion {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let score = 0;

  const shared = sharedInterests(student.interests, advisor.interests);
  if (shared.length > 0) {
    const pts = Math.min(shared.length * INTEREST_POINTS, INTEREST_CAP);
    score += pts;
    const list = shared.slice(0, 3).join(", ");
    reasons.push(
      shared.length > 3
        ? `Shares interests: ${list} +${shared.length - 3} more`
        : `Shares interests: ${list}`,
    );
  }

  if (
    student.chapterId &&
    advisor.chapterId &&
    student.chapterId === advisor.chapterId
  ) {
    score += SAME_CHAPTER_POINTS;
    reasons.push(
      advisor.chapterName ? `Same chapter (${advisor.chapterName})` : "Same chapter",
    );
  }

  // Capacity — reward room, penalise overload, never hide.
  if (advisor.band === "LOW") {
    score += 10;
    reasons.push(`Light caseload (${advisor.activeCount} student${advisor.activeCount === 1 ? "" : "s"})`);
  } else if (advisor.band === "TYPICAL") {
    score += 4;
    reasons.push(`Has room (${advisor.activeCount} students)`);
  } else {
    score -= 15;
    warnings.push(`Already advising ${advisor.activeCount} students — at capacity`);
  }

  // Activity health.
  if (advisor.health === "ACTIVE") {
    score += 6;
    reasons.push("Actively advising");
  } else if (advisor.health === "STALE") {
    score -= 4;
    warnings.push("Advising has been quiet lately");
  } else {
    score -= 10;
    warnings.push("Not currently active in advising");
  }

  if (reasons.length === 0) {
    reasons.push("Available advisor — no strong signal either way");
  }

  return {
    advisorId: advisor.id,
    advisorName: advisor.name,
    score,
    reasons,
    warnings,
    activeCount: advisor.activeCount,
    band: advisor.band,
  };
}

/**
 * Rank the advisor pool for a single student. Deterministic total order:
 * score desc → fewer active students → name asc.
 */
export function buildAdvisorMatchSuggestions(
  student: Pick<AdvisingStudentRow, "interests" | "chapterId" | "chapterName">,
  advisors: AdvisingAdvisorRow[],
  limit = 3,
): AdvisorMatchSuggestion[] {
  return advisors
    .map((advisor) => scoreAdvisorForStudent(student, advisor))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.activeCount !== b.activeCount) return a.activeCount - b.activeCount;
      return a.advisorName.localeCompare(b.advisorName);
    })
    .slice(0, limit);
}
