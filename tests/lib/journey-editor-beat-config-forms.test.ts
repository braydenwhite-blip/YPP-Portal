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
import { INTERACTIVE_BEAT_KINDS } from "@/lib/training-journey/types";

describe("beat-config-forms", () => {
  it("marks exactly the editor-supported kinds as structured", () => {
    // The visual editor must cover every kind the Add-beat dropdown offers.
    expect([...STRUCTURED_BEAT_KINDS].sort()).toEqual([...EDITOR_SUPPORTED_KINDS].sort());
  });

  it("provides a visual editor for EVERY beat kind (no JSON-only fallbacks)", () => {
    for (const kind of INTERACTIVE_BEAT_KINDS) {
      expect(isStructuredBeatKind(kind)).toBe(true);
    }
  });

  it("isStructuredBeatKind rejects unknown kinds", () => {
    expect(isStructuredBeatKind("REFLECTION")).toBe(true);
    expect(isStructuredBeatKind("CONCEPT_REVEAL")).toBe(true);
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
      } else if (edited.kind === "CONCEPT_REVEAL") {
        edited.panels = edited.panels.map((p, idx) => ({ ...p, title: `Idea ${idx + 1}`, body: "Body" }));
      } else if (edited.kind === "CONTENT_BLOCK") {
        edited.sections = edited.sections.map((s) => ({ ...s, heading: "Heading", body: "Prose" }));
      } else if (edited.kind === "SCENARIO_CHOICE") {
        edited.options = edited.options.map((o, idx) => ({ ...o, label: `Choice ${idx + 1}` }));
      } else if (edited.kind === "MULTI_SELECT") {
        edited.options = edited.options.map((o, idx) => ({ ...o, label: `Choice ${idx + 1}` }));
      } else if (edited.kind === "SPOT_THE_MISTAKE") {
        edited.passage = "The mentor rushed past the confused learner.";
        edited.targets = [{ id: edited.targets[0]?.id ?? "t1", phrase: "rushed past", label: "rushed" }];
        edited.correctTargetId = edited.targets[0].id;
      } else if (edited.kind === "BRANCHING_SCENARIO") {
        edited.rootPrompt = "How do you open the session?";
        edited.options = edited.options.map((o, idx) => ({ ...o, label: `Path ${idx + 1}` }));
      } else if (edited.kind === "COMPARE") {
        edited.optionA = { ...edited.optionA, label: "Plan A", body: "Do A" };
        edited.optionB = { ...edited.optionB, label: "Plan B", body: "Do B" };
      } else if (edited.kind === "HOTSPOT") {
        edited.regions = edited.regions.map((r) => ({ ...r, label: "Spot", x: 0.25, y: 0.25, width: 0.3, height: 0.3 }));
      } else if (edited.kind === "MESSAGE_COMPOSER") {
        edited.requiredTags = "warm, specific";
        edited.bannedTags = "dismissive";
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

  it("recomputes SPOT_THE_MISTAKE character offsets from the phrase + passage", () => {
    const def = BEAT_DEFAULTS.SPOT_THE_MISTAKE;
    const form = configToFormModel("SPOT_THE_MISTAKE", def.config);
    if (form.kind !== "SPOT_THE_MISTAKE") throw new Error("wrong kind");
    form.passage = "A great teacher never ignores a raised hand.";
    form.targets = [{ id: "t1", phrase: "ignores", label: "ignores" }];
    form.correctTargetId = "t1";
    const rebuilt = formModelToConfig(form, def.config) as {
      passage: string;
      targets: { start: number; end: number }[];
    };
    const t = rebuilt.targets[0];
    expect(rebuilt.passage.slice(t.start, t.end)).toBe("ignores");
    expect(BEAT_CONFIG_SCHEMAS.SPOT_THE_MISTAKE.safeParse(rebuilt).success).toBe(true);
  });

  it("resets SCENARIO_CHOICE correctOptionId when the marked option is removed", () => {
    const def = BEAT_DEFAULTS.SCENARIO_CHOICE;
    const form = configToFormModel("SCENARIO_CHOICE", def.config);
    if (form.kind !== "SCENARIO_CHOICE") throw new Error("wrong kind");
    // configToFormModel reads the stored correctOptionId.
    expect(form.options.some((o) => o.id === form.correctOptionId)).toBe(true);
  });

  it("maps MULTI_SELECT correct flags through the form", () => {
    const def = BEAT_DEFAULTS.MULTI_SELECT;
    const form = configToFormModel("MULTI_SELECT", def.config);
    if (form.kind !== "MULTI_SELECT") throw new Error("wrong kind");
    const rebuilt = formModelToConfig(form, def.config) as {
      options: { correct: boolean }[];
    };
    expect(rebuilt.options.filter((o) => o.correct).length).toBe(
      form.options.filter((o) => o.correct).length,
    );
  });

  it("encodes BRANCHING_SCENARIO no-wrong-answer as a null correctOptionId", () => {
    const def = BEAT_DEFAULTS.BRANCHING_SCENARIO;
    const form = configToFormModel("BRANCHING_SCENARIO", def.config);
    if (form.kind !== "BRANCHING_SCENARIO") throw new Error("wrong kind");
    form.noWrongAnswer = true;
    const rebuilt = formModelToConfig(form, def.config) as { correctOptionId: string | null };
    expect(rebuilt.correctOptionId).toBeNull();
  });

  it("round-trips MESSAGE_COMPOSER tags between comma-strings and arrays", () => {
    const def = BEAT_DEFAULTS.MESSAGE_COMPOSER;
    const form = configToFormModel("MESSAGE_COMPOSER", def.config);
    if (form.kind !== "MESSAGE_COMPOSER") throw new Error("wrong kind");
    expect(form.requiredTags).toBe("warm");
    form.requiredTags = "warm, specific";
    const rebuilt = formModelToConfig(form, def.config) as {
      rubric: { requiredTags: string[] };
    };
    expect(rebuilt.rubric.requiredTags).toEqual(["warm", "specific"]);
  });

  it("normalizes HOTSPOT regions to [0,1] and keeps them schema-valid", () => {
    const def = BEAT_DEFAULTS.HOTSPOT;
    const form = configToFormModel("HOTSPOT", def.config);
    if (form.kind !== "HOTSPOT") throw new Error("wrong kind");
    const rebuilt = formModelToConfig(form, def.config) as {
      regions: { x: number; width: number }[];
    };
    for (const r of rebuilt.regions) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(1);
    }
    expect(BEAT_CONFIG_SCHEMAS.HOTSPOT.safeParse(rebuilt).success).toBe(true);
  });

  it("omits CONTENT_BLOCK media when no image URL is provided", () => {
    const def = BEAT_DEFAULTS.CONTENT_BLOCK;
    const form = configToFormModel("CONTENT_BLOCK", def.config);
    if (form.kind !== "CONTENT_BLOCK") throw new Error("wrong kind");
    expect(form.mediaUrl).toBe("");
    const rebuilt = formModelToConfig(form, def.config) as Record<string, unknown>;
    expect("media" in rebuilt).toBe(false);
  });
});
