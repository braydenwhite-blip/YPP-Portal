/**
 * Pure, framework-free conversion between an `InteractiveBeat.config` object
 * and an editor-friendly "form model" for the four editor-supported beat
 * kinds (REFLECTION, SORT_ORDER, FILL_IN_BLANK, MATCH_PAIRS).
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
 *     `BEAT_CONFIG_SCHEMAS[kind]`. Ordering-derived fields (SORT_ORDER's
 *     correctOrder, MATCH_PAIRS' correctPairs) are computed here so the
 *     admin never edits an index map by hand.
 */

export const STRUCTURED_BEAT_KINDS = [
  "REFLECTION",
  "SORT_ORDER",
  "FILL_IN_BLANK",
  "MATCH_PAIRS",
] as const;

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

export type BeatConfigForm =
  | ReflectionForm
  | SortOrderForm
  | FillInBlankForm
  | MatchPairsForm;

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

function readItems(value: unknown): SortOrderItemForm[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const r = asRecord(entry);
      return { id: str(r.id), label: str(r.label) };
    })
    .filter((i) => i.id !== "");
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
      // Present items in their *correct* order so the admin reads top-to-bottom.
      const ordered =
        correctOrder.length === items.length
          ? correctOrder
              .map((id) => items.find((i) => i.id === id))
              .filter((i): i is SortOrderItemForm => Boolean(i))
          : items;
      const incorrect = asRecord(c.incorrectFeedback);
      return {
        kind,
        items: ordered,
        partialCredit: bool(c.partialCredit, false),
        correct: readFeedback(c.correctFeedback),
        incorrect: readFeedback(incorrect.default),
      };
    }

    case "FILL_IN_BLANK": {
      const incorrect = asRecord(c.incorrectFeedback);
      return {
        kind,
        prompt: str(c.prompt),
        acceptedAnswers: strArray(c.acceptedAnswers),
        caseSensitive: bool(c.caseSensitive, false),
        hint: str(c.hint),
        correct: readFeedback(c.correctFeedback),
        incorrect: readFeedback(incorrect.default),
      };
    }

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
      const incorrect = asRecord(c.incorrectFeedback);
      return {
        kind,
        pairs,
        partialCredit: bool(c.partialCredit, true),
        hint: str(c.hint),
        correct: readFeedback(c.correctFeedback),
        incorrect: readFeedback(incorrect.default),
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

    case "SORT_ORDER": {
      const existingIncorrect = asRecord(existing.incorrectFeedback);
      return {
        ...existing,
        items: form.items.map((i) => ({ id: i.id, label: i.label })),
        // The correct answer IS the order the admin arranged the items in.
        correctOrder: form.items.map((i) => i.id),
        partialCredit: form.partialCredit,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: {
          ...existingIncorrect,
          default: mergeFeedback(existingIncorrect.default, form.incorrect, "incorrect"),
        },
      };
    }

    case "FILL_IN_BLANK": {
      const existingIncorrect = asRecord(existing.incorrectFeedback);
      const config: Record<string, unknown> = {
        ...existing,
        prompt: form.prompt,
        acceptedAnswers: form.acceptedAnswers,
        caseSensitive: form.caseSensitive,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: {
          ...existingIncorrect,
          default: mergeFeedback(existingIncorrect.default, form.incorrect, "incorrect"),
        },
      };
      if (form.hint.trim()) {
        config.hint = form.hint;
      } else {
        delete config.hint;
      }
      return config;
    }

    case "MATCH_PAIRS": {
      const existingIncorrect = asRecord(existing.incorrectFeedback);
      const config: Record<string, unknown> = {
        ...existing,
        leftItems: form.pairs.map((p) => ({ id: p.leftId, label: p.leftLabel })),
        rightItems: form.pairs.map((p) => ({ id: p.rightId, label: p.rightLabel })),
        correctPairs: form.pairs.map((p) => ({ leftId: p.leftId, rightId: p.rightId })),
        partialCredit: form.partialCredit,
        correctFeedback: mergeFeedback(existing.correctFeedback, form.correct, "correct"),
        incorrectFeedback: {
          ...existingIncorrect,
          default: mergeFeedback(existingIncorrect.default, form.incorrect, "incorrect"),
        },
      };
      if (form.hint.trim()) {
        config.hint = form.hint;
      } else {
        delete config.hint;
      }
      return config;
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
};
