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

/** Shape authors write in `correctFeedback` / `incorrectFeedback`.
 *
 *  Optional simulation fields (`studentReaction`, `consequence`, `roomDelta`,
 *  `peerRipple`, `mentorAside`, `ambientLine`, `recoveryPrompt`) let a beat
 *  behave like a teaching simulation rather than a quiz. The renderer phases
 *  them in cinematically:
 *
 *    mentorAside  →  studentReaction + peerRipple + consequence  →
 *      ambientLine (with coach typing dots)  →  mentor analysis
 *      [+ recoveryPrompt on incorrect, when authored]
 *
 *  All optional — existing curriculum content continues to render as before. */
export type BeatFeedback = {
  tone: "correct" | "partial" | "incorrect" | "noted";
  headline: string;
  body: string;
  hint?: string;
  callouts?: { label: string; target: string | number }[];

  /** A specific student's reaction to the move the learner just made.
   *  Rendered as a small card with avatar + body language + optional quote
   *  before the coach analysis. */
  studentReaction?: {
    studentName: string;
    archetype?:
      | "shy"
      | "overconfident"
      | "distracted"
      | "nervous"
      | "curious"
      | "resistant";
    quote?: string;
    bodyLanguage?: string;
    mood?:
      | "shutdown"
      | "engaged"
      | "confused"
      | "checked-out"
      | "energized"
      | "frustrated";
  };

  /** One-line "what happened in the room" headline shown above the mentor
   *  analysis. Use the present tense ("Maya re-engages.", "The room goes
   *  quiet."). */
  consequence?: string;

  /** Net effect on room state for the session HUD. Each axis is an integer
   *  delta in roughly [-2, +2]; the player clamps the running totals. */
  roomDelta?: {
    engagement?: number;
    clarity?: number;
    energy?: number;
  };

  /** A short social-ripple line: how OTHER students react to the move.
   *  Rendered as a quiet aside under the focal student card. Use the present
   *  tense ("Two cameras flicker on.", "Diego shifts in his seat."). */
  peerRipple?: string;

  /** Optional pre-reaction mentor quip — shown BEFORE the room reaction lands,
   *  to add pacing variety. Keep it short (≤8 words): "Watch this." /
   *  "Hold this for a second." / "OK — pause here." */
  mentorAside?: string;

  /** Atmospheric line shown between room reaction and mentor analysis,
   *  paired with a brief "coach typing" indicator. Use to give pauses weight:
   *  "The room holds its breath." / "A long pause stretches." */
  ambientLine?: string;

  /** Inline recovery beat shown ONLY on incorrect feedback. After the mentor
   *  analysis, the learner is asked one quick "what do you do now?" question
   *  with 2-3 light options. Each option carries a one-line reaction.
   *
   *  ──────────────────────────────────────────────────────────────────────
   *  COSMETIC CONTRACT — read this before persisting recovery picks.
   *  ──────────────────────────────────────────────────────────────────────
   *  The user's pick on a recoveryPrompt is INTENTIONALLY ephemeral and
   *  cosmetic-only:
   *
   *    1. The pick is NOT persisted on the InteractiveBeatAttempt row.
   *       The parent beat is already locked (incorrect) by the time the
   *       prompt renders — recoveryPrompt is a UX layer, not a re-attempt.
   *    2. The pick does NOT change the score. Resubmitting the parent
   *       beat would still need to use the kind module's normal scoring
   *       path; recovery picks bypass that on purpose.
   *    3. The optional `roomDelta` per option is applied to the live HUD
   *       state in the JourneyPlayer (via onRecoveryRoomDelta) but is
   *       NOT propagated to a stored room state — the meters reset on
   *       the next session.
   *
   *  If the design ever pivots toward persisted recovery scoring, this
   *  contract must be revisited together with the attempts schema, the
   *  client-contracts BeatSubmitInput shape, and the kind scorers. Until
   *  then: nothing about a recovery pick survives a page reload. */
  recoveryPrompt?: {
    question: string;
    options: {
      id: string;
      label: string;
      /** What the room/mentor does in response to this recovery move. */
      reaction: string;
      /** Optional small nudge on room state when this recovery move is
       *  picked. Same shape as roomDelta. Applied to the live HUD only. */
      roomDelta?: {
        engagement?: number;
        clarity?: number;
        energy?: number;
      };
    }[];
  };
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
