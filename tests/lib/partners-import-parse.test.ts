import { describe, it, expect } from "vitest";

import { parsePartnerRows, detectDelimiter } from "@/lib/partners/import-parse";

describe("detectDelimiter", () => {
  it("detects tab vs comma", () => {
    expect(detectDelimiter("a\tb\tc")).toBe("\t");
    expect(detectDelimiter("a,b,c")).toBe(",");
  });
});

describe("parsePartnerRows", () => {
  it("parses a TSV with a header row, mapping aliases", () => {
    const text = [
      "Organization\tType\tAddress\tWebsite\tContact\tEmail\tPhone",
      "Scarsdale Public Library\tLibrary\t54 Olmsted Rd\tscarsdalelibrary.org\tJane Miller\tjane@scarsdalelibrary.org\t914-722-1300",
    ].join("\n");
    const rows = parsePartnerRows(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Scarsdale Public Library",
      type: "Library",
      location: "54 Olmsted Rd",
      website: "scarsdalelibrary.org",
      contactName: "Jane Miller",
      contactEmail: "jane@scarsdalelibrary.org",
      contactPhone: "914-722-1300",
    });
  });

  it("parses positional CSV when there is no recognizable header", () => {
    const text = "Greenburgh Elementary,School,Greenburgh NY,greenburgh.org";
    const rows = parsePartnerRows(text);
    expect(rows[0]).toMatchObject({ name: "Greenburgh Elementary", type: "School", location: "Greenburgh NY", website: "greenburgh.org" });
  });

  it("honors quoted fields containing the delimiter", () => {
    const text = 'Name,Notes\n"Town YMCA","Has a gym, after-school space"';
    const rows = parsePartnerRows(text);
    expect(rows[0].name).toBe("Town YMCA");
    expect(rows[0].notes).toBe("Has a gym, after-school space");
  });

  it("skips blank lines and rows without a name", () => {
    const text = "Name,Type\n\nLincoln Center,Community Center\n,OrphanType\n";
    const rows = parsePartnerRows(text);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Lincoln Center");
  });

  it("returns an empty array for empty input", () => {
    expect(parsePartnerRows("")).toEqual([]);
    expect(parsePartnerRows("   \n  ")).toEqual([]);
  });
});
