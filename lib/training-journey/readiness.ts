/**
 * Pure helper functions for the Readiness Check module (Module 5).
 *
 * `computeReadinessBreakdown` aggregates per-beat scores into a per-domain
 * fraction map. `computePersonalizedTips` converts that breakdown into 1–3
 * actionable tips pointing back to the weakest source modules.
 *
 * No IO, no side effects — both functions are fully deterministic given the
 * same inputs.
 */

import type {
  ReadinessModuleBreakdown,
  ReadinessPersonalizedTip,
} from "./types";

// ---------------------------------------------------------------------------
// ReadinessAttempt
// ---------------------------------------------------------------------------

/** Per-beat result fed into the breakdown. `sourceDomain` is a tag on each
 *  Readiness Check beat's config (authored in curriculum TS; e.g. a beat
 *  drawn from Module 2's bank has `sourceDomain: "run_session"`). */
export type ReadinessAttempt = {
  sourceDomain: string;
  /** Absolute points scored on this beat (≥ 0). */
  score: number;
  /** Beat's scoringWeight (> 0 for scored beats; 0 for unscored reflections). */
  maxScore: number;
};

// ---------------------------------------------------------------------------
// computeReadinessBreakdown
// ---------------------------------------------------------------------------

/**
 * Compute `score / maxScore` per `sourceDomain` across all attempts.
 *
 * - Beats with `maxScore === 0` (unscored, e.g. REFLECTION beats) are ignored
 *   entirely so they don't drag down domain fractions.
 * - Scores are **clamped** to `[0, 1]` per domain defensively — `score` should
 *   never exceed `maxScore`, but if it does the fraction is capped at 1.0.
 * - Returns `{}` when the input array is empty or contains only zero-weight
 *   beats.
 *
 * @param attempts - One entry per scored beat attempt.
 * @returns A `ReadinessModuleBreakdown` (Record<string, number>) where each
 *   value is a fraction in `[0, 1]`.
 */
export function computeReadinessBreakdown(
  attempts: ReadinessAttempt[]
): ReadinessModuleBreakdown {
  // Accumulate numerator and denominator per domain.
  const numerators: Record<string, number> = {};
  const denominators: Record<string, number> = {};

  for (const attempt of attempts) {
    // Skip unscored beats (e.g. reflections).
    if (attempt.maxScore === 0) continue;

    const { sourceDomain, score, maxScore } = attempt;

    numerators[sourceDomain] = (numerators[sourceDomain] ?? 0) + score;
    denominators[sourceDomain] = (denominators[sourceDomain] ?? 0) + maxScore;
  }

  const breakdown: ReadinessModuleBreakdown = {};

  for (const domain of Object.keys(denominators)) {
    const raw = numerators[domain]! / denominators[domain]!;
    // Clamp defensively to [0, 1].
    breakdown[domain] = Math.min(1, Math.max(0, raw));
  }

  return breakdown;
}

// ---------------------------------------------------------------------------
// ReadinessTipCatalog
// ---------------------------------------------------------------------------

/** Author-provided copy keyed by `sourceDomain`. Consumed by
 *  `computePersonalizedTips`. Kept in the function signature so authors can
 *  hot-swap copy without touching the helper itself. */
export type ReadinessTipCatalog = Record<
  string,
  { moduleLabel: string; tip: string }
>;

// ---------------------------------------------------------------------------
// computePersonalizedTips
// ---------------------------------------------------------------------------

/**
 * Given a readiness breakdown, emit 1–3 tips pointing to the weakest domains.
 *
 * **Rules (plan §4 Module 5):**
 * 1. Sort domains ascending by score fraction (lowest first). Ties are broken
 *    by domain key ascending so output is stable across runs.
 * 2. Take every domain scoring **below** `weaknessThreshold` (default 0.80),
 *    up to `maxTips` (default 3).
 *    - If NO domain is below the threshold (user passed everything cleanly),
 *      return `[]` — no tips needed.
 * 3. If fewer than `minTips` (default 1) fell below the threshold, still emit
 *    the lowest-scoring domain **if** its fraction is below 0.95. This ensures
 *    the pass screen always has something actionable without nagging near-
 *    perfect scorers.
 * 4. Domains missing from the `catalog` are skipped silently (their entry
 *    won't appear in the returned array).
 *
 * @param breakdown - Output of `computeReadinessBreakdown`.
 * @param catalog   - Author-controlled copy map from domain key → tip copy.
 * @param options   - Optional override for thresholds.
 * @returns Array of `ReadinessPersonalizedTip` sorted lowest-score first.
 */
export function computePersonalizedTips(
  breakdown: ReadinessModuleBreakdown,
  catalog: ReadinessTipCatalog,
  options?: {
    /** Domains below this fraction are considered weak. Default: 0.8. */
    weaknessThreshold?: number;
    /** Maximum number of tips to return. Default: 3. */
    maxTips?: number;
    /** Minimum number of tips to attempt (see rule 3). Default: 1. */
    minTips?: number;
  }
): ReadinessPersonalizedTip[] {
  const weaknessThreshold = options?.weaknessThreshold ?? 0.8;
  const maxTips = options?.maxTips ?? 3;
  const minTips = options?.minTips ?? 1;

  // Step 1: Sort domains ascending by fraction, then by key as tiebreaker.
  const sorted = Object.entries(breakdown).sort(([aKey, aVal], [bKey, bVal]) => {
    if (aVal !== bVal) return aVal - bVal;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  // Step 2: Collect domains below threshold (up to maxTips).
  const weak = sorted.filter(([, val]) => val < weaknessThreshold);
  const capped = weak.slice(0, maxTips);

  // Rule: if NO domain fell below the threshold, overall is passing → return [].
  if (weak.length === 0) {
    return [];
  }

  // Step 2 continued: we have at least one weak domain.
  if (capped.length >= minTips) {
    return buildTips(capped, catalog);
  }

  // Step 3: minTips floor — some domains are weak (weak.length > 0) but fewer
  // than minTips qualified. Still emit the lowest domain if its score < 0.95
  // so the pass screen isn't completely empty.
  if (sorted.length > 0) {
    const [lowestKey, lowestVal] = sorted[0]!;
    if (lowestVal < 0.95) {
      return buildTips([[lowestKey, lowestVal]], catalog);
    }
  }

  // No actionable tips — everyone scored well enough.
  return [];
}

// ---------------------------------------------------------------------------
// Private helper
// ---------------------------------------------------------------------------

/** Map sorted `[domain, fraction]` pairs to `ReadinessPersonalizedTip[]`,
 *  silently skipping any domain absent from the catalog. */
function buildTips(
  pairs: [string, number][],
  catalog: ReadinessTipCatalog
): ReadinessPersonalizedTip[] {
  const tips: ReadinessPersonalizedTip[] = [];

  for (const [domain] of pairs) {
    const entry = catalog[domain];
    if (!entry) continue; // Missing from catalog — skip silently.
    tips.push({ module: entry.moduleLabel, tip: entry.tip });
  }

  return tips;
}
