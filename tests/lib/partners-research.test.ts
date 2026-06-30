import { describe, it, expect } from "vitest";

import {
  scoreResearchCandidate,
  confidenceLabel,
  candidateToPartnerInput,
  findCandidateDuplicates,
  type PartnerResearchCandidate,
} from "@/lib/partners/research";

describe("scoreResearchCandidate", () => {
  it("caps a maximal candidate at 100 and floors an empty one at 0", () => {
    expect(
      scoreResearchCandidate({
        likelyHasSpace: true,
        servesElementaryMiddle: true,
        hasEnrichmentPrograms: true,
        contactConfidence: 1,
        proximityKm: 2,
        knownCommunityInstitution: true,
        priorYppRelationship: true,
      })
    ).toBe(100);
    expect(scoreResearchCandidate({})).toBe(0);
  });
  it("is monotonic — adding a positive signal never lowers the score", () => {
    const base = scoreResearchCandidate({ likelyHasSpace: true });
    const more = scoreResearchCandidate({ likelyHasSpace: true, servesElementaryMiddle: true });
    expect(more).toBeGreaterThan(base);
  });
  it("rewards closer proximity", () => {
    expect(scoreResearchCandidate({ proximityKm: 3 })).toBeGreaterThan(scoreResearchCandidate({ proximityKm: 30 }));
    expect(scoreResearchCandidate({ proximityKm: 100 })).toBe(0);
  });
});

describe("confidenceLabel", () => {
  it("buckets scores", () => {
    expect(confidenceLabel(80)).toBe("Strong");
    expect(confidenceLabel(60)).toBe("Promising");
    expect(confidenceLabel(40)).toBe("Worth a look");
    expect(confidenceLabel(10)).toBe("Low");
  });
});

describe("candidateToPartnerInput", () => {
  it("maps and cleans candidate fields, coercing the type and stamping the source", () => {
    const c: PartnerResearchCandidate = {
      organizationName: "  Greenburgh Library ",
      type: "LIBRARY",
      location: "Greenburgh, NY",
      website: "greenburghlibrary.org",
      suggestedContactName: " Pat Lee ",
      suggestedContactEmail: "pat@greenburghlibrary.org",
      confidence: 72,
      sourceUrl: "https://example.com/list",
      notes: "After-school programming",
    };
    const input = candidateToPartnerInput(c, "chapter-1");
    expect(input.name).toBe("Greenburgh Library");
    expect(input.partnerType).toBe("LIBRARY");
    expect(input.contactName).toBe("Pat Lee");
    expect(input.source).toBe("Research: https://example.com/list");
    expect(input.chapterId).toBe("chapter-1");
  });
  it("coerces an unknown type to null and blanks to null", () => {
    const input = candidateToPartnerInput(
      { organizationName: "X", type: "WEIRD", confidence: 1, location: "  " },
      null
    );
    expect(input.partnerType).toBeNull();
    expect(input.location).toBeNull();
    expect(input.source).toBe("Research");
  });
});

describe("findCandidateDuplicates", () => {
  it("flags a candidate that duplicates an existing partner", () => {
    const matches = findCandidateDuplicates(
      { organizationName: "Scarsdale Public Library", confidence: 50 },
      [{ id: "1", name: "Scarsdale Public Library" }]
    );
    expect(matches[0]?.id).toBe("1");
  });
});
