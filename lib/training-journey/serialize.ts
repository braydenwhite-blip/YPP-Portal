/**
 * Server-side filter: strip answer-key fields from a beat's `config` before
 * shipping it to the client. Called by the viewer RSC for every beat.
 *
 * Plan §9 Security: "The correct answer is never sent to the client. This is
 * enforced in a single `serializeBeatForClient(beat)` helper used by every
 * RSC that ships beats to the wire."
 *
 * Strategy: per-kind ALLOWLIST. Any field not explicitly listed is stripped.
 * This is safer than a blocklist because new fields are hidden by default
 * until the author explicitly opts them into the client payload.
 *
 * For option arrays that carry correctness flags or answer tags (MULTI_SELECT,
 * MESSAGE_COMPOSER), the per-item filter strips those before serializing.
 */

import type { ClientBeat, InteractiveBeatKind } from "./types";

type PrismaBeatRow = {
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
  scoringRule: string | null;
  parentBeatId: string | null;
  showWhen: unknown;
};

/**
 * Top-level config fields safe to ship per kind.
 *
 * Deliberately excluded everywhere: `correctOptionId`, `correctTargetId`,
 * `correctRegionId`, `correctOrder`, `correctPairs`, `acceptedAnswers`,
 * `acceptedPatterns`, `rubric`, `correctFeedback`, `incorrectFeedback`,
 * `minimumCorrect`.
 */
const SAFE_CONFIG_FIELDS: Record<InteractiveBeatKind, readonly string[]> = {
  CONCEPT_REVEAL: ["panels"],
  SCENARIO_CHOICE: ["options"],
  MULTI_SELECT: ["options", "scoringMode"],
  SORT_ORDER: ["items", "partialCredit"],
  MATCH_PAIRS: ["leftItems", "rightItems", "partialCredit", "hint"],
  SPOT_THE_MISTAKE: ["passage", "targets", "hint"],
  FILL_IN_BLANK: ["caseSensitive", "hint"],
  BRANCHING_SCENARIO: ["rootPrompt", "options"],
  REFLECTION: ["minLength", "maxLength", "sampleAnswers"],
  COMPARE: ["optionA", "optionB"],
  HOTSPOT: ["imageUrl", "width", "height", "regions", "hint"],
  MESSAGE_COMPOSER: ["snippetPools"],
};

function filterMultiSelectOptions(options: unknown): unknown {
  if (!Array.isArray(options)) return options;
  return options.map((o) => {
    if (o && typeof o === "object") {
      const { correct: _correct, ...rest } = o as Record<string, unknown>;
      return rest;
    }
    return o;
  });
}

function filterMessageComposerPools(pools: unknown): unknown {
  if (!Array.isArray(pools)) return pools;
  return pools.map((pool) => {
    if (!pool || typeof pool !== "object") return pool;
    const p = pool as Record<string, unknown>;
    const snippets = Array.isArray(p.snippets)
      ? p.snippets.map((s) => {
          if (!s || typeof s !== "object") return s;
          const { tags: _tags, ...rest } = s as Record<string, unknown>;
          return rest;
        })
      : p.snippets;
    return { ...p, snippets };
  });
}

function filterHotspotRegions(regions: unknown): unknown {
  if (!Array.isArray(regions)) return regions;
  return regions.map((r) => {
    if (!r || typeof r !== "object") return r;
    // Strip any `correct` flag if added in future; keep id/label/geometry.
    const { correct: _correct, ...rest } = r as Record<string, unknown>;
    return rest;
  });
}

function filterConfig(
  kind: InteractiveBeatKind,
  config: unknown
): Record<string, unknown> {
  if (!config || typeof config !== "object") return {};
  const src = config as Record<string, unknown>;
  const allowed = SAFE_CONFIG_FIELDS[kind] ?? [];
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!(key in src)) continue;
    const value = src[key];
    if (kind === "MULTI_SELECT" && key === "options") {
      out[key] = filterMultiSelectOptions(value);
    } else if (kind === "MESSAGE_COMPOSER" && key === "snippetPools") {
      out[key] = filterMessageComposerPools(value);
    } else if (kind === "HOTSPOT" && key === "regions") {
      out[key] = filterHotspotRegions(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Convert a Prisma `InteractiveBeat` row into the client-safe shape. Strips
 * every field not in `SAFE_CONFIG_FIELDS[kind]`, rewrites option/snippet
 * arrays that carry correctness flags, and drops feedback maps entirely.
 */
export function serializeBeatForClient(beat: PrismaBeatRow): ClientBeat {
  return {
    id: beat.id,
    journeyId: beat.journeyId,
    sourceKey: beat.sourceKey,
    sortOrder: beat.sortOrder,
    kind: beat.kind,
    title: beat.title,
    prompt: beat.prompt,
    mediaUrl: beat.mediaUrl,
    config: filterConfig(beat.kind, beat.config),
    schemaVersion: beat.schemaVersion,
    scoringWeight: beat.scoringWeight,
    scoringRule: (beat.scoringRule as ClientBeat["scoringRule"]) ?? null,
    parentBeatId: beat.parentBeatId,
    showWhen: (beat.showWhen ?? null) as ClientBeat["showWhen"],
  };
}
