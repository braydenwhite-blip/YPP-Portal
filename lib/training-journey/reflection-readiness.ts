/**
 * Pure helpers for the reflection-presence readiness gate in
 * `completeInteractiveJourney`.
 *
 * Reflection beats are intentionally ungraded — the per-kind scorer always
 * returns `score: 0` and stored beats have `scoringWeight: 0`. That means
 * reflection beats are excluded from the journey's scored-beat readiness
 * loop and from the score denominator. Without an additional gate, a
 * learner could complete a journey while skipping a required reflection.
 *
 * These helpers add a *presence* check: if a reflection beat is visible
 * (per the existing `showWhen` predicate), the learner's latest attempt
 * must contain non-empty trimmed text. They do NOT grade the reflection,
 * impose a length gate, or surface any score — length rules already live
 * in the reflection scorer at submit time.
 */

export type ReflectionAttemptForReadiness = {
  response: unknown;
} | null | undefined;

/**
 * True when the latest attempt's `response.text` is a non-empty string
 * after trimming. Any other shape (missing attempt, non-object response,
 * missing/non-string text, whitespace-only text) returns false.
 */
export function isReflectionSubmitted(
  attempt: ReflectionAttemptForReadiness
): boolean {
  if (!attempt) return false;
  const response = attempt.response;
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    return false;
  }
  const text = (response as { text?: unknown }).text;
  if (typeof text !== "string") return false;
  return text.trim().length > 0;
}

/**
 * Among the supplied beats, return the visible REFLECTION beats whose
 * latest attempt has not been submitted (or is empty). The journey
 * readiness gate fails if this returns a non-empty array.
 *
 * The caller passes its own `isVisible` predicate so this helper stays
 * decoupled from the journey's homegrown `showWhen` evaluator and
 * remains trivially unit-testable.
 */
export function findUnsubmittedReflectionBeats<
  TBeat extends { id: string; kind: string }
>(opts: {
  beats: TBeat[];
  isVisible: (beat: TBeat) => boolean;
  latestByBeatId: Map<string, ReflectionAttemptForReadiness>;
}): TBeat[] {
  return opts.beats.filter((beat) => {
    if (beat.kind !== "REFLECTION") return false;
    if (!opts.isVisible(beat)) return false;
    const latest = opts.latestByBeatId.get(beat.id) ?? null;
    return !isReflectionSubmitted(latest);
  });
}
