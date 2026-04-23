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
