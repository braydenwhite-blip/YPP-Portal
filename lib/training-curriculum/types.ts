/**
 * Authoring-source types for the interactive training curriculum.
 *
 * Curriculum is written in TypeScript files under `lib/training-curriculum/`
 * (one per module). `scripts/import-training-academy-content.mjs` reads the
 * REGISTRY in `index.ts` and upserts `TrainingModule` + `InteractiveJourney`
 * + `InteractiveBeat` rows, keyed by stable `sourceKey`s so attempt history
 * is never orphaned across re-imports.
 *
 * `config` shapes on each beat are kind-specific and validated against the
 * Zod registry in `lib/training-journey/schemas.ts` during `training:validate`
 * and at import time — the types here intentionally stay wide so authors
 * don't fight TypeScript variance; the schemas enforce narrow shapes.
 */

import type {
  BeatScoringRule,
  InteractiveBeatKind,
  ShowWhenPredicate,
} from "@/lib/training-journey/types";

/**
 * A single beat inside a journey.
 *
 * `sourceKey` is the stable identity used for idempotent re-import. It must
 * be unique within a journey and should be human-readable:
 *   `"ypp-standard/beat-03-red-flags"`.
 *
 * For BRANCHING_SCENARIO trees, nest leaves under `children`; the importer
 * flattens them, wiring `parentBeatId` through resolved DB ids and storing
 * `showWhen` predicates on each child. `parentSourceKey` is optional — when
 * nesting is used it is inferred from position.
 */
export type BeatDefinition = {
  sourceKey: string;
  sortOrder: number;
  kind: InteractiveBeatKind;
  title: string;
  prompt: string;
  mediaUrl?: string | null;
  /** Kind-specific payload. Validated via `BEAT_CONFIG_SCHEMAS[kind]`. */
  config: unknown;
  schemaVersion?: number;
  /** 0 marks a beat as non-scored (CONCEPT_REVEAL, REFLECTION). */
  scoringWeight: number;
  scoringRule?: BeatScoringRule | null;
  parentSourceKey?: string | null;
  showWhen?: ShowWhenPredicate | null;
  children?: BeatDefinition[];
};

export type CurriculumModuleMeta = {
  title: string;
  description: string;
  sortOrder: number;
  required: boolean;
  passScorePct: number;
};

export type CurriculumJourneyMeta = {
  estimatedMinutes: number;
  strictMode: boolean;
  version: number;
};

export type CurriculumDefinition = {
  contentKey: string;
  module: CurriculumModuleMeta;
  journey: CurriculumJourneyMeta;
  beats: BeatDefinition[];
};
