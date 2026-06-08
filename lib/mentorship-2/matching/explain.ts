/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — human-readable explanations.
 *
 * Turns a match's score breakdown into prose + strength/risk bullets for the
 * admin matching queue. Per the phase rules, admins read *why* a mentor was
 * recommended in plain language — never raw JSON as the primary UI.
 *
 * The logic operates on a normalized `ExplainContext`. Two entry points adapt to
 * it: `explainRecommendation`/`recommendation{Strengths,Risks}` for a live
 * `ScoredCandidate` (used by the engine + tests), and
 * `explainRecommendationFromContext` for a persisted recommendation rendered from
 * the DB. Pure and defensive: a zero/empty input never throws.
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

/** Everything the explanation logic needs, decoupled from how it was sourced. */
export interface ExplainContext {
  score: number;
  breakdown: ScoreBreakdown;
  /** Requested areas the mentor covers (drives "Covers …"). */
  matchedExpertise: { slug: string; name: string }[];
  /** capacity − activeLoad (0 when capacity undeclared). */
  openSlots: number;
  activeLoad: number;
  capacity: number | null;
  /** Total declared expertise areas (for the completeness risk detail). */
  expertiseCount: number;
  hasAvailability: boolean;
  mentorName?: string | null;
}

function contextFromScored(scored: ScoredCandidate): ExplainContext {
  const candidate = scored?.candidate;
  const breakdown = scored?.breakdown ?? ({} as ScoreBreakdown);
  const availability = candidate?.availability;
  return {
    score: scored?.score ?? breakdown.finalScore ?? 0,
    breakdown,
    matchedExpertise: scored?.matchedExpertise ?? [],
    openSlots: scored?.openSlots ?? 0,
    activeLoad: candidate?.activeLoad ?? 0,
    capacity: candidate?.capacity ?? null,
    expertiseCount: candidate?.expertise?.length ?? 0,
    hasAvailability: Boolean(availability && String(availability).trim()),
    mentorName: candidate?.name ?? null,
  };
}

// ---- core logic (context-based) -------------------------------------------

function strengthsFromContext(ctx: ExplainContext): string[] {
  const b = ctx.breakdown ?? ({} as ScoreBreakdown);
  const out: string[] = [];
  const names = (ctx.matchedExpertise ?? []).map((e) => e.name).filter(Boolean);

  if (names.length > 0) out.push(`Covers ${formatList(names)}`);
  if ((b.confidence ?? 0) >= 10) {
    out.push("high confidence in those areas");
  } else if ((b.confidence ?? 0) > 0) {
    out.push("some confidence in those areas");
  }
  if ((b.capacity ?? 0) >= 10) {
    out.push(
      ctx.openSlots > 0
        ? `open capacity (${ctx.openSlots} slot${ctx.openSlots === 1 ? "" : "s"})`
        : "open capacity"
    );
  }
  if ((b.goalAlignment ?? 0) >= 8) out.push("aligns with the mentee's stated goals");
  if ((b.availabilityFit ?? 0) > 0) out.push("overlapping availability");
  return out;
}

function risksFromContext(ctx: ExplainContext): string[] {
  const b = ctx.breakdown ?? ({} as ScoreBreakdown);
  const out: string[] = [];

  if ((ctx.matchedExpertise ?? []).length === 0) {
    out.push("no overlap with the requested expertise");
  }
  if ((b.loadPenalty ?? 0) < 0) {
    const load = ctx.activeLoad ?? 0;
    out.push(`already mentoring ${load} mentee${load === 1 ? "" : "s"}`);
  }
  if ((b.completenessPenalty ?? 0) < 0) {
    const missing: string[] = [];
    if ((ctx.expertiseCount ?? 0) === 0) missing.push("no expertise declared");
    if (ctx.capacity == null) missing.push("no capacity set");
    if (!ctx.hasAvailability) missing.push("no availability set");
    if (missing.length > 0) out.push(`incomplete profile (${formatList(missing)})`);
  } else if ((b.capacity ?? 0) === 0 && ctx.capacity != null) {
    out.push("at or over capacity");
  }
  return out;
}

function proseFromContext(ctx: ExplainContext): string {
  const score = ctx.score ?? ctx.breakdown?.finalScore ?? 0;
  const tier = matchTierLabel(score);
  const who = ctx.mentorName ? `${ctx.mentorName} — ` : "";
  const strengths = strengthsFromContext(ctx);
  const risks = risksFromContext(ctx);

  let body: string;
  if (strengths.length > 0) {
    body = lowerFirst(strengths.join(", "));
  } else if (risks.length > 0) {
    body = "limited signal to recommend on";
  } else {
    body = "no strong signal either way";
  }

  const caveat = risks.length > 0 ? ` Caveat: ${lowerFirst(risks.join("; "))}.` : "";
  return `${who}${tier} (${score}): ${body}.${caveat}`;
}

// ---- public API: live ScoredCandidate -------------------------------------

export function recommendationStrengths(scored: ScoredCandidate): string[] {
  return strengthsFromContext(contextFromScored(scored));
}

export function recommendationRisks(scored: ScoredCandidate): string[] {
  return risksFromContext(contextFromScored(scored));
}

export function explainRecommendation(
  scored: ScoredCandidate,
  opts?: { mentorName?: string | null }
): string {
  const ctx = contextFromScored(scored);
  if (opts?.mentorName !== undefined) ctx.mentorName = opts.mentorName;
  return proseFromContext(ctx);
}

// ---- public API: persisted recommendation ---------------------------------

export function explainRecommendationFromContext(ctx: ExplainContext): {
  prose: string;
  strengths: string[];
  risks: string[];
} {
  return {
    prose: proseFromContext(ctx),
    strengths: strengthsFromContext(ctx),
    risks: risksFromContext(ctx),
  };
}

// ---- helpers --------------------------------------------------------------

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
