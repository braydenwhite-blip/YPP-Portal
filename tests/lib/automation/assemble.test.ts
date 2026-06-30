import { describe, it, expect } from "vitest";
import { assembleChapterAutomation } from "@/lib/automation/assemble";
import { facts, blocker, studentNeed, impactPrep, NOW } from "./_fixtures";

function build(overrides = {}) {
  return assembleChapterAutomation({
    facts: facts({
      weekNumber: 7,
      cycleStartISO: "2026-05-05T00:00:00.000Z",
      partnersContacted: 6,
      instructorApplicants: 25,
      instructorsHired: 3,
      classesTotal: 2,
      partnersConfirmed: 0, // behind on the launch-critical confirmed partner
    }),
    blockers: [blocker()],
    studentNeeds: [studentNeed()],
    impactPrep: impactPrep(),
    now: NOW,
    weekAnchored: true,
    ...overrides,
  });
}

describe("automation/assemble (end to end, pure)", () => {
  it("produces the full read model from existing engine output + net-new generators", () => {
    const a = build();
    expect(a.chapterId).toBe("chap_1");
    expect(a.weekNumber).toBe(7);
    // normalized existing blocker is present
    expect(a.items.some((i) => i.entityId === "p1" && i.workflow === "PARTNERS")).toBe(true);
    // normalized student need is present
    expect(a.items.some((i) => i.type === "STUDENT_ABSENCE_STREAK")).toBe(true);
    // net-new playbook pacing item (chapter is behind at week 7)
    expect(a.items.some((i) => i.type === "CHAPTER_BEHIND_PLAYBOOK")).toBe(true);
    // impact-meeting prep item generated
    expect(a.items.some((i) => i.type === "IMPACT_MEETING_PREP_DUE")).toBe(true);
    // playbook + escalations reflect being behind
    expect(a.playbook.paceLabel).toBe("Behind");
    expect(a.escalations.length).toBeGreaterThan(0);
    // grouping + counts are consistent
    expect(a.byWorkflow.PARTNERS.length).toBeGreaterThan(0);
    expect(a.counts.total).toBe(a.items.length);
    expect(a.topPriorities.length).toBeLessThanOrEqual(5);
  });

  it("sorts items by urgency (descending)", () => {
    const a = build();
    for (let i = 1; i < a.items.length; i++) {
      expect(a.items[i - 1].urgency).toBeGreaterThanOrEqual(a.items[i].urgency);
    }
  });

  it("a dismissal overlay suppresses the matching item", () => {
    const base = build();
    const target = base.items[0];
    const a = build({ dismissals: [{ automationItemKey: target.id, action: "DISMISSED" }] });
    expect(a.items.some((i) => i.id === target.id)).toBe(false);
    expect(a.suppressed.some((i) => i.id === target.id && i.status === "DISMISSED")).toBe(true);
  });
});
