import { describe, expect, it } from "vitest";

import { buildPromotionPreview, type PersonPromotionState } from "@/lib/org/promotion";

function state(over: Partial<PersonPromotionState> = {}): PersonPromotionState {
  return {
    name: "Sam",
    title: "Senior Instructor",
    internalLevel: 2,
    ladder: "INSTRUCTION",
    chapterId: "c1",
    cohortId: null,
    committees: [],
    hasPrimaryMentor: true,
    ...over,
  };
}

const EFFECTIVE = "2026-07-01";

describe("buildPromotionPreview — direction & levels", () => {
  it("detects a promotion (level up)", () => {
    const p = buildPromotionPreview(state(), { newTitle: "Lead Instructor", effectiveDate: EFFECTIVE });
    expect(p.direction).toBe("promotion");
    expect(p.levelFrom).toBe(2);
    expect(p.levelTo).toBe(3);
  });

  it("detects a demotion (level down)", () => {
    const p = buildPromotionPreview(state({ title: "Lead Instructor", internalLevel: 3 }), {
      newTitle: "Senior Instructor",
      effectiveDate: EFFECTIVE,
    });
    expect(p.direction).toBe("demotion");
  });

  it("detects a lateral move (same level, new ladder)", () => {
    const p = buildPromotionPreview(state({ title: "Senior Instructor", internalLevel: 2 }), {
      newTitle: "Senior Manager", // Leadership level 2
      effectiveDate: EFFECTIVE,
    });
    expect(p.levelFrom).toBe(2);
    expect(p.levelTo).toBe(2);
    expect(p.direction).toBe("lateral");
    expect(p.ladderTo).toBe("LEADERSHIP");
  });

  it("is 'none' when nothing changes", () => {
    const p = buildPromotionPreview(state(), { newTitle: "Senior Instructor", effectiveDate: EFFECTIVE });
    expect(p.direction).toBe("none");
  });
});

describe("buildPromotionPreview — access diff", () => {
  it("surfaces newly granted access on promotion to Lead Instructor", () => {
    const p = buildPromotionPreview(state(), { newTitle: "Lead Instructor", effectiveDate: EFFECTIVE });
    expect(p.accessAdded.some((s) => /Instruction Committee/i.test(s))).toBe(true);
    expect(p.accessAdded.some((s) => /accountable Lead/i.test(s))).toBe(true);
  });

  it("surfaces removed access on demotion", () => {
    const p = buildPromotionPreview(state({ title: "Lead Instructor", internalLevel: 3 }), {
      newTitle: "Senior Instructor",
      effectiveDate: EFFECTIVE,
    });
    expect(p.accessRemoved.some((s) => /Instruction Committee/i.test(s))).toBe(true);
  });
});

describe("buildPromotionPreview — committees", () => {
  it("computes committee additions and removals against current membership", () => {
    const p = buildPromotionPreview(state({ committees: ["Outreach Team"] }), {
      newTitle: "Lead Instructor",
      effectiveDate: EFFECTIVE,
      addCommittees: ["Interview Committee", "Outreach Team"], // one new, one already held
      removeCommittees: ["Outreach Team"],
    });
    expect(p.committeesAdded).toEqual(["Interview Committee"]);
    expect(p.committeesRemoved).toEqual(["Outreach Team"]);
  });
});

describe("buildPromotionPreview — setup items", () => {
  it("flags a missing chapter when promoting to Chapter President", () => {
    const p = buildPromotionPreview(state({ chapterId: null }), {
      newTitle: "Chapter President",
      effectiveDate: EFFECTIVE,
    });
    expect(p.setupItems.some((s) => s.code === "chapter")).toBe(true);
    expect(p.setupComplete).toBe(false);
  });

  it("flags a missing mentor for a sub-officer role without one", () => {
    const p = buildPromotionPreview(state({ hasPrimaryMentor: false }), {
      newTitle: "Lead Instructor",
      effectiveDate: EFFECTIVE,
    });
    expect(p.setupItems.some((s) => s.code === "mentor")).toBe(true);
  });

  it("clears the mentor setup item when a mentor is assigned in the same change", () => {
    const p = buildPromotionPreview(state({ hasPrimaryMentor: false }), {
      newTitle: "Lead Instructor",
      effectiveDate: EFFECTIVE,
      assignMentorId: "mentor-1",
    });
    expect(p.setupItems.some((s) => s.code === "mentor")).toBe(false);
  });

  it("does not require a mentor for Officer-level roles", () => {
    const p = buildPromotionPreview(state({ hasPrimaryMentor: false, internalLevel: 4, title: "Senior Director" }), {
      newTitle: "Officer",
      effectiveDate: EFFECTIVE,
    });
    expect(p.setupItems.some((s) => s.code === "mentor")).toBe(false);
    expect(p.setupComplete).toBe(true);
  });
});
