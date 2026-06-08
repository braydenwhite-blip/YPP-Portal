/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — human-readable explanations.
 *
 * Turns a ScoredCandidate's breakdown into prose + strength/risk bullets for the
 * admin matching queue. Per the phase rules, admins read *why* a mentor was
 * recommended in plain language — never raw JSON as the primary UI. Pure and
 * defensive: a zero/empty breakdown never throws.
 */

import type { ScoreBreakdown, ScoredCandidate } from "./types";

export type MatchTier = "strong" | "solid" | "possible" | "weak";

const TIER_LABEL: Record<MatchTier, string> = {
  strong: "Strong match",
  solid: "Solid match",
  possible: "Possible match",
  weak: "Weak match",
};

export function scoreTier(score: number): MatchTier {
  if (score >= 70) return "strong";
  if (score >= 45) return "solid";
  if (score >= 25) return "possible";
  return "weak";
}

export function matchTierLabel(score: number): string {
  return TIER_LABEL[scoreTier(score)];
}

function expertiseNames(scored: ScoredCandidate): string[] {
  return (scored.matchedExpertise ?? []).map((e) => e.name).filter(Boolean);
}

/** Plain-language reasons this mentor is a good pick. */
export function recommendationStrengths(scored: ScoredCandidate): string[] {
  const b = scored.breakdown ?? ({} as ScoreBreakdown);
  const out: string[] = [];
  const names = expertiseNames(scored);

  if (names.length > 0) {
    out.push(`Covers ${formatList(names)}`);
  }
  if ((b.confidence ?? 0) >= 10) {
    out.push("high confidence in those areas");
  } else if ((b.confidence ?? 0) > 0) {
    out.push("some confidence in those areas");
  }
  if ((b.capacity ?? 0) >= 10) {
    const slots = scored.openSlots;
    out.push(slots > 0 ? `open capacity (${slots} slot${slots === 1 ? "" : "s"})` : "open capacity");
  }
  if ((b.goalAlignment ?? 0) >= 8) {
    out.push("aligns with the mentee's stated goals");
  }
  if ((b.availabilityFit ?? 0) > 0) {
    out.push("overlapping availability");
  }
  return out;
}

/** Plain-language risks / weaknesses for this pairing. */
export function recommendationRisks(scored: ScoredCandidate): string[] {
  const b = scored.breakdown ?? ({} as ScoreBreakdown);
  const out: string[] = [];
  const candidate = scored.candidate;

  if (expertiseNames(scored).length === 0) {
    out.push("no overlap with the requested expertise");
  }
  if ((b.loadPenalty ?? 0) < 0 && candidate) {
    const load = candidate.activeLoad ?? 0;
    out.push(`already mentoring ${load} mentee${load === 1 ? "" : "s"}`);
  }
  if ((b.completenessPenalty ?? 0) < 0 && candidate) {
    const missing: string[] = [];
    if ((candidate.expertise?.length ?? 0) === 0) missing.push("no expertise declared");
    if (candidate.capacity == null) missing.push("no capacity set");
    if (!candidate.availability || !candidate.availability.trim())
      missing.push("no availability set");
    if (missing.length > 0) out.push(`incomplete profile (${formatList(missing)})`);
  } else if ((b.capacity ?? 0) === 0 && candidate && candidate.capacity != null) {
    out.push("at or over capacity");
  }
  return out;
}

/**
 * One-line prose explanation, e.g.:
 *   "Strong match (72): covers Sports Business and Leadership Development, high
 *    confidence in those areas, open capacity. Caveat: already mentoring 2 mentees."
 */
export function explainRecommendation(
  scored: ScoredCandidate,
  opts?: { mentorName?: string | null }
): string {
  const score = scored.score ?? scored.breakdown?.finalScore ?? 0;
  const tier = matchTierLabel(score);
  const who = opts?.mentorName ? `${opts.mentorName} — ` : "";
  const strengths = recommendationStrengths(scored);
  const risks = recommendationRisks(scored);

  let body: string;
  if (strengths.length > 0) {
    body = lowerFirst(strengths.join(", "));
  } else if (risks.length > 0) {
    body = "limited signal to recommend on";
  } else {
    body = "no strong signal either way";
  }

  const caveat =
    risks.length > 0 ? ` Caveat: ${lowerFirst(risks.join("; "))}.` : "";
  return `${who}${tier} (${score}): ${body}.${caveat}`;
}

function formatList(items: string[]): string {
  const clean = items.filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} and ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}
