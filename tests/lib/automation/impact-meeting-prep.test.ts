import { describe, it, expect } from "vitest";
import { buildChapterImpactPrep, buildImpactMeetingItems } from "@/lib/automation/impact-meeting-prep";
import { impactPrep, facts, NOW } from "./_fixtures";

describe("automation/impact-meeting-prep", () => {
  it("extracts the below-target numbers as structured evidence", () => {
    const prep = buildChapterImpactPrep(impactPrep());
    expect(prep.missingNumbers.length).toBe(2); // two attention metrics
    expect(prep.missingNumbers.map((m) => m.label)).toContain("Needs major revision");
    expect(prep.topBlockers.length).toBe(1);
    expect(prep.honestAnswerPrompt).toContain("not going as expected");
  });

  it("generates a prep-due item and a numbers-missing item", () => {
    const prep = buildChapterImpactPrep(impactPrep());
    const items = buildImpactMeetingItems(prep, facts({ weekNumber: 6 }), NOW);
    expect(items.length).toBe(2);
    expect(items[0].type).toBe("IMPACT_MEETING_PREP_DUE");
    expect(items.some((i) => i.type === "IMPACT_MEETING_NUMBERS_MISSING")).toBe(true);
  });

  it("omits the numbers-missing item when all targets are met", () => {
    const clean = impactPrep({
      groups: [{ title: "G", metrics: [{ label: "Confirmed partners", value: 2 }] }],
    });
    const prep = buildChapterImpactPrep(clean);
    const items = buildImpactMeetingItems(prep, facts({ weekNumber: 6 }), NOW);
    expect(items.length).toBe(1);
    expect(items[0].type).toBe("IMPACT_MEETING_PREP_DUE");
  });
});
