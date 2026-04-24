/**
 * Zod schema registry for every `InteractiveBeatKind`.
 *
 * Each kind contributes a `BeatKindModule` from `kinds/<kind>.ts`. This file
 * is the aggregation point — it fans the modules out into two lookup maps
 * keyed by kind:
 *   - `BEAT_CONFIG_SCHEMAS[kind]`    → validates `InteractiveBeat.config`
 *   - `BEAT_RESPONSE_SCHEMAS[kind]`  → validates `InteractiveBeatAttempt.response`
 *
 * Consumers:
 *   - `scripts/validate-training-academy-content.mjs` (Phase 3)
 *   - `scripts/import-training-academy-content.mjs` (Phase 3)
 *   - `lib/training-journey/scoring.ts` (this phase) — runtime defense-in-depth
 *   - `lib/training-journey/actions.ts` submit path (Phase 4)
 */

import type { z } from "zod";

import type { InteractiveBeatKind } from "./types";
import { INTERACTIVE_BEAT_KINDS } from "./types";

import { CONCEPT_REVEAL_MODULE } from "./kinds/concept-reveal";
import { SCENARIO_CHOICE_MODULE } from "./kinds/scenario-choice";
import { MULTI_SELECT_MODULE } from "./kinds/multi-select";
import { SORT_ORDER_MODULE } from "./kinds/sort-order";
import { MATCH_PAIRS_MODULE } from "./kinds/match-pairs";
import { SPOT_THE_MISTAKE_MODULE } from "./kinds/spot-the-mistake";
import { FILL_IN_BLANK_MODULE } from "./kinds/fill-in-blank";
import { HOTSPOT_MODULE } from "./kinds/hotspot";
import { BRANCHING_SCENARIO_MODULE } from "./kinds/branching-scenario";
import { REFLECTION_MODULE } from "./kinds/reflection";
import { COMPARE_MODULE } from "./kinds/compare";
import { MESSAGE_COMPOSER_MODULE } from "./kinds/message-composer";

import type { AnyBeatKindModule } from "./types";

/** Master registry — single source of truth for every kind's contract.
 *  Narrow `BeatKindModule<Config, Response>` values widen safely into the
 *  variance-friendly `AnyBeatKindModule` storage slot. */
export const KIND_MODULES: { [K in InteractiveBeatKind]: AnyBeatKindModule } = {
  CONCEPT_REVEAL: CONCEPT_REVEAL_MODULE,
  SCENARIO_CHOICE: SCENARIO_CHOICE_MODULE,
  MULTI_SELECT: MULTI_SELECT_MODULE,
  SORT_ORDER: SORT_ORDER_MODULE,
  MATCH_PAIRS: MATCH_PAIRS_MODULE,
  SPOT_THE_MISTAKE: SPOT_THE_MISTAKE_MODULE,
  FILL_IN_BLANK: FILL_IN_BLANK_MODULE,
  HOTSPOT: HOTSPOT_MODULE,
  BRANCHING_SCENARIO: BRANCHING_SCENARIO_MODULE,
  REFLECTION: REFLECTION_MODULE,
  COMPARE: COMPARE_MODULE,
  MESSAGE_COMPOSER: MESSAGE_COMPOSER_MODULE,
};

/** Config Zod schemas keyed by kind. Used by validate/import + dispatcher. */
export const BEAT_CONFIG_SCHEMAS: {
  [K in InteractiveBeatKind]: z.ZodType<unknown>;
} = Object.fromEntries(
  INTERACTIVE_BEAT_KINDS.map((kind) => [kind, KIND_MODULES[kind].configSchema])
) as { [K in InteractiveBeatKind]: z.ZodType<unknown> };

/** Response Zod schemas keyed by kind. Used by submit path + dispatcher. */
export const BEAT_RESPONSE_SCHEMAS: {
  [K in InteractiveBeatKind]: z.ZodType<unknown>;
} = Object.fromEntries(
  INTERACTIVE_BEAT_KINDS.map((kind) => [
    kind,
    KIND_MODULES[kind].responseSchema,
  ])
) as { [K in InteractiveBeatKind]: z.ZodType<unknown> };

/** Per-kind schema versions. Stamp on `InteractiveBeat.schemaVersion` and on
 *  `InteractiveBeatAttempt.responseSchemaVersion` so historical rows remain
 *  parseable after incompatible bumps. */
export const BEAT_SCHEMA_VERSIONS: { [K in InteractiveBeatKind]: number } =
  Object.fromEntries(
    INTERACTIVE_BEAT_KINDS.map((kind) => [kind, KIND_MODULES[kind].schemaVersion])
  ) as { [K in InteractiveBeatKind]: number };
