/**
 * Pure, framework-free conversion between an `InteractiveBeat.config` object
 * and an editor-friendly "form model" for every editor-supported beat kind.
 *
 * These helpers exist so a non-technical admin can edit a beat through plain
 * form fields instead of hand-writing JSON. The React layer
 * (`app/(app)/admin/journeys/[id]/beat-config-form.tsx`) renders the form
 * model; on save it calls `formModelToConfig()` and hands the result to
 * `updateDraftBeat()`, which re-validates against the kind's Zod
 * `configSchema` (the same schema used at import + runtime).
 *
 * Design rules:
 *   - PURE: no React, no DB, no zod-from-network. Trivially unit-testable
 *     (see tests/lib/journey-editor-beat-config-forms.test.ts).
 *   - LOSSLESS: `formModelToConfig` merges onto the *existing* config so
 *     advanced fields the form does not surface (acceptedPatterns,
 *     sampleAnswers, feedback immersion fields, extra incorrectFeedback
 *     keys) survive a round-trip through the visual editor.
 *   - SCHEMA-SAFE: every emitted config is shaped to parse against
 *     `BEAT_CONFIG_SCHEMAS[kind]`. Derived fields (SORT_ORDER's correctOrder,
 *     MATCH_PAIRS' correctPairs, SPOT_THE_MISTAKE's character offsets) are
 *     computed here so the admin never edits an index map by hand.
 */

import type { InteractiveBeatKind } from "./types";

export const STRUCTURED_BEAT_KINDS = [
  "REFLECTION",
  "SORT_ORDER",
  "FILL_IN_BLANK",
  "MATCH_PAIRS",
  "CONCEPT_REVEAL",
  "CONTENT_BLOCK",
  "SCENARIO_CHOICE",
  "MULTI_SELECT",
  "SPOT_THE_MISTAKE",
  "BRANCHING_SCENARIO",
  "COMPARE",
  "HOTSPOT",
  "MESSAGE_COMPOSER",
] as const satisfies readonly InteractiveBeatKind[];

export type StructuredBeatKind = (typeof STRUCTURED_BEAT_KINDS)[number];

export function isStructuredBeatKind(kind: string): kind is StructuredBeatKind {
  return (STRUCTURED_BEAT_KINDS as readonly string[]).includes(kind);
}

/** The slice of `BeatFeedback` an admin edits inline. Tone is preserved from
 *  the existing config (or defaulted) so we never widen the feedback contract. */
export interface FeedbackForm {
  headline: string;
  body: string;
}

// ----------------------------------------------------------------------------
// Existing four kinds
// ----------------------------------------------------------------------------

export interface ReflectionForm {
  kind: "REFLECTION";
  prompt: string;
  minLength: number;
  maxLength: number;
  correct: FeedbackForm;
}

export interface SortOrderItemForm {
  id: string;
  label: string;
}

export interface SortOrderForm {
  kind: "SORT_ORDER";
  /** Stored in the *correct* order — the runtime shuffles for the learner. */
  items: SortOrderItemForm[];
  partialCredit: boolean;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface FillInBlankForm {
  kind: "FILL_IN_BLANK";
  prompt: string;
  acceptedAnswers: string[];
  caseSensitive: boolean;
  hint: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface MatchPairRowForm {
  leftId: string;
  leftLabel: string;
  rightId: string;
  rightLabel: string;
}

export interface MatchPairsForm {
  kind: "MATCH_PAIRS";
  pairs: MatchPairRowForm[];
  partialCredit: boolean;
  hint: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

// ----------------------------------------------------------------------------
// Nine added kinds
// ----------------------------------------------------------------------------

export interface PanelForm {
  id: string;
  title: string;
  body: string;
}

export interface ConceptRevealForm {
  kind: "CONCEPT_REVEAL";
  panels: PanelForm[];
  correct: FeedbackForm;
}

export interface SectionForm {
  id: string;
  heading: string;
  body: string;
}

export interface ContentBlockForm {
  kind: "CONTENT_BLOCK";
  sections: SectionForm[];
  mediaUrl: string;
  mediaAlt: string;
  mediaCaption: string;
  correct: FeedbackForm;
}

export interface ChoiceOptionForm {
  id: string;
  label: string;
}

export interface ScenarioChoiceForm {
  kind: "SCENARIO_CHOICE";
  options: ChoiceOptionForm[];
  correctOptionId: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface MultiSelectOptionForm {
  id: string;
  label: string;
  correct: boolean;
}

export interface MultiSelectForm {
  kind: "MULTI_SELECT";
  options: MultiSelectOptionForm[];
  scoringMode: "all-or-nothing" | "threshold";
  minimumCorrect: number | null;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface SpotTargetForm {
  id: string;
  /** The exact phrase in the passage; character offsets are computed on save. */
  phrase: string;
  label: string;
}

export interface SpotTheMistakeForm {
  kind: "SPOT_THE_MISTAKE";
  passage: string;
  targets: SpotTargetForm[];
  correctTargetId: string;
  hint: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface BranchOptionForm {
  id: string;
  label: string;
  /** sourceKey of the beat this choice leads to; "" means no branch. */
  leadsToChildSourceKey: string;
}

export interface BranchingScenarioForm {
  kind: "BRANCHING_SCENARIO";
  rootPrompt: string;
  options: BranchOptionForm[];
  /** When true there is no wrong answer (correctOptionId = null). */
  noWrongAnswer: boolean;
  correctOptionId: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface CompareOptionForm {
  id: string;
  label: string;
  body: string;
}

export interface CompareForm {
  kind: "COMPARE";
  optionA: CompareOptionForm;
  optionB: CompareOptionForm;
  correctOptionId: "A" | "B";
  requiredRationaleTag: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface RegionForm {
  id: string;
  label: string;
  /** All normalized to [0, 1]; the UI presents them as percentages. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HotspotForm {
  kind: "HOTSPOT";
  imageUrl: string;
  regions: RegionForm[];
  correctRegionId: string;
  hint: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export interface SnippetForm {
  id: string;
  label: string;
  /** Comma-separated tags for friendly editing. */
  tags: string;
}

export interface PoolForm {
  poolId: string;
  label: string;
  minSelections: number | null;
  maxSelections: number | null;
  snippets: SnippetForm[];
}

export interface MessageComposerForm {
  kind: "MESSAGE_COMPOSER";
  pools: PoolForm[];
  /** Comma-separated tag lists. */
  requiredTags: string;
  bannedTags: string;
  correct: FeedbackForm;
  incorrect: FeedbackForm;
}

export type BeatConfigForm =
  | ReflectionForm
  | SortOrderForm
  | FillInBlankForm
  | MatchPairsForm
  | ConceptRevealForm
  | ContentBlockForm
  | ScenarioChoiceForm
  | MultiSelectForm
  | SpotTheMistakeForm
  | BranchingScenarioForm
  | CompareForm
  | HotspotForm
  | MessageComposerForm;

// ----------------------------------------------------------------------------
// Defensive readers — config is `unknown` until validated server-side.
// ----------------------------------------------------------------------------

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function strArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function readFeedback(value: unknown): FeedbackForm {
  const r = asRecord(value);
  return { headline: str(r.headline), body: str(r.body) };
}

/** Read the "default" entry of an incorrectFeedback record. */
function readIncorrectDefault(value: unknown): FeedbackForm {
  return readFeedback(asRecord(value).default);
}

function readItems(value: unknown): SortOrderItemForm[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const r = asRecord(entry);
      return { id: str(r.id), label: str(r.label) };
    })
    .filter((i) => i.id !== "");
}

function tagsToString(value: unknown): string {
  return strArray(value).join(", ");
}

function stringToTags(value: string): string[] {
  return value
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// ----------------------------------------------------------------------------
// config -> form model
// ----------------------------------------------------------------------------

export function configToFormModel(
  kind: StructuredBeatKind,
  config: unknown,
): BeatConfigForm {
  const c = asRecord(config);

  switch (kind) {
    case "REFLECTION":
      return {
        kind,
        prompt: str(c.prompt),
        minLength: num(c.minLength, 20),
        maxLength: num(c.maxLength, 600),
        correct: readFeedback(c.correctFeedback),
      };

    case "SORT_ORDER": {
      const items = readItems(c.items);
      const correctOrder = strArray(c.correctOrder);
      const ordered =
        correctOrder.length === items.length
          ? correctOrder
              .map((id) => items.find((i) => i.id === id))
              .filter((i): i is SortOrderItemForm => Boolean(i))
          : items;
      return {
        kind,
        items: ordered,
        partialCredit: bool(c.partialCredit, false),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "FILL_IN_BLANK":
      return {
        kind,
        prompt: str(c.prompt),
        acceptedAnswers: strArray(c.acceptedAnswers),
        caseSensitive: bool(c.caseSensitive, false),
        hint: str(c.hint),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };

    case "MATCH_PAIRS": {
      const leftItems = readItems(c.leftItems);
      const rightItems = readItems(c.rightItems);
      const rightById = new Map(rightItems.map((i) => [i.id, i.label]));
      const leftById = new Map(leftItems.map((i) => [i.id, i.label]));
      const correctPairs = Array.isArray(c.correctPairs) ? c.correctPairs : [];
      const pairs: MatchPairRowForm[] = correctPairs
        .map((entry) => {
          const r = asRecord(entry);
          const leftId = str(r.leftId);
          const rightId = str(r.rightId);
          return {
            leftId,
            leftLabel: leftById.get(leftId) ?? "",
            rightId,
            rightLabel: rightById.get(rightId) ?? "",
          };
        })
        .filter((p) => p.leftId !== "" && p.rightId !== "");
      return {
        kind,
        pairs,
        partialCredit: bool(c.partialCredit, true),
        hint: str(c.hint),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "CONCEPT_REVEAL": {
      const panels = (Array.isArray(c.panels) ? c.panels : []).map((entry) => {
        const r = asRecord(entry);
        return { id: str(r.id), title: str(r.title), body: str(r.body) };
      });
      return {
        kind,
        panels,
        correct: readFeedback(c.correctFeedback),
      };
    }

    case "CONTENT_BLOCK": {
      const sections = (Array.isArray(c.sections) ? c.sections : []).map((entry) => {
        const r = asRecord(entry);
        return { id: str(r.id), heading: str(r.heading), body: str(r.body) };
      });
      const media = asRecord(c.media);
      return {
        kind,
        sections,
        mediaUrl: str(media.url),
        mediaAlt: str(media.alt),
        mediaCaption: str(media.caption),
        correct: readFeedback(c.correctFeedback),
      };
    }

    case "SCENARIO_CHOICE": {
      const options = readItems(c.options);
      return {
        kind,
        options,
        correctOptionId: str(c.correctOptionId, options[0]?.id ?? ""),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "MULTI_SELECT": {
      const options = (Array.isArray(c.options) ? c.options : []).map((entry) => {
        const r = asRecord(entry);
        return { id: str(r.id), label: str(r.label), correct: bool(r.correct, false) };
      });
      const minRaw = c.minimumCorrect;
      return {
        kind,
        options,
        scoringMode: c.scoringMode === "threshold" ? "threshold" : "all-or-nothing",
        minimumCorrect: typeof minRaw === "number" ? minRaw : null,
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "SPOT_THE_MISTAKE": {
      const passage = str(c.passage);
      const targets = (Array.isArray(c.targets) ? c.targets : []).map((entry) => {
        const r = asRecord(entry);
        const start = num(r.start, 0);
        const end = num(r.end, 0);
        const phrase =
          end > start && end <= passage.length ? passage.slice(start, end) : "";
        return { id: str(r.id), phrase, label: str(r.label) };
      });
      return {
        kind,
        passage,
        targets,
        correctTargetId: str(c.correctTargetId, targets[0]?.id ?? ""),
        hint: str(c.hint),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "BRANCHING_SCENARIO": {
      const options = (Array.isArray(c.options) ? c.options : []).map((entry) => {
        const r = asRecord(entry);
        return {
          id: str(r.id),
          label: str(r.label),
          leadsToChildSourceKey:
            typeof r.leadsToChildSourceKey === "string" ? r.leadsToChildSourceKey : "",
        };
      });
      const correctOptionId = c.correctOptionId;
      return {
        kind,
        rootPrompt: str(c.rootPrompt),
        options,
        noWrongAnswer: correctOptionId === null || correctOptionId === undefined,
        correctOptionId: typeof correctOptionId === "string" ? correctOptionId : options[0]?.id ?? "",
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "COMPARE": {
      const a = asRecord(c.optionA);
      const b = asRecord(c.optionB);
      return {
        kind,
        optionA: { id: str(a.id, "A"), label: str(a.label), body: str(a.body) },
        optionB: { id: str(b.id, "B"), label: str(b.label), body: str(b.body) },
        correctOptionId: c.correctOptionId === "B" ? "B" : "A",
        requiredRationaleTag: str(c.requiredRationaleTag),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "HOTSPOT": {
      const regions = (Array.isArray(c.regions) ? c.regions : []).map((entry) => {
        const r = asRecord(entry);
        return {
          id: str(r.id),
          label: str(r.label),
          x: num(r.x, 0),
          y: num(r.y, 0),
          width: num(r.width, 0),
          height: num(r.height, 0),
        };
      });
      return {
        kind,
        imageUrl: str(c.imageUrl),
        regions,
        correctRegionId: str(c.correctRegionId, regions[0]?.id ?? ""),
        hint: str(c.hint),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }

    case "MESSAGE_COMPOSER": {
      const pools = (Array.isArray(c.snippetPools) ? c.snippetPools : []).map((entry) => {
        const r = asRecord(entry);
        const snippets = (Array.isArray(r.snippets) ? r.snippets : []).map((s) => {
          const sr = asRecord(s);
          return { id: str(sr.id), label: str(sr.label), tags: tagsToString(sr.tags) };
        });
        return {
          poolId: str(r.poolId),
          label: str(r.label),
          minSelections: typeof r.minSelections === "number" ? r.minSelections : null,
          maxSelections: typeof r.maxSelections === "number" ? r.maxSelections : null,
          snippets,
        };
      });
      const rubric = asRecord(c.rubric);
      return {
        kind,
        pools,
        requiredTags: tagsToString(rubric.requiredTags),
        bannedTags: tagsToString(rubric.bannedTags),
        correct: readFeedback(c.correctFeedback),
        incorrect: readIncorrectDefault(c.incorrectFeedback),
      };
    }
  }
}

// ----------------------------------------------------------------------------
// form model -> config (merged onto existing config to preserve hidden fields)
// ----------------------------------------------------------------------------

function mergeFeedback(
  existing: unknown,
  form: FeedbackForm,
  defaultTone: "correct" | "incorrect" | "noted",
): Record<string, unknown> {
  const base = asRecord(existing);
  return {
    ...base,
    tone: typeof base.tone === "string" ? base.tone : defaultTone,
    headline: form.headline,
    body: form.body,
  };
}

/** Build an incorrectFeedback record, preserving per-option keys and updating `default`. */
function mergeIncorrect(existing: unknown, form: FeedbackForm): Record<string, unknown> {
  const base = asRecord(existing);
  return { ...base, default: mergeFeedback(base.default, form, "incorrect") };
}

/** Set `config.key` to a trimmed string, or delete it when blank. */
function setOrDeleteString(config: Record<string, unknown>, key: string, value: string): void {
  if (value.trim()) config[key] = value;
  else delete config[key];
}

export function formModelToConfig(
  form: BeatConfigForm,
  existingConfig: unknown,
): Record<string, unknown> {
  const existing = asRecord(existingConfig);

  switch (form.kind) {
    case "REFLECTION":
      return {
        ...existing,
        prompt: form.prompt,
        minLength: form.minLength,
        maxLength: form.maxLength,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "noted"),
      };

    case "SORT_ORDER":
      return {
        ...existing,
        items: form.items.map((i) => ({ id: i.id, label: i.label })),
        correctOrder: form.items.map((i) => i.id),
        partialCredit: form.partialCredit,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };

    case "FILL_IN_BLANK": {
      const config: Record<string, unknown> = {
        ...existing,
        prompt: form.prompt,
        acceptedAnswers: form.acceptedAnswers,
        caseSensitive: form.caseSensitive,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };
      setOrDeleteString(config, "hint", form.hint);
      return config;
    }

    case "MATCH_PAIRS": {
      const config: Record<string, unknown> = {
        ...existing,
        leftItems: form.pairs.map((p) => ({ id: p.leftId, label: p.leftLabel })),
        rightItems: form.pairs.map((p) => ({ id: p.rightId, label: p.rightLabel })),
        correctPairs: form.pairs.map((p) => ({ leftId: p.leftId, rightId: p.rightId })),
        partialCredit: form.partialCredit,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };
      setOrDeleteString(config, "hint", form.hint);
      return config;
    }

    case "CONCEPT_REVEAL":
      return {
        ...existing,
        panels: form.panels.map((p) => ({ id: p.id, title: p.title, body: p.body })),
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "noted"),
      };

    case "CONTENT_BLOCK": {
      const config: Record<string, unknown> = {
        ...existing,
        sections: form.sections.map((s) => {
          const section: Record<string, unknown> = { id: s.id, body: s.body };
          if (s.heading.trim()) section.heading = s.heading;
          return section;
        }),
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "noted"),
      };
      if (form.mediaUrl.trim()) {
        const media: Record<string, unknown> = { url: form.mediaUrl };
        if (form.mediaAlt.trim()) media.alt = form.mediaAlt;
        if (form.mediaCaption.trim()) media.caption = form.mediaCaption;
        config.media = media;
      } else {
        delete config.media;
      }
      return config;
    }

    case "SCENARIO_CHOICE":
      return {
        ...existing,
        options: form.options.map((o) => ({ id: o.id, label: o.label })),
        correctOptionId: form.correctOptionId,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };

    case "MULTI_SELECT": {
      const config: Record<string, unknown> = {
        ...existing,
        options: form.options.map((o) => ({ id: o.id, label: o.label, correct: o.correct })),
        scoringMode: form.scoringMode,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };
      if (form.scoringMode === "threshold" && form.minimumCorrect && form.minimumCorrect > 0) {
        config.minimumCorrect = form.minimumCorrect;
      } else {
        delete config.minimumCorrect;
      }
      return config;
    }

    case "SPOT_THE_MISTAKE": {
      const passage = form.passage;
      const targets = form.targets.map((t) => {
        const start = passage.indexOf(t.phrase);
        const safeStart = start >= 0 ? start : 0;
        return {
          id: t.id,
          start: safeStart,
          end: safeStart + t.phrase.length,
          label: t.label,
        };
      });
      const config: Record<string, unknown> = {
        ...existing,
        passage,
        targets,
        correctTargetId: form.correctTargetId,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };
      setOrDeleteString(config, "hint", form.hint);
      return config;
    }

    case "BRANCHING_SCENARIO":
      return {
        ...existing,
        rootPrompt: form.rootPrompt,
        options: form.options.map((o) => ({
          id: o.id,
          label: o.label,
          leadsToChildSourceKey: o.leadsToChildSourceKey.trim() || null,
        })),
        correctOptionId: form.noWrongAnswer ? null : form.correctOptionId,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };

    case "COMPARE": {
      const config: Record<string, unknown> = {
        ...existing,
        optionA: { id: "A", label: form.optionA.label, body: form.optionA.body },
        optionB: { id: "B", label: form.optionB.label, body: form.optionB.body },
        correctOptionId: form.correctOptionId,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };
      setOrDeleteString(config, "requiredRationaleTag", form.requiredRationaleTag);
      return config;
    }

    case "HOTSPOT": {
      const config: Record<string, unknown> = {
        ...existing,
        imageUrl: form.imageUrl,
        regions: form.regions.map((r) => ({
          id: r.id,
          label: r.label,
          shape: "rect",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
        })),
        correctRegionId: form.correctRegionId,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };
      setOrDeleteString(config, "hint", form.hint);
      return config;
    }

    case "MESSAGE_COMPOSER": {
      return {
        ...existing,
        snippetPools: form.pools.map((p) => {
          const pool: Record<string, unknown> = {
            poolId: p.poolId,
            label: p.label,
            snippets: p.snippets.map((s) => ({
              id: s.id,
              label: s.label,
              tags: stringToTags(s.tags),
            })),
          };
          if (p.minSelections !== null && p.minSelections >= 0) pool.minSelections = p.minSelections;
          if (p.maxSelections !== null && p.maxSelections > 0) pool.maxSelections = p.maxSelections;
          return pool;
        }),
        rubric: {
          requiredTags: stringToTags(form.requiredTags),
          bannedTags: stringToTags(form.bannedTags),
        },
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: mergeIncorrect(existing.incorrectFeedback, form.incorrect),
      };
    }
  }
}

/** Constraints surfaced in the UI so admins stay inside each kind's Zod bounds. */
export const STRUCTURED_KIND_LIMITS: Record<
  StructuredBeatKind,
  { minItems?: number; maxItems?: number; minAnswers?: number }
> = {
  REFLECTION: {},
  SORT_ORDER: { minItems: 3, maxItems: 7 },
  FILL_IN_BLANK: { minAnswers: 1 },
  MATCH_PAIRS: { minItems: 3, maxItems: 6 },
  CONCEPT_REVEAL: { minItems: 2, maxItems: 6 },
  CONTENT_BLOCK: { minItems: 1, maxItems: 8 },
  SCENARIO_CHOICE: { minItems: 3, maxItems: 5 },
  MULTI_SELECT: { minItems: 4, maxItems: 7 },
  SPOT_THE_MISTAKE: { minItems: 1, maxItems: 5 },
  BRANCHING_SCENARIO: { minItems: 2, maxItems: 5 },
  COMPARE: {},
  HOTSPOT: { minItems: 1, maxItems: 6 },
  MESSAGE_COMPOSER: { minItems: 1, maxItems: 5 },
};
