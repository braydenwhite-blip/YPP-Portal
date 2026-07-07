import { describe, expect, it } from "vitest";

import {
  GROWTH_MODEL,
  GROWTH_MODEL_ORDER,
  GROWTH_CONNECT_LINE,
  getGrowthConnectLine,
} from "@/lib/growth-model";

describe("growth model", () => {
  it("orders the connected model journey → support → work → checkpoint → recognition", () => {
    expect(GROWTH_MODEL_ORDER).toEqual([
      "pathway",
      "mentorship",
      "goals",
      "reviews",
      "awards",
    ]);
  });

  it("anchors the long-term journey on the leadership pathway and support on mentorship", () => {
    expect(GROWTH_MODEL.pathway.href).toBe("/leadership-pathway");
    expect(GROWTH_MODEL.mentorship.href).toBe("/mentorship?view=me");
    expect(GROWTH_MODEL.goals.href).toBe("/mentorship?view=me&section=goals");
  });

  it("keeps every model piece described in one concise sentence", () => {
    for (const key of Object.keys(GROWTH_MODEL) as Array<keyof typeof GROWTH_MODEL>) {
      const piece = GROWTH_MODEL[key];
      expect(piece.label.length).toBeGreaterThan(0);
      expect(piece.meaning.length).toBeGreaterThan(0);
      // One sentence: no double-sentence explainers leaking into the model.
      expect(piece.meaning.split(". ").length).toBeLessThanOrEqual(2);
    }
  });

  it("returns a connect line for every surface and ties awards back to the pathway", () => {
    const surfaces = Object.keys(GROWTH_CONNECT_LINE) as Array<
      keyof typeof GROWTH_CONNECT_LINE
    >;
    for (const surface of surfaces) {
      expect(getGrowthConnectLine(surface)).toBe(GROWTH_CONNECT_LINE[surface]);
    }
    expect(getGrowthConnectLine("awards")).toContain("pathway");
    expect(getGrowthConnectLine("pathway")).toContain("mentorship");
  });
});
