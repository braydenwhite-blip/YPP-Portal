import { describe, expect, it } from "vitest";

import {
  BANNED_STATUS_WORDS,
  humanStatus,
  isVagueStatusWord,
  STATUS_LANGUAGE,
} from "@/lib/ui/status-language";

describe("status-language vocabulary", () => {
  it("resolves canonical keys to approved labels + tones", () => {
    expect(humanStatus("overdue")).toEqual({ label: "Overdue", tone: "danger" });
    expect(humanStatus("no-advisor")).toEqual({ label: "No advisor", tone: "warning" });
    expect(humanStatus("ready-to-submit")).toEqual({
      label: "Ready to submit",
      tone: "success",
    });
  });

  it("maps aliases to the same approved label", () => {
    expect(humanStatus("unowned").label).toBe("Missing owner");
    expect(humanStatus("missing-owner").label).toBe("Missing owner");
    expect(humanStatus("complete").label).toBe(humanStatus("done").label);
  });

  it("falls back to a neutral title-cased label for unknown keys", () => {
    expect(humanStatus("brand_new_state")).toEqual({
      label: "Brand new state",
      tone: "neutral",
    });
  });

  it("never ships a banned vague word as a canonical label", () => {
    const labels = Object.values(STATUS_LANGUAGE).map((meaning) =>
      meaning.label.toLowerCase()
    );
    for (const banned of BANNED_STATUS_WORDS) {
      expect(labels).not.toContain(banned);
    }
  });

  it("flags banned vague-mood words", () => {
    expect(isVagueStatusWord("Health")).toBe(true);
    expect(isVagueStatusWord("readiness")).toBe(true);
    expect(isVagueStatusWord("Overdue")).toBe(false);
  });
});
