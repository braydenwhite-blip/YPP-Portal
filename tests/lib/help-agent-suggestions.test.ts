import { describe, expect, it } from "vitest";

import { suggestionsForTier } from "@/lib/help-agent/suggestions";

describe("suggestionsForTier", () => {
  it("hides admin-only shortcuts from non-admin officers", () => {
    const labels = suggestionsForTier("OFFICER", { admin: false }).map((s) => s.label);

    expect(labels).toContain("Open Partner database");
    expect(labels).not.toContain("Add partner");
    expect(labels).not.toContain("Classes with no lead instructor");
    expect(labels).not.toContain("Overdue instructor reviews");
  });

  it("keeps admin-only shortcuts for admins", () => {
    const labels = suggestionsForTier("OFFICER", { admin: true }).map((s) => s.label);

    expect(labels).toContain("Add partner");
    expect(labels).toContain("Classes with no lead instructor");
    expect(labels).toContain("Overdue instructor reviews");
  });
});
