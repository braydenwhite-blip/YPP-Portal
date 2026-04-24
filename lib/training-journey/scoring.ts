/**
 * Beat scoring engine.
 *
 * One scorer per kind, registered in `SCORERS`. `scoreBeat()` is the only
 * entry point — it Zod-parses config + response before dispatching. All
 * scorers are pure and assume validated input, so config/response drift is
 * impossible at runtime (plan §5: "Defense-in-depth against drift").
 *
 * Aggregation across beats (journey completion math) is NOT the scorer's
 * concern; that lives in `lib/training-journey/actions.ts` (Phase 4).
 */

import { z } from "zod";

import { KIND_MODULES } from "./schemas";
import type {
  AnyBeatKindModule,
  BeatFeedback,
  BeatScoreResult,
  InteractiveBeatKind,
  ScoredBeat,
} from "./types";
import { INTERACTIVE_BEAT_KINDS } from "./types";

/** Minimum shape of the beat passed to `scoreBeat` — enough for the
 *  dispatcher to Zod-parse and hand off to a scorer. Callers typically pass
 *  a Prisma `InteractiveBeat` row (server-side) or a serialized `ClientBeat`. */
export type ScoreBeatInput = {
  kind: InteractiveBeatKind;
  sourceKey: string;
  scoringWeight: number;
  scoringRule: string | null;
  config: unknown;
};

/** Error thrown when config or response fails Zod parsing. Separate class so
 *  callers can distinguish content bugs (config) from user-submitted junk
 *  (response) and surface the right error. */
export class BeatValidationError extends Error {
  constructor(
    public readonly stage: "config" | "response",
    public readonly kind: InteractiveBeatKind,
    public readonly sourceKey: string,
    public readonly zodError: z.ZodError
  ) {
    super(
      `BeatValidationError: ${stage} failed Zod parse for kind=${kind} sourceKey=${sourceKey}`
    );
    this.name = "BeatValidationError";
  }
}

/** Registry — every kind contributes a scorer via its `BeatKindModule`. */
export const SCORERS: { [K in InteractiveBeatKind]: AnyBeatKindModule["scorer"] } =
  Object.fromEntries(
    INTERACTIVE_BEAT_KINDS.map((kind) => [kind, KIND_MODULES[kind].scorer])
  ) as { [K in InteractiveBeatKind]: AnyBeatKindModule["scorer"] };

/**
 * Score a single beat against a user response.
 *
 * Runs Zod parse on `config` then `response`, then dispatches to the
 * registered scorer. The scorer must return `{ correct, score, feedback }`
 * with `score ∈ [0, beat.scoringWeight]`.
 *
 * Throws `BeatValidationError` if either schema fails.
 */
export function scoreBeat(
  beat: ScoreBeatInput,
  response: unknown
): BeatScoreResult {
  const module = KIND_MODULES[beat.kind];
  if (!module) {
    throw new Error(`Unknown beat kind: ${beat.kind}`);
  }

  const configParse = module.configSchema.safeParse(beat.config);
  if (!configParse.success) {
    throw new BeatValidationError(
      "config",
      beat.kind,
      beat.sourceKey,
      configParse.error
    );
  }

  const responseParse = module.responseSchema.safeParse(response);
  if (!responseParse.success) {
    throw new BeatValidationError(
      "response",
      beat.kind,
      beat.sourceKey,
      responseParse.error
    );
  }

  const scoredBeat: ScoredBeat = {
    kind: beat.kind,
    sourceKey: beat.sourceKey,
    scoringWeight: beat.scoringWeight,
    scoringRule:
      (beat.scoringRule as ScoredBeat["scoringRule"]) ?? null,
    config: configParse.data,
  };

  const result = module.scorer(scoredBeat, responseParse.data);

  // Defense-in-depth: clamp to advertised score range. Each kind's unit tests
  // verify this holds; this is a final safety net.
  const clampedScore = Math.max(
    0,
    Math.min(beat.scoringWeight, Math.round(result.score))
  );

  return {
    correct: result.correct,
    score: clampedScore,
    feedback: result.feedback,
  };
}

/** Re-export the feedback shape for callers that want to narrow return types. */
export type { BeatFeedback, BeatScoreResult };
