import { describe, expect, it } from "vitest";

import { suggestionsForTier } from "@/lib/help-agent/suggestions";

describe("suggestionsForTier", () => {
  it("hides admin-only shortcuts from non-admin officers", () => {
    const suggestions = suggestionsForTier("OFFICER", { admin: false });
    const labels = suggestions.map((s) => s.label);

    expect(labels).toContain("Open Partner database");
    expect(labels).toContain("What needs attention?");
    expect(labels).toContain("My work");
    expect(labels).toContain("Meetings needing follow-up");
    expect(labels).toContain("Decisions needing actions");
    expect(suggestions.find((s) => s.label === "What needs attention?")?.href).toBe(
      "/work?view=needs-attention"
    );
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
