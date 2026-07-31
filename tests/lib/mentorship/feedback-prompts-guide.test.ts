import { describe, expect, it } from "vitest";

import {
  getAnswerGuide,
  resolveAnswerGuide,
} from "@/lib/mentorship/feedback-prompts";

describe("resolveAnswerGuide", () => {
  it("falls back to smart defaults when no mentor guide is set", () => {
    const guide = resolveAnswerGuide({ text: "How was this month?" });
    expect(guide?.kind).toBe("text");
    expect(guide?.examples.length).toBeGreaterThan(0);
    expect(guide?.title).toBe(getAnswerGuide("How was this month?").title);
  });

  it("lets mentors override tip and examples", () => {
    const guide = resolveAnswerGuide({
      text: "How was this month?",
      guide: {
        tip: "Be blunt.",
        examples: [{ label: "Win", detail: "I shipped the demo." }],
      },
    });
    expect(guide?.tip).toBe("Be blunt.");
    expect(guide?.examples).toEqual([
      { label: "Win", detail: "I shipped the demo." },
    ]);
  });

  it("hides the panel when mentor opts out", () => {
    expect(
      resolveAnswerGuide({
        text: "How was this month?",
        guide: { hide: true },
      })
    ).toBeNull();
  });

  it("forces scale UI even when the question text is free-form", () => {
    const guide = resolveAnswerGuide({
      text: "How supported did you feel?",
      guide: {
        kind: "scale",
        scaleMax: 5,
        examples: [{ label: "1", detail: "Not at all" }],
      },
    });
    expect(guide?.kind).toBe("scale");
    expect(guide?.scaleMax).toBe(5);
  });

  it("allows an empty examples list with tip only", () => {
    const guide = resolveAnswerGuide({
      text: "Anything else?",
      guide: {
        tip: "Optional — skip if nothing comes to mind.",
        examples: [],
      },
    });
    expect(guide?.tip).toContain("Optional");
    expect(guide?.examples).toEqual([]);
  });
});
