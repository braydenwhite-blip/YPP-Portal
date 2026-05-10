/**
 * Default configs for each `InteractiveBeatKind` supported by the
 * editor's "Add beat" dropdown. Only the kinds that have a dedicated
 * editor pane (Commit 8) are listed here. The other kinds in the
 * `InteractiveBeatKind` enum remain authorable via the TypeScript
 * curriculum sources until their editors land.
 *
 * Every default below parses against `BEAT_CONFIG_SCHEMAS[kind]` —
 * tested in tests/lib/journey-editor-beat-defaults.test.ts.
 */

import type { InteractiveBeatKind } from "./types";

export const EDITOR_SUPPORTED_KINDS = [
  "REFLECTION",
  "SORT_ORDER",
  "FILL_IN_BLANK",
  "MATCH_PAIRS",
] as const satisfies readonly InteractiveBeatKind[];

export type EditorSupportedKind = (typeof EDITOR_SUPPORTED_KINDS)[number];

const FB_CORRECT = {
  tone: "correct",
  headline: "Nice",
  body: "That matches the YPP standard.",
};

const FB_INCORRECT = {
  tone: "incorrect",
  headline: "Take another pass",
  body: "Not quite — review the prompt and try again.",
};

interface BeatDefault {
  title: string;
  prompt: string;
  scoringWeight: number;
  config: unknown;
}

export const BEAT_DEFAULTS: Record<EditorSupportedKind, BeatDefault> = {
  REFLECTION: {
    title: "Reflection",
    prompt: "Reflect on what you just learned.",
    scoringWeight: 5,
    config: {
      prompt: "Reflect on what you just learned.",
      correctFeedback: FB_CORRECT,
    },
  },
  SORT_ORDER: {
    title: "Order the steps",
    prompt: "Drag the items into the correct order.",
    scoringWeight: 10,
    config: {
      items: [
        { id: "a", label: "First step" },
        { id: "b", label: "Second step" },
        { id: "c", label: "Third step" },
      ],
      correctOrder: ["a", "b", "c"],
      partialCredit: true,
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  FILL_IN_BLANK: {
    title: "Fill in the blank",
    prompt: "Fill in the blank: ___",
    scoringWeight: 10,
    config: {
      prompt: "Fill in the blank: ___",
      acceptedAnswers: ["answer"],
      caseSensitive: false,
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  MATCH_PAIRS: {
    title: "Match pairs",
    prompt: "Pair each left item with the correct right item.",
    scoringWeight: 15,
    config: {
      leftItems: [
        { id: "l1", label: "Left 1" },
        { id: "l2", label: "Left 2" },
        { id: "l3", label: "Left 3" },
      ],
      rightItems: [
        { id: "r1", label: "Right 1" },
        { id: "r2", label: "Right 2" },
        { id: "r3", label: "Right 3" },
      ],
      correctPairs: [
        { leftId: "l1", rightId: "r1" },
        { leftId: "l2", rightId: "r2" },
        { leftId: "l3", rightId: "r3" },
      ],
      partialCredit: true,
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
};
