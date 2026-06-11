import { describe, expect, it } from "vitest";

import type { QuickFindEntry } from "@/lib/operations/data-360-queries";
import { rankQuickFind } from "@/lib/operations/quick-find";

function entry(label: string, overrides: Partial<QuickFindEntry> = {}): QuickFindEntry {
  return {
    id: `qf:${label}`,
    label,
    sub: null,
    typeLabel: "Work",
    entityType: null,
    entityId: null,
    href: "/actions/all",
    ...overrides,
  };
}

const INDEX = [
  entry("Beth El Day Camp", { typeLabel: "Partner" }),
  entry("Confirm Beth El planning meeting", { typeLabel: "Meeting" }),
  entry("Sports Business Class — Beth El", { typeLabel: "Class" }),
  entry("Elderberry outreach"),
  entry("Mohawk Day Camp", { typeLabel: "Partner" }),
];

describe("rankQuickFind", () => {
  it("surfaces every loaded object matching the query, across types", () => {
    const results = rankQuickFind(INDEX, "beth el");
    // The prefix match (the partner itself) leads; substring matches follow
    // alphabetically — the class and meeting connected to it.
    expect(results.map((r) => r.typeLabel)).toEqual(["Partner", "Meeting", "Class"]);
  });

  it("ranks prefix > word-start > substring, ties alphabetical", () => {
    const results = rankQuickFind(INDEX, "el");
    // "Elderberry…" starts with the query; the labels containing the word
    // "El" follow as word-start matches, alphabetically.
    expect(results.map((r) => r.label)).toEqual([
      "Elderberry outreach",
      "Beth El Day Camp",
      "Confirm Beth El planning meeting",
      "Sports Business Class — Beth El",
    ]);
  });

  it("returns nothing for a blank query and respects the limit", () => {
    expect(rankQuickFind(INDEX, "   ")).toEqual([]);
    expect(rankQuickFind(INDEX, "e", 2)).toHaveLength(2);
  });
});
