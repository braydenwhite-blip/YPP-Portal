/**
 * Default configs for each `InteractiveBeatKind` offered by the editor's
 * "Add beat" dropdown. Every kind now has a dedicated visual editor pane
 * (see `app/(app)/admin/journeys/[id]/beat-config-form.tsx`), so the dropdown
 * exposes the full kind set.
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

const FB_NOTED = {
  tone: "noted",
  headline: "Got it",
  body: "Keep that in mind as you go.",
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
  CONCEPT_REVEAL: {
    title: "Reveal the concept",
    prompt: "Tap through each panel.",
    scoringWeight: 0,
    config: {
      panels: [
        { id: "p1", title: "First idea", body: "Explain the first idea here." },
        { id: "p2", title: "Second idea", body: "Explain the second idea here." },
      ],
      correctFeedback: FB_NOTED,
    },
  },
  CONTENT_BLOCK: {
    title: "Read this",
    prompt: "Read the section, then continue.",
    scoringWeight: 0,
    config: {
      sections: [{ id: "s1", body: "Teaching content goes here." }],
      correctFeedback: FB_NOTED,
    },
  },
  SCENARIO_CHOICE: {
    title: "What would you do?",
    prompt: "Pick the best response.",
    scoringWeight: 10,
    config: {
      options: [
        { id: "o1", label: "First option" },
        { id: "o2", label: "Second option" },
        { id: "o3", label: "Third option" },
      ],
      correctOptionId: "o1",
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  MULTI_SELECT: {
    title: "Select all that apply",
    prompt: "Choose every correct answer.",
    scoringWeight: 10,
    config: {
      options: [
        { id: "o1", label: "First option", correct: true },
        { id: "o2", label: "Second option", correct: true },
        { id: "o3", label: "Third option", correct: false },
        { id: "o4", label: "Fourth option", correct: false },
      ],
      scoringMode: "all-or-nothing",
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  SPOT_THE_MISTAKE: {
    title: "Spot the mistake",
    prompt: "Click the phrase that is wrong.",
    scoringWeight: 10,
    config: {
      passage: "The instructor ignored the quiet student.",
      targets: [{ id: "t1", start: 15, end: 22, label: "ignored" }],
      correctTargetId: "t1",
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  BRANCHING_SCENARIO: {
    title: "Choose your path",
    prompt: "Decide how to respond.",
    scoringWeight: 10,
    config: {
      rootPrompt: "A student is upset. What do you do?",
      options: [
        { id: "o1", label: "Acknowledge their feelings", leadsToChildSourceKey: null },
        { id: "o2", label: "Move on with the lesson", leadsToChildSourceKey: null },
      ],
      correctOptionId: null,
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  COMPARE: {
    title: "Compare the two",
    prompt: "Which is the stronger choice?",
    scoringWeight: 10,
    config: {
      optionA: { id: "A", label: "Option A", body: "Describe option A." },
      optionB: { id: "B", label: "Option B", body: "Describe option B." },
      correctOptionId: "A",
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  HOTSPOT: {
    title: "Find it",
    prompt: "Click the right spot.",
    scoringWeight: 10,
    config: {
      imageUrl: "https://placehold.co/600x400",
      regions: [
        { id: "rg1", label: "Region 1", shape: "rect", x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
      ],
      correctRegionId: "rg1",
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
  MESSAGE_COMPOSER: {
    title: "Compose a message",
    prompt: "Build a message from the snippets.",
    scoringWeight: 10,
    config: {
      snippetPools: [
        {
          poolId: "pool1",
          label: "Opening",
          minSelections: 1,
          maxSelections: 1,
          snippets: [
            { id: "sn1", label: "Warm greeting", tags: ["warm"] },
            { id: "sn2", label: "Abrupt greeting", tags: ["dismissive"] },
          ],
        },
      ],
      rubric: { requiredTags: ["warm"], bannedTags: ["dismissive"] },
      correctFeedback: FB_CORRECT,
      incorrectFeedback: { default: FB_INCORRECT },
    },
  },
};
