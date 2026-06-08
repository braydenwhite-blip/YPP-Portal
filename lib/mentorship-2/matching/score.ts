/**
 * Mentorship 2.0 (Action Tracker 3.0, Phase M2) — the matching scorer.
 *
 * Deterministic and pure: same inputs always produce the same integer score and
 * breakdown. No randomness, no "AI match". Every factor is explainable (see
 * explain.ts) and capped, so the final score reads like a 0–100 confidence.
 *
 *   finalScore = clamp(
 *       expertiseOverlap      // 0 … 40
 *     + confidence            // 0 … 15
 *     + capacity              // 0 … 20
 *     + goalAlignment         // 0 … 15
 *     + availabilityFit       // 0 … 10   (max positive = 100)
 *     + loadPenalty           // -20 … 0
 *     + completenessPenalty   // -15 … 0
 *     , 0, 100)
 */

import type {
  ApplicationInput,
  MentorCandidate,
  ScoreBreakdown,
  ScoredCandidate,
} from "./types";

/** Max contribution of each factor — also exported for UI legends/tests. */
export const MATCH_WEIGHTS = {
  expertiseOverlap: 40,
  confidence: 15,
  capacity: 20,
  goalAlignment: 15,
  availabilityFit: 10,
  loadPenaltyPerOverload: -5,
  loadPenaltyFloor: -20,
  completenessPenaltyPerGap: -5,
  completenessPenaltyFloor: -15,
  maxScore: 100,
} as const;

/** How many open slots count toward a full capacity bonus. */
const CAPACITY_OPEN_CAP = 4;
/** Shared goal/expertise tokens needed for a full goal-alignment bonus. */
const GOAL_TOKEN_CAP = 3;
/** Shared availability tokens needed for a full availability-fit bonus. */
const AVAILABILITY_TOKEN_CAP = 2;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "you", "your", "our", "are",
  "was", "have", "has", "had", "will", "would", "want", "wants", "like",
  "into", "from", "about", "get", "getting", "help", "helping", "more",
  "much", "very", "can", "able", "need", "needs", "being", "been", "they",
  "them", "who", "how", "what", "but", "not", "all", "any", "out",
]);

/** Day / part-of-day words that make an availability overlap meaningful. */
const AVAILABILITY_KEYWORDS = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "weekday", "weekdays", "weekend", "weekends", "morning", "mornings",
  "afternoon", "afternoons", "evening", "evenings", "night", "nights",
  "daytime", "anytime", "flexible",
]);

/** Lowercase, strip punctuation, drop short words + stopwords. Deterministic. */
export function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function tokenSet(text: string | null | undefined): Set<string> {
  return new Set(tokenize(text));
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Normalize -0 → 0 so the persisted breakdown JSON never carries a negative zero. */
function noNegZero(value: number): number {
  return value === 0 ? 0 : value;
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

/**
 * Score one mentor against one application. Defensive against partial inputs
 * (missing arrays / undefined text) so an incomplete application never throws —
 * it simply produces a low, explainable score.
 */
export function scoreMentor(
  application: ApplicationInput,
  mentor: MentorCandidate
): ScoredCandidate {
  const requested = Array.from(
    new Set((application.requestedExpertiseSlugs ?? []).map(normalizeSlug).filter(Boolean))
  );
  const interests = application.interests ?? [];
  const goalText = application.goalText ?? "";
  const expertise = mentor.expertise ?? [];
  const activeLoad = Number.isFinite(mentor.activeLoad) ? mentor.activeLoad : 0;

  // 1. Expertise overlap — fraction of requested areas the mentor covers.
  const requestedSet = new Set(requested);
  const matchedExpertise = expertise.filter((e) =>
    requestedSet.has(normalizeSlug(e.slug))
  );
  const overlapFraction =
    requested.length > 0 ? matchedExpertise.length / requested.length : 0;
  const expertiseOverlap = Math.round(overlapFraction * MATCH_WEIGHTS.expertiseOverlap);

  // 2. Confidence — mean proficiency (1–3) of the matched areas, normalized.
  const confidence =
    matchedExpertise.length > 0
      ? Math.round(
          clamp(
            (avg(matchedExpertise.map((e) => e.proficiencyWeight)) - 1) / 2,
            0,
            1
          ) * MATCH_WEIGHTS.confidence
        )
      : 0;

  // 3. Capacity — open slots, capped, only when capacity is declared.
  const hasCapacity = mentor.capacity != null && Number.isFinite(mentor.capacity);
  const openSlots = hasCapacity ? (mentor.capacity as number) - activeLoad : 0;
  const capacity = hasCapacity
    ? Math.round(
        (clamp(openSlots, 0, CAPACITY_OPEN_CAP) / CAPACITY_OPEN_CAP) *
          MATCH_WEIGHTS.capacity
      )
    : 0;

  // 4. Load penalty — at/over capacity drags the score down. An undeclared
  //    capacity is treated as 0, so any existing load reads as overload.
  const effectiveCapacity = hasCapacity ? (mentor.capacity as number) : 0;
  const overloadUnits = Math.max(0, activeLoad - effectiveCapacity);
  const loadPenalty = noNegZero(
    Math.max(
      MATCH_WEIGHTS.loadPenaltyFloor,
      overloadUnits * MATCH_WEIGHTS.loadPenaltyPerOverload
    )
  );

  // 5. Goal alignment — token overlap of mentee goals/interests vs the mentor's
  //    declared expertise names + categories.
  const goalTokens = new Set<string>([
    ...tokenize(goalText),
    ...interests.flatMap((i) => tokenize(i)),
  ]);
  const mentorTokens = new Set<string>(
    expertise.flatMap((e) => [...tokenize(e.name), ...tokenize(e.category)])
  );
  const sharedGoalTokens = intersectionSize(goalTokens, mentorTokens);
  const goalAlignment = Math.round(
    (Math.min(sharedGoalTokens, GOAL_TOKEN_CAP) / GOAL_TOKEN_CAP) *
      MATCH_WEIGHTS.goalAlignment
  );

  // 6. Availability fit — shared day/part-of-day words. Either side missing ⇒ 0.
  const availabilityFit = scoreAvailabilityFit(
    application.availability,
    mentor.availability
  );

  // 7. Completeness penalty — punish thin mentor profiles.
  let gaps = 0;
  if (expertise.length === 0) gaps++;
  if (!hasCapacity) gaps++;
  if (!mentor.availability || !mentor.availability.trim()) gaps++;
  const completenessPenalty = noNegZero(
    Math.max(
      MATCH_WEIGHTS.completenessPenaltyFloor,
      gaps * MATCH_WEIGHTS.completenessPenaltyPerGap
    )
  );

  const finalScore = clamp(
    expertiseOverlap +
      confidence +
      capacity +
      goalAlignment +
      availabilityFit +
      loadPenalty +
      completenessPenalty,
    0,
    MATCH_WEIGHTS.maxScore
  );

  const breakdown: ScoreBreakdown = {
    expertiseOverlap,
    confidence,
    capacity,
    loadPenalty,
    goalAlignment,
    availabilityFit,
    completenessPenalty,
    finalScore,
  };

  return {
    mentorUserId: mentor.userId,
    score: finalScore,
    breakdown,
    matchedExpertise: dedupeBySlug(
      matchedExpertise.map((e) => ({ slug: e.slug, name: e.name || e.slug }))
    ),
    openSlots: hasCapacity ? openSlots : 0,
    candidate: mentor,
  };
}

function scoreAvailabilityFit(
  menteeAvailability: string | null | undefined,
  mentorAvailability: string | null | undefined
): number {
  if (!menteeAvailability || !mentorAvailability) return 0;
  const a = tokenSet(menteeAvailability);
  const b = tokenSet(mentorAvailability);
  let shared = 0;
  for (const t of a) {
    if (b.has(t) && AVAILABILITY_KEYWORDS.has(t)) shared++;
  }
  return Math.round(
    (Math.min(shared, AVAILABILITY_TOKEN_CAP) / AVAILABILITY_TOKEN_CAP) *
      MATCH_WEIGHTS.availabilityFit
  );
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

function dedupeBySlug(
  items: { slug: string; name: string }[]
): { slug: string; name: string }[] {
  const seen = new Set<string>();
  const out: { slug: string; name: string }[] = [];
  for (const item of items) {
    const key = normalizeSlug(item.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
