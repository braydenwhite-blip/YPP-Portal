import { describe, expect, it } from "vitest";

import {
  DEFAULT_REFLECTION_QUESTIONS,
  resolveReflectionQuestions,
} from "@/lib/mentorship/reflection-questions";

describe("resolveReflectionQuestions — per-cycle question wording overrides", () => {
  it("returns the standard copy when no overrides exist", () => {
    expect(resolveReflectionQuestions(null)).toEqual(DEFAULT_REFLECTION_QUESTIONS);
    expect(resolveReflectionQuestions(undefined)).toEqual(DEFAULT_REFLECTION_QUESTIONS);
    expect(resolveReflectionQuestions({})).toEqual(DEFAULT_REFLECTION_QUESTIONS);
  });

  it("overrides only the fields provided for one key, leaving the rest of that key's copy default", () => {
    const resolved = resolveReflectionQuestions({
      overallReflection: { hint: "Custom hint for this cycle." },
    });
    expect(resolved.overallReflection.hint).toBe("Custom hint for this cycle.");
    expect(resolved.overallReflection.label).toBe(DEFAULT_REFLECTION_QUESTIONS.overallReflection.label);
  });

  it("never mutates the shared defaults object", () => {
    resolveReflectionQuestions({ overallReflection: { label: "Mutated?" } });
    expect(DEFAULT_REFLECTION_QUESTIONS.overallReflection.label).toBe("Overall Reflection");
  });

  it("leaves every other question key untouched when only one is overridden", () => {
    const resolved = resolveReflectionQuestions({
      mentorHelpfulness: { label: "How's your mentor doing?" },
    });
    expect(resolved.engagementOverall).toEqual(DEFAULT_REFLECTION_QUESTIONS.engagementOverall);
    expect(resolved.goalProgressMade).toEqual(DEFAULT_REFLECTION_QUESTIONS.goalProgressMade);
  });

  it("ignores blank override strings and falls back to the default", () => {
    const resolved = resolveReflectionQuestions({
      supportNeeded: { label: "", hint: "   " },
    });
    expect(resolved.supportNeeded).toEqual(DEFAULT_REFLECTION_QUESTIONS.supportNeeded);
  });
});
