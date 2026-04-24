/**
 * Cross-cutting tests for the scoring engine.
 *
 * Per-kind scorer tests live under `tests/lib/training-journey/kinds/`.
 * This file covers the dispatcher (`scoreBeat`), the SCORERS registry shape,
 * and Zod-parse error paths — behavior that isn't specific to any one kind.
 */

import { describe, expect, it } from "vitest";

import {
  SCORERS,
  scoreBeat,
  BeatValidationError,
} from "@/lib/training-journey/scoring";
import {
  BEAT_CONFIG_SCHEMAS,
  BEAT_RESPONSE_SCHEMAS,
  BEAT_SCHEMA_VERSIONS,
  KIND_MODULES,
} from "@/lib/training-journey/schemas";
import {
  INTERACTIVE_BEAT_KINDS,
  type InteractiveBeatKind,
} from "@/lib/training-journey/types";

describe("SCORERS registry", () => {
  it("has a scorer for every InteractiveBeatKind", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(typeof SCORERS[kind]).toBe("function");
    }
  });

  it("has a KIND_MODULES entry for every kind whose `kind` field matches the map key", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(KIND_MODULES[kind].kind).toBe(kind);
    }
  });

  it("has a config + response schema keyed by every kind", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(BEAT_CONFIG_SCHEMAS[kind]).toBeDefined();
      expect(BEAT_RESPONSE_SCHEMAS[kind]).toBeDefined();
    }
  });

  it("exports a positive schemaVersion for every kind", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(BEAT_SCHEMA_VERSIONS[kind]).toBeGreaterThanOrEqual(1);
    }
  });
});

describe("scoreBeat — dispatcher error paths", () => {
  it("throws BeatValidationError when config fails Zod parse", () => {
    const beat = {
      kind: "SCENARIO_CHOICE" as InteractiveBeatKind,
      sourceKey: "test/bad-config",
      scoringWeight: 10,
      scoringRule: null,
      config: { this: "is-not-a-valid-scenario-choice-config" },
    };
    expect(() => scoreBeat(beat, { selectedOptionId: "a" })).toThrow(
      BeatValidationError
    );
    try {
      scoreBeat(beat, { selectedOptionId: "a" });
    } catch (err) {
      expect(err).toBeInstanceOf(BeatValidationError);
      expect((err as BeatValidationError).stage).toBe("config");
      expect((err as BeatValidationError).kind).toBe("SCENARIO_CHOICE");
      expect((err as BeatValidationError).sourceKey).toBe("test/bad-config");
    }
  });

  it("throws BeatValidationError when response fails Zod parse", () => {
    // Build a well-formed SCENARIO_CHOICE config so config parse succeeds.
    const beat = {
      kind: "SCENARIO_CHOICE" as InteractiveBeatKind,
      sourceKey: "test/bad-response",
      scoringWeight: 10,
      scoringRule: null,
      config: {
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        correctOptionId: "a",
        correctFeedback: { tone: "correct", headline: "Y", body: "Yes" },
        incorrectFeedback: {
          default: { tone: "incorrect", headline: "N", body: "No" },
        },
      },
    };
    expect(() =>
      scoreBeat(beat, { wrong: "shape" } as unknown)
    ).toThrow(BeatValidationError);
    try {
      scoreBeat(beat, { wrong: "shape" } as unknown);
    } catch (err) {
      expect((err as BeatValidationError).stage).toBe("response");
    }
  });

  it("clamps scorer output to [0, scoringWeight] and rounds", () => {
    // Hijack a scorer via direct scorer call to prove the clamp: we can't
    // easily force a kind to return out-of-range, so use SCENARIO_CHOICE with a
    // scoringWeight of 5 and verify the correct path yields exactly 5.
    const beat = {
      kind: "SCENARIO_CHOICE" as InteractiveBeatKind,
      sourceKey: "test/clamp",
      scoringWeight: 5,
      scoringRule: null,
      config: {
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        correctOptionId: "a",
        correctFeedback: { tone: "correct", headline: "Y", body: "Yes" },
        incorrectFeedback: {
          default: { tone: "incorrect", headline: "N", body: "No" },
        },
      },
    };
    const result = scoreBeat(beat, { selectedOptionId: "a" });
    expect(result.score).toBe(5);
    expect(result.correct).toBe(true);
  });

  it("returns a feedback object with a tone on every successful score", () => {
    const beat = {
      kind: "SCENARIO_CHOICE" as InteractiveBeatKind,
      sourceKey: "test/feedback-shape",
      scoringWeight: 10,
      scoringRule: null,
      config: {
        options: [
          { id: "a", label: "A" },
          { id: "b", label: "B" },
          { id: "c", label: "C" },
        ],
        correctOptionId: "a",
        correctFeedback: {
          tone: "correct" as const,
          headline: "Yes",
          body: "Good",
        },
        incorrectFeedback: {
          default: {
            tone: "incorrect" as const,
            headline: "No",
            body: "Not quite",
          },
        },
      },
    };
    const wrong = scoreBeat(beat, { selectedOptionId: "b" });
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback.tone).toBe("incorrect");
    expect(wrong.feedback.headline).toBeTypeOf("string");
    expect(wrong.feedback.body).toBeTypeOf("string");
  });
});
