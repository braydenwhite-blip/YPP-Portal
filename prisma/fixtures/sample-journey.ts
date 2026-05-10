/**
 * Canonical sample journey for the Admin Journey Editor.
 *
 * Used by:
 *   - prisma/seed.journey-editor.ts (idempotent upsert)
 *   - tests that exercise the editor end-to-end (round-trip parse →
 *     persist → resolve)
 *
 * The fixture is intentionally lightweight (4 beats covering the first
 * wave of beat editors landing in Commit 8) but every config block is a
 * complete, valid example that passes BEAT_CONFIG_SCHEMAS.
 */

import type { JourneyDraft } from "@/lib/journey-editor/types";

const FB = {
  CORRECT: {
    tone: "correct" as const,
    headline: "Solid",
    body: "That matches the YPP standard.",
  },
  INCORRECT_DEFAULT: {
    tone: "incorrect" as const,
    headline: "Take another pass",
    body: "Not quite — review the prompt and try again.",
  },
};

export const SAMPLE_JOURNEY_SLUG = "instructor-onboarding-sample";

export const SAMPLE_JOURNEY_DRAFT: JourneyDraft = {
  journeyId: "sample-journey",
  versionId: "sample-journey-v1",
  versionNumber: 1,
  status: "DRAFT",
  meta: {
    slug: SAMPLE_JOURNEY_SLUG,
    title: "Instructor Onboarding (Sample)",
    description:
      "Editor smoke fixture. Exercises REFLECTION, SORT_ORDER, FILL_IN_BLANK, and MATCH_PAIRS beats.",
    estimatedMinutes: 12,
    passScorePct: 80,
    strictMode: false,
    moduleId: null,
  },
  beats: [
    {
      id: null,
      sourceKey: "intro-reflection",
      kind: "REFLECTION",
      title: "Why are you here?",
      prompt: "Write 1–2 sentences on why you joined YPP.",
      mediaUrl: null,
      sortOrder: 1,
      parentBeatId: null,
      showWhen: null,
      scoringWeight: 5,
      scoringRule: null,
      schemaVersion: 1,
      removedAt: null,
      config: {
        prompt: "Write 1–2 sentences on why you joined YPP.",
        correctFeedback: FB.CORRECT,
      },
    },
    {
      id: null,
      sourceKey: "session-flow-order",
      kind: "SORT_ORDER",
      title: "Order a strong session",
      prompt: "Drag the steps into the order they should happen in a session.",
      mediaUrl: null,
      sortOrder: 2,
      parentBeatId: null,
      showWhen: null,
      scoringWeight: 10,
      scoringRule: null,
      schemaVersion: 1,
      removedAt: null,
      config: {
        items: [
          { id: "warmup", label: "Warmup" },
          { id: "objective", label: "State objective" },
          { id: "practice", label: "Guided practice" },
          { id: "wrap", label: "Wrap & reflect" },
        ],
        correctOrder: ["warmup", "objective", "practice", "wrap"],
        partialCredit: true,
        correctFeedback: FB.CORRECT,
        incorrectFeedback: {
          default: FB.INCORRECT_DEFAULT,
        },
      },
    },
    {
      id: null,
      sourceKey: "absent-student-fill",
      kind: "FILL_IN_BLANK",
      title: "Following up on a no-show",
      prompt:
        'Within ___ hours of a missed session, send a check-in to the student. (Type the number.)',
      mediaUrl: null,
      sortOrder: 3,
      parentBeatId: null,
      showWhen: null,
      scoringWeight: 10,
      scoringRule: null,
      schemaVersion: 1,
      removedAt: null,
      config: {
        prompt:
          'Within ___ hours of a missed session, send a check-in to the student. (Type the number.)',
        acceptedAnswers: ["24", "twenty-four"],
        caseSensitive: false,
        correctFeedback: FB.CORRECT,
        incorrectFeedback: {
          default: FB.INCORRECT_DEFAULT,
        },
        hint: "Same-day or next-day is the YPP standard.",
      },
    },
    {
      id: null,
      sourceKey: "support-archetypes-match",
      kind: "MATCH_PAIRS",
      title: "Match the situation to the response",
      prompt: "Pair each student moment with the right next move.",
      mediaUrl: null,
      sortOrder: 4,
      parentBeatId: null,
      showWhen: null,
      scoringWeight: 15,
      scoringRule: null,
      schemaVersion: 1,
      removedAt: null,
      config: {
        leftItems: [
          { id: "shy", label: "Shy student stays silent" },
          { id: "lost", label: "Student looks confused" },
          { id: "rushed", label: "Student finishes early" },
        ],
        rightItems: [
          { id: "invite", label: "Invite a structured turn" },
          { id: "rephrase", label: "Rephrase the objective" },
          { id: "stretch", label: "Offer a stretch challenge" },
        ],
        correctPairs: [
          { leftId: "shy", rightId: "invite" },
          { leftId: "lost", rightId: "rephrase" },
          { leftId: "rushed", rightId: "stretch" },
        ],
        partialCredit: true,
        correctFeedback: FB.CORRECT,
        incorrectFeedback: {
          default: FB.INCORRECT_DEFAULT,
        },
      },
    },
  ],
  gates: [],
  assignments: [
    { audience: "INSTRUCTOR", autoEnroll: false },
  ],
};
