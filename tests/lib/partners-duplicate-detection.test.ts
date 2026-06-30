import { describe, it, expect } from "vitest";

import {
  normalizeName,
  domainOf,
  normalizePhone,
  partnerMatchScore,
  findLikelyDuplicates,
  type PartnerIdentity,
} from "@/lib/partners/duplicate-detection";

describe("normalizers", () => {
  it("normalizeName lowercases, strips punctuation, collapses spaces", () => {
    expect(normalizeName("  Scarsdale  Public-Library! ")).toBe("scarsdale public library");
  });
  it("domainOf extracts host from URLs and emails without www.", () => {
    expect(domainOf("https://www.scarsdalelibrary.org/teens")).toBe("scarsdalelibrary.org");
    expect(domainOf("jmiller@scarsdalelibrary.org")).toBe("scarsdalelibrary.org");
    expect(domainOf(null)).toBeNull();
  });
  it("normalizePhone keeps the last 10 digits", () => {
    expect(normalizePhone("+1 (914) 722-1300")).toBe("9147221300");
    expect(normalizePhone("123")).toBeNull();
  });
});

describe("partnerMatchScore", () => {
  const lib: PartnerIdentity = {
    id: "1",
    name: "Scarsdale Public Library",
    website: "https://scarsdalelibrary.org",
    contactEmail: "jane@scarsdalelibrary.org",
    location: "Scarsdale, NY",
    contactPhone: "914-722-1300",
  };

  it("scores an exact-name match as a likely duplicate", () => {
    const { score, reasons } = partnerMatchScore(lib, { ...lib, id: "2", website: null, contactEmail: null, contactPhone: null, location: null });
    expect(score).toBeGreaterThanOrEqual(50);
    expect(reasons).toContain("Same name");
  });
  it("scores a shared website domain as a likely duplicate even with a different name", () => {
    const { score } = partnerMatchScore(lib, { name: "SPL Teen Center", website: "http://www.scarsdalelibrary.org" });
    expect(score).toBeGreaterThanOrEqual(50);
  });
  it("scores a shared phone number as a likely duplicate", () => {
    const { score } = partnerMatchScore(lib, { name: "Totally Different Org", contactPhone: "(914) 722 1300" });
    expect(score).toBeGreaterThanOrEqual(50);
  });
  it("does not flag a mere shared email domain alone", () => {
    const { score } = partnerMatchScore(
      { name: "Org A", contactEmail: "a@gmail.com" },
      { name: "Org B", contactEmail: "b@gmail.com" }
    );
    expect(score).toBeLessThan(50);
  });
  it("scores unrelated partners near zero", () => {
    const { score } = partnerMatchScore({ name: "Greenburgh Elementary" }, { name: "Town YMCA" });
    expect(score).toBeLessThan(50);
  });
});

describe("findLikelyDuplicates", () => {
  const existing: PartnerIdentity[] = [
    { id: "1", name: "Scarsdale Public Library", website: "scarsdalelibrary.org" },
    { id: "2", name: "Greenburgh Elementary School" },
    { id: "3", name: "Town YMCA" },
  ];
  it("returns matches above threshold, sorted by score, excluding self", () => {
    const matches = findLikelyDuplicates(
      { id: "1", name: "Scarsdale Public Library", website: "www.scarsdalelibrary.org" },
      existing
    );
    expect(matches.map((m) => m.id)).not.toContain("1"); // self excluded
    expect(matches.length).toBe(0); // only self matched, and it's excluded
  });
  it("flags a new lead that duplicates an existing partner", () => {
    const matches = findLikelyDuplicates({ name: "Scarsdale Public Library" }, existing);
    expect(matches[0]?.id).toBe("1");
  });
});
