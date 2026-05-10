import { describe, expect, it } from "vitest";

import { SAMPLE_JOURNEY_DRAFT } from "@/prisma/fixtures/sample-journey";
import { validateDraft } from "@/lib/journey-editor/validation";

describe("sample journey fixture", () => {
  it("passes draft validation (non-publish mode)", () => {
    const result = validateDraft(SAMPLE_JOURNEY_DRAFT);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("passes publish validation with at least one assignment", () => {
    const result = validateDraft(SAMPLE_JOURNEY_DRAFT, { forPublish: true });
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("contains the four kinds the first-wave editor will support", () => {
    const kinds = SAMPLE_JOURNEY_DRAFT.beats.map((b) => b.kind).sort();
    expect(kinds).toEqual(["FILL_IN_BLANK", "MATCH_PAIRS", "REFLECTION", "SORT_ORDER"]);
  });
});
