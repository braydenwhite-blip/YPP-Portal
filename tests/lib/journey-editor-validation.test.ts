import { describe, expect, it } from "vitest";

import {
  validateBeats,
  validateDraft,
  validateGates,
  validateLessonDesignStudioGate,
  validateMeta,
} from "@/lib/journey-editor/validation";
import type {
  BeatDraft,
  GateDraft,
  JourneyAssignmentDraft,
  JourneyDraft,
  JourneyMetaDraft,
} from "@/lib/journey-editor/types";

const VALID_FEEDBACK = {
  tone: "correct" as const,
  headline: "Nice work",
  body: "You captured the core idea.",
};

function reflectionConfig(prompt: string) {
  return {
    prompt,
    correctFeedback: VALID_FEEDBACK,
  };
}

function makeBeat(over: Partial<BeatDraft> = {}): BeatDraft {
  return {
    id: null,
    sourceKey: "intro",
    kind: "REFLECTION",
    title: "Intro reflection",
    prompt: "Why did you join?",
    mediaUrl: null,
    sortOrder: 1,
    parentBeatId: null,
    showWhen: null,
    scoringWeight: 10,
    scoringRule: null,
    schemaVersion: 1,
    config: reflectionConfig("Why did you join?"),
    removedAt: null,
    ...over,
  };
}

function makeMeta(over: Partial<JourneyMetaDraft> = {}): JourneyMetaDraft {
  return {
    slug: "instructor-onboarding",
    title: "Instructor Onboarding",
    description: null,
    estimatedMinutes: 10,
    passScorePct: 80,
    strictMode: false,
    moduleId: null,
    ...over,
  };
}

function makeDraft(over: Partial<JourneyDraft> = {}): JourneyDraft {
  return {
    journeyId: "j1",
    versionId: "v1",
    versionNumber: 1,
    status: "DRAFT",
    meta: makeMeta(),
    beats: [makeBeat()],
    gates: [],
    assignments: [],
    ...over,
  };
}

const ASSIGNMENT_INSTRUCTOR: JourneyAssignmentDraft = {
  audience: "INSTRUCTOR",
  autoEnroll: true,
};

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

describe("validateMeta", () => {
  it("accepts a well-formed meta block", () => {
    expect(validateMeta(makeMeta())).toEqual([]);
  });

  it("rejects titles shorter than 3 characters", () => {
    const errors = validateMeta(makeMeta({ title: "Hi" }));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ scope: "meta", field: "title" });
  });

  it("rejects slugs with uppercase or spaces", () => {
    expect(validateMeta(makeMeta({ slug: "Bad Slug" }))).toEqual([
      expect.objectContaining({ scope: "meta", field: "slug" }),
    ]);
    expect(validateMeta(makeMeta({ slug: "BadSlug" }))).toEqual([
      expect.objectContaining({ scope: "meta", field: "slug" }),
    ]);
  });

  it("rejects passScorePct out of [0, 100]", () => {
    expect(validateMeta(makeMeta({ passScorePct: 101 }))).toEqual([
      expect.objectContaining({ field: "passScorePct" }),
    ]);
    expect(validateMeta(makeMeta({ passScorePct: -1 }))).toEqual([
      expect.objectContaining({ field: "passScorePct" }),
    ]);
  });

  it("rejects negative estimatedMinutes", () => {
    expect(validateMeta(makeMeta({ estimatedMinutes: -5 }))).toEqual([
      expect.objectContaining({ field: "estimatedMinutes" }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// Beats
// ---------------------------------------------------------------------------

describe("validateBeats", () => {
  it("accepts a single valid beat", () => {
    expect(validateBeats([makeBeat()])).toEqual([]);
  });

  it("requires at least one non-removed beat", () => {
    const removed = makeBeat({ removedAt: new Date().toISOString() });
    const errors = validateBeats([removed]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ scope: "beat", refId: null });
  });

  it("flags duplicate sourceKeys", () => {
    const errors = validateBeats([
      makeBeat({ sourceKey: "intro", sortOrder: 1 }),
      makeBeat({ sourceKey: "intro", sortOrder: 2 }),
    ]);
    expect(errors.some((e) => e.field === "sourceKey")).toBe(true);
  });

  it("requires strictly increasing sortOrder per parent group", () => {
    const errors = validateBeats([
      makeBeat({ sourceKey: "a", sortOrder: 1 }),
      makeBeat({ sourceKey: "b", sortOrder: 1 }),
    ]);
    expect(errors.some((e) => e.field === "sortOrder")).toBe(true);
  });

  it("permits the same sortOrder under different parents", () => {
    const errors = validateBeats([
      makeBeat({ sourceKey: "root", sortOrder: 1 }),
      makeBeat({ sourceKey: "child-a", sortOrder: 1, parentBeatId: "root" }),
      makeBeat({ sourceKey: "child-b", sortOrder: 1, parentBeatId: "root" }),
    ]);
    expect(errors.filter((e) => e.field === "sortOrder")).toEqual([]);
  });

  it("rejects parentBeatId that does not match any beat in the draft", () => {
    const errors = validateBeats([
      makeBeat({ sourceKey: "child", parentBeatId: "missing-source" }),
    ]);
    expect(errors.some((e) => e.field === "parentBeatId")).toBe(true);
  });

  it("detects parent-chain cycles", () => {
    const errors = validateBeats([
      makeBeat({ id: "x1", sourceKey: "a", parentBeatId: "b", sortOrder: 1 }),
      makeBeat({ id: "x2", sourceKey: "b", parentBeatId: "a", sortOrder: 2 }),
    ]);
    expect(errors.some((e) => e.message.includes("cycle"))).toBe(true);
  });

  it("rejects beats whose config does not parse against the kind schema", () => {
    const errors = validateBeats([
      makeBeat({ config: { prompt: 42 } }), // missing correctFeedback, prompt wrong type
    ]);
    expect(errors.some((e) => e.field?.startsWith("config"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

describe("validateGates", () => {
  const beats = [makeBeat({ sourceKey: "intro" })];
  const gateBase = (over: Partial<GateDraft>): GateDraft => ({
    id: null,
    kind: "BEAT_COMPLETE",
    targetRef: "beat:intro",
    requiredRef: "beat:intro",
    threshold: null,
    ...over,
  });

  it("accepts a gate whose refs resolve to draft beats", () => {
    const errors = validateGates([gateBase({})], beats, []);
    expect(errors).toEqual([]);
  });

  it("flags malformed targetRef / requiredRef", () => {
    const errors = validateGates(
      [gateBase({ targetRef: "lol", requiredRef: "?bad?" })],
      beats,
      [],
    );
    expect(errors).toHaveLength(2);
  });

  it("flags refs that point to a beat not in the draft", () => {
    const errors = validateGates(
      [gateBase({ requiredRef: "beat:not-a-beat" })],
      beats,
      [],
    );
    expect(errors.some((e) => e.field === "requiredRef")).toBe(true);
  });

  it("resolves module: refs against knownModuleContentKeys", () => {
    const ok = validateGates(
      [gateBase({ kind: "MODULE_COMPLETE", requiredRef: "module:academy_ypp_standard_001" })],
      beats,
      ["academy_ypp_standard_001"],
    );
    expect(ok).toEqual([]);
    const fail = validateGates(
      [gateBase({ kind: "MODULE_COMPLETE", requiredRef: "module:unknown_module" })],
      beats,
      ["academy_ypp_standard_001"],
    );
    expect(fail.some((e) => e.field === "requiredRef")).toBe(true);
  });

  it("requires threshold 0..100 on SCORE_THRESHOLD gates", () => {
    expect(
      validateGates([gateBase({ kind: "SCORE_THRESHOLD", threshold: null })], beats, []),
    ).toEqual([expect.objectContaining({ field: "threshold" })]);
    expect(
      validateGates([gateBase({ kind: "SCORE_THRESHOLD", threshold: 150 })], beats, []),
    ).toEqual([expect.objectContaining({ field: "threshold" })]);
    expect(
      validateGates([gateBase({ kind: "SCORE_THRESHOLD", threshold: 80 })], beats, []),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Lesson Design Studio gate special-case
// ---------------------------------------------------------------------------

describe("validateLessonDesignStudioGate", () => {
  it("is a no-op when no LDS beat exists", () => {
    expect(validateLessonDesignStudioGate([makeBeat()], [])).toEqual([]);
  });

  it("flags an LDS beat without a readiness gate", () => {
    const errors = validateLessonDesignStudioGate(
      [makeBeat({ sourceKey: "lesson-design-studio-intro" })],
      [],
    );
    expect(errors).toHaveLength(1);
  });

  it("passes when a readiness gate is present", () => {
    const errors = validateLessonDesignStudioGate(
      [makeBeat({ sourceKey: "lesson-design-studio-intro" })],
      [
        {
          id: null,
          kind: "READINESS_CHECK",
          targetRef: "beat:lesson-design-studio-intro",
          requiredRef: "module:academy_readiness_check_005",
          threshold: null,
        },
      ],
    );
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateDraft (publish-mode)
// ---------------------------------------------------------------------------

describe("validateDraft (forPublish)", () => {
  it("rejects a draft with no audience assignments", () => {
    const result = validateDraft(makeDraft(), { forPublish: true });
    expect(result.ok).toBe(false);
    expect(
      result.errors.some(
        (e) => e.scope === "assignment" && e.message.includes("audience assignment"),
      ),
    ).toBe(true);
  });

  it("passes when all rules are satisfied", () => {
    const result = validateDraft(
      makeDraft({ assignments: [ASSIGNMENT_INSTRUCTOR] }),
      { forPublish: true },
    );
    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("does not require assignments when forPublish=false", () => {
    const result = validateDraft(makeDraft(), { forPublish: false });
    expect(result).toEqual({ ok: true, errors: [] });
  });
});
