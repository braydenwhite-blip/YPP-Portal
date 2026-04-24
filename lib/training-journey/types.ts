/**
 * Shared plain-data types for the interactive training journey.
 *
 * Intentionally NO Prisma imports: these types are safe to reference from
 * client components (which cannot depend on `@prisma/client`). Server-side
 * code should convert Prisma rows into these shapes via a serializer before
 * handing them to the client.
 *
 * Kind-specific payload shapes for `config` / `response` live in
 * `lib/training-journey/schemas.ts` (added in Phase 2) and are re-exported
 * from there.
 */

/** Mirrors the `InteractiveBeatKind` enum in prisma/schema.prisma. */
export type InteractiveBeatKind =
  | "CONCEPT_REVEAL"
  | "SCENARIO_CHOICE"
  | "MULTI_SELECT"
  | "SORT_ORDER"
  | "MATCH_PAIRS"
  | "SPOT_THE_MISTAKE"
  | "FILL_IN_BLANK"
  | "BRANCHING_SCENARIO"
  | "REFLECTION"
  | "COMPARE"
  | "HOTSPOT"
  | "MESSAGE_COMPOSER";

export const INTERACTIVE_BEAT_KINDS: readonly InteractiveBeatKind[] = [
  "CONCEPT_REVEAL",
  "SCENARIO_CHOICE",
  "MULTI_SELECT",
  "SORT_ORDER",
  "MATCH_PAIRS",
  "SPOT_THE_MISTAKE",
  "FILL_IN_BLANK",
  "BRANCHING_SCENARIO",
  "REFLECTION",
  "COMPARE",
  "HOTSPOT",
  "MESSAGE_COMPOSER",
] as const;

/** The `scoringRule` string is free-form in schema; canonical values here. */
export type BeatScoringRule =
  | "exact"
  | "threshold"
  | "ordered"
  | "pairs"
  | "rubric"
  | "manual";

/**
 * Declarative predicate used on child beats inside a BRANCHING_SCENARIO tree.
 * Evaluated against the latest attempt response for the ancestor beat
 * identified by `ancestorSourceKey`.
 */
export type ShowWhenPredicate =
  | { ancestorSourceKey: string; equals: string }
  | { ancestorSourceKey: string; in: string[] }
  | { ancestorSourceKey: string; notEquals: string };

/** Client-safe representation of a single beat. `config` stays `unknown` at
 *  this layer; the player narrows it via Zod at render time. */
export type ClientBeat = {
  id: string;
  journeyId: string;
  sourceKey: string;
  sortOrder: number;
  kind: InteractiveBeatKind;
  title: string;
  prompt: string;
  mediaUrl: string | null;
  config: unknown;
  schemaVersion: number;
  scoringWeight: number;
  scoringRule: BeatScoringRule | null;
  parentBeatId: string | null;
  showWhen: ShowWhenPredicate | null;
};

export type ClientJourney = {
  id: string;
  moduleId: string;
  estimatedMinutes: number;
  passScorePct: number;
  strictMode: boolean;
  version: number;
  beats: ClientBeat[];
};

/** Client-safe view of the latest attempt for a single beat. */
export type ClientBeatAttempt = {
  beatId: string;
  attemptNumber: number;
  response: unknown;
  responseSchemaVersion: number;
  correct: boolean;
  score: number;
  timeMs: number | null;
  hintsShown: number;
  attemptedAt: string;
};

/** Readiness-Check breakdown (one entry per source module domain). */
export type ReadinessModuleBreakdown = Record<string, number>;

export type ReadinessPersonalizedTip = {
  module: string;
  tip: string;
};

export type ClientJourneyCompletion = {
  journeyId: string;
  userId: string;
  totalScore: number;
  maxScore: number;
  scorePct: number;
  passed: boolean;
  firstTryCorrectCount: number;
  xpEarned: number;
  visitedBeatCount: number;
  moduleBreakdown: ReadinessModuleBreakdown | null;
  personalizedTips: ReadinessPersonalizedTip[] | null;
  completedAt: string;
};

// ---------------------------------------------------------------------------
// Scoring contract (Phase 2)
// ---------------------------------------------------------------------------

/** Shape authors write in `correctFeedback` / `incorrectFeedback`. */
export type BeatFeedback = {
  tone: "correct" | "partial" | "incorrect" | "noted";
  headline: string;
  body: string;
  hint?: string;
  callouts?: { label: string; target: string | number }[];
};

/** Minimum shape a scorer needs. The kind-specific `config` is narrowed by the
 *  scorer's own signature (see `BeatScorer<K>`) after Zod parsing at dispatch. */
export type ScoredBeat<Config = unknown> = {
  kind: InteractiveBeatKind;
  sourceKey: string;
  scoringWeight: number;
  scoringRule: BeatScoringRule | null;
  config: Config;
};

/** Uniform scorer return shape. `score` is an absolute count out of
 *  `scoringWeight`; aggregation happens at journey level. */
export type BeatScoreResult = {
  correct: boolean;
  /** Integer in `[0, scoringWeight]`. Partial credit allowed for
   *  SORT_ORDER, MATCH_PAIRS, BRANCHING_SCENARIO leaves (per plan §5). */
  score: number;
  feedback: BeatFeedback;
};

/** Per-kind scorer signature. Kind modules narrow the generics to their own
 *  schema-inferred types. `Config` and `Response` are constrained after the
 *  dispatcher runs the Zod parse — scorers never see raw input. */
export type BeatScorer<Config = unknown, Response = unknown> = (
  beat: ScoredBeat<Config>,
  response: Response
) => BeatScoreResult;

/**
 * Uniform module contract each `kinds/<kind>.ts` file must satisfy.
 *
 * Kind modules narrow the generics to their Zod-inferred types for authoring
 * ergonomics: `z.infer<typeof configSchema>` feeds directly into the scorer's
 * `beat.config` type.
 *
 * For STORAGE in the cross-kind registry (`KIND_MODULES` in `schemas.ts`),
 * the variance-safe alias `AnyBeatKindModule` below is used — `z.ZodType<T>`
 * is invariant in T, so narrower kind modules can't go into a
 * `BeatKindModule<unknown, unknown>` slot. `AnyBeatKindModule` widens both
 * schemas to `z.ZodTypeAny` which accepts any Zod shape (including the
 * `ZodEffects` wrappers produced by `.superRefine()` / `.transform()`).
 */
export type BeatKindModule<Config = unknown, Response = unknown> = {
  kind: InteractiveBeatKind;
  /** Increments per-kind when config/response shape changes incompatibly. */
  schemaVersion: number;
  /** Zod schema for `InteractiveBeat.config`. */
  configSchema: import("zod").ZodType<Config>;
  /** Zod schema for `InteractiveBeatAttempt.response`. */
  responseSchema: import("zod").ZodType<Response>;
  /** Pure scorer — assumes inputs already passed Zod. */
  scorer: BeatScorer<Config, Response>;
};

/** Registry-friendly widening: used by `schemas.ts` / `scoring.ts` so any
 *  kind module (regardless of its narrow generic parameters) fits into the
 *  single `KIND_MODULES` lookup. See `BeatKindModule` JSDoc above.
 *
 *  The scorer uses `any` parameter types (not `unknown`) intentionally: the
 *  dispatcher Zod-parses before calling, so the input IS the narrow
 *  kind-specific shape at runtime. `any` is the cleanest bridge between the
 *  narrow authoring type and the wide registry storage type (unknown would
 *  require every scorer to declare bivariant parameters). */
export type AnyBeatKindModule = {
  kind: InteractiveBeatKind;
  schemaVersion: number;
  configSchema: import("zod").ZodTypeAny;
  responseSchema: import("zod").ZodTypeAny;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scorer: (beat: ScoredBeat<any>, response: any) => BeatScoreResult;
};
