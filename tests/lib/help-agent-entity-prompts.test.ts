import { describe, expect, it } from "vitest";

import { entityPrompts, defaultPrompts } from "@/lib/help-agent/chief-of-staff";

describe("entityPrompts", () => {
  it("returns person-specific prompts grounded in People memory", () => {
    const prompts = entityPrompts("person");
    const questions = prompts.map((p) => p.question);
    expect(questions).toContain("Summarize this person.");
    expect(questions.some((q) => /contribution/i.test(q))).toBe(true);
    expect(questions.some((q) => /review evidence/i.test(q))).toBe(true);
    expect(questions.some((q) => /growth action/i.test(q))).toBe(true);
  });

  it("returns meeting prompts that drive notes → memory", () => {
    const questions = entityPrompts("meeting").map((p) => p.question);
    expect(questions).toContain("Summarize this meeting.");
    expect(questions.some((q) => /decision/i.test(q))).toBe(true);
    expect(questions.some((q) => /follow-up/i.test(q))).toBe(true);
    expect(questions.some((q) => /become an action/i.test(q))).toBe(true);
  });

  it("covers partner, class, and initiative entity types", () => {
    expect(entityPrompts("partner").length).toBeGreaterThan(0);
    expect(entityPrompts("class").some((p) => /launch/i.test(p.question))).toBe(true);
    expect(entityPrompts("initiative").some((p) => /milestone/i.test(p.question))).toBe(true);
  });

  it("falls back to the global prompts for unknown entity types", () => {
    expect(entityPrompts("unknown")).toEqual(defaultPrompts());
    expect(entityPrompts(null)).toEqual(defaultPrompts());
  });
});
