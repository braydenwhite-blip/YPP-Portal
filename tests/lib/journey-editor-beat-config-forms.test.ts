import { describe, expect, it } from "vitest";

import { BEAT_DEFAULTS, EDITOR_SUPPORTED_KINDS } from "@/lib/journey-editor/beat-defaults";
import {
  type BeatConfigForm,
  configToFormModel,
  formModelToConfig,
  isStructuredBeatKind,
  STRUCTURED_BEAT_KINDS,
} from "@/lib/journey-editor/beat-config-forms";
import { BEAT_CONFIG_SCHEMAS } from "@/lib/training-journey/schemas";

describe("beat-config-forms", () => {
  it("marks exactly the editor-supported kinds as structured", () => {
    // The visual editor must cover every kind the Add-beat dropdown offers.
    expect([...STRUCTURED_BEAT_KINDS].sort()).toEqual([...EDITOR_SUPPORTED_KINDS].sort());
  });

  it("isStructuredBeatKind rejects kinds without a visual editor", () => {
    expect(isStructuredBeatKind("REFLECTION")).toBe(true);
    expect(isStructuredBeatKind("CONCEPT_REVEAL")).toBe(false);
    expect(isStructuredBeatKind("nonsense")).toBe(false);
  });

  for (const kind of STRUCTURED_BEAT_KINDS) {
    it(`round-trips the ${kind} default config back to a schema-valid config`, () => {
      const def = BEAT_DEFAULTS[kind];
      const form = configToFormModel(kind, def.config);
      const rebuilt = formModelToConfig(form, def.config);
      const result = BEAT_CONFIG_SCHEMAS[kind].safeParse(rebuilt);
      if (!result.success) {
        // eslint-disable-next-line no-console
        console.error(`${kind} round-trip issues:`, result.error.issues);
      }
      expect(result.success).toBe(true);
    });

    it(`preserves admin edits for ${kind} and stays schema-valid`, () => {
      const def = BEAT_DEFAULTS[kind];
      const form = configToFormModel(kind, def.config);

      // Simulate a non-technical admin editing copy through the form.
      const edited: BeatConfigForm = { ...form };
      if (edited.kind === "REFLECTION") {
        edited.prompt = "What is one thing you'll change next session?";
        edited.correct = { headline: "Thanks", body: "Appreciate the reflection." };
      } else if (edited.kind === "FILL_IN_BLANK") {
        edited.prompt = "The first move is to ___.";
        edited.acceptedAnswers = ["greet students", "welcome them"];
        edited.correct = { headline: "Yes", body: "Exactly right." };
        edited.incorrect = { headline: "Not yet", body: "Think about the opening." };
      } else if (edited.kind === "SORT_ORDER") {
        edited.items = edited.items.map((i, idx) => ({ ...i, label: `Step ${idx + 1}` }));
      } else if (edited.kind === "MATCH_PAIRS") {
        edited.pairs = edited.pairs.map((p, idx) => ({
          ...p,
          leftLabel: `Term ${idx + 1}`,
          rightLabel: `Definition ${idx + 1}`,
        }));
      }

      const rebuilt = formModelToConfig(edited, def.config);
      const result = BEAT_CONFIG_SCHEMAS[kind].safeParse(rebuilt);
      if (!result.success) {
        // eslint-disable-next-line no-console
        console.error(`${kind} edited issues:`, result.error.issues);
      }
      expect(result.success).toBe(true);
    });
  }

  it("derives SORT_ORDER correctOrder from the admin's item order", () => {
    const def = BEAT_DEFAULTS.SORT_ORDER;
    const form = configToFormModel("SORT_ORDER", def.config);
    if (form.kind !== "SORT_ORDER") throw new Error("wrong kind");

    // Reverse the displayed order; correctOrder should follow.
    form.items = [...form.items].reverse();
    const rebuilt = formModelToConfig(form, def.config) as {
      items: { id: string }[];
      correctOrder: string[];
    };
    expect(rebuilt.correctOrder).toEqual(rebuilt.items.map((i) => i.id));
    expect(BEAT_CONFIG_SCHEMAS.SORT_ORDER.safeParse(rebuilt).success).toBe(true);
  });

  it("keeps MATCH_PAIRS left/right/correctPairs counts aligned", () => {
    const def = BEAT_DEFAULTS.MATCH_PAIRS;
    const form = configToFormModel("MATCH_PAIRS", def.config);
    if (form.kind !== "MATCH_PAIRS") throw new Error("wrong kind");

    const rebuilt = formModelToConfig(form, def.config) as {
      leftItems: unknown[];
      rightItems: unknown[];
      correctPairs: unknown[];
    };
    expect(rebuilt.rightItems.length).toBe(rebuilt.leftItems.length);
    expect(rebuilt.correctPairs.length).toBe(rebuilt.leftItems.length);
  });

  it("preserves hidden advanced fields (e.g. acceptedPatterns) through a round-trip", () => {
    const base = BEAT_DEFAULTS.FILL_IN_BLANK.config as Record<string, unknown>;
    const withAdvanced = { ...base, acceptedPatterns: ["^great.*"] };
    const form = configToFormModel("FILL_IN_BLANK", withAdvanced);
    const rebuilt = formModelToConfig(form, withAdvanced) as Record<string, unknown>;
    expect(rebuilt.acceptedPatterns).toEqual(["^great.*"]);
    expect(BEAT_CONFIG_SCHEMAS.FILL_IN_BLANK.safeParse(rebuilt).success).toBe(true);
  });

  it("drops an empty hint rather than emitting an empty string", () => {
    const def = BEAT_DEFAULTS.FILL_IN_BLANK;
    const form = configToFormModel("FILL_IN_BLANK", def.config);
    if (form.kind !== "FILL_IN_BLANK") throw new Error("wrong kind");
    form.hint = "   ";
    const rebuilt = formModelToConfig(form, def.config) as Record<string, unknown>;
    expect("hint" in rebuilt).toBe(false);
  });
});
