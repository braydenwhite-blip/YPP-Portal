/**
 * Deterministic scoring for partner research candidates (Partner Automation).
 *
 * Turns the research signals (space, age fit, enrichment programming, contact
 * confidence, proximity, community standing, prior relationship) into a single
 * 0–100 confidence score. Pure + testable; no network, no AI.
 */

import type { ResearchScoringFactors } from "@/lib/partners/research/types";

function clamp01(n: number | undefined): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// Weights (sum of maxes = 105, capped to 100). A strong, close, age-appropriate
// institution with a known contact scores near the top.
const W_SPACE = 20;
const W_AGE_FIT = 20;
const W_ENRICHMENT = 15;
const W_CONTACT = 15; // scaled by contactConfidence (0–1)
const W_PROXIMITY_MAX = 15; // 15 (≤5km) / 10 (≤15km) / 5 (≤40km)
const W_KNOWN = 8;
const W_PRIOR = 12;

function proximityPoints(km: number | null | undefined): number {
  if (km == null || !Number.isFinite(km)) return 0;
  if (km <= 5) return W_PROXIMITY_MAX;
  if (km <= 15) return 10;
  if (km <= 40) return 5;
  return 0;
}

export function scoreResearchCandidate(factors: ResearchScoringFactors): number {
  let score = 0;
  if (factors.likelyHasSpace) score += W_SPACE;
  if (factors.servesElementaryMiddle) score += W_AGE_FIT;
  if (factors.hasEnrichmentPrograms) score += W_ENRICHMENT;
  score += Math.round(clamp01(factors.contactConfidence) * W_CONTACT);
  score += proximityPoints(factors.proximityKm);
  if (factors.knownCommunityInstitution) score += W_KNOWN;
  if (factors.priorYppRelationship) score += W_PRIOR;
  return Math.max(0, Math.min(100, score));
}

/** Bucketed label for a confidence score, for calm display (no raw numbers req'd). */
export function confidenceLabel(score: number): "Strong" | "Promising" | "Worth a look" | "Low" {
  if (score >= 75) return "Strong";
  if (score >= 55) return "Promising";
  if (score >= 35) return "Worth a look";
  return "Low";
}
