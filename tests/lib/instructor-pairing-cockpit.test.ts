import { describe, it, expect } from "vitest";
import { buildInstructorPairingCockpit } from "@/lib/instructor-pairing/cockpit";
import { deriveUnitCoverage } from "@/lib/instructor-pairing/coverage";
import {
  buildInstructorMatchSuggestions,
  scoreInstructorForUnit,
  type PairingCandidate,
} from "@/lib/instructor-pairing/suggestions";
import type {
  PairingAssignmentLite,
  PairingCockpitInput,
  PairingLane,
  PairingUnit,
} from "@/lib/instructor-pairing/types";

const NOW = new Date("2026-06-15T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const inDays = (n: number) => new Date(NOW.getTime() + n * DAY);

function unit(over: Partial<PairingUnit> & Pick<PairingUnit, "offeringId" | "title">): PairingUnit {
  return {
    subject: null,
    ageGroup: null,
    partnerId: null,
    partnerName: null,
    chapterId: null,
    chapterName: null,
    ownerId: null,
    ownerName: null,
    startDate: null,
    offeringStatus: "PUBLISHED",
    slotsNeeded: 1,
    legacyLeadId: null,
    legacyLeadName: null,
    assignments: [],
    suggestions: [],
    ...over,
  };
}

function asg(status: string, over: Partial<PairingAssignmentLite> = {}): PairingAssignmentLite {
  return {
    id: over.id ?? `a-${status}`,
    instructorId: over.instructorId ?? "i1",
    instructorName: over.instructorName ?? "Ivy",
    role: over.role ?? "LEAD",
    status,
  };
}

function candidate(over: Partial<PairingCandidate> & Pick<PairingCandidate, "id" | "name">): PairingCandidate {
  return { chapterId: null, interests: [], baseReady: false, trained: false, activeLoad: 0, ...over };
}

function cockpit(input: Partial<PairingCockpitInput> = {}) {
  return buildInstructorPairingCockpit({ units: [], acceptedUnplaced: [], ...input }, NOW);
}
function lane(c: ReturnType<typeof cockpit>, l: PairingLane) {
  return c.lanes.find((x) => x.lane === l)!.cards;
}

describe("deriveUnitCoverage", () => {
  it("treats a class with no instructor at all as Needs instructor", () => {
    const cov = deriveUnitCoverage(unit({ offeringId: "o1", title: "Robotics" }), NOW);
    expect(cov.lane).toBe("needs_instructor");
    expect(cov.status).toBe("NEEDS_INSTRUCTOR");
  });

  it("routes an OFFERED assignment to Waiting on instructor", () => {
    const cov = deriveUnitCoverage(unit({ offeringId: "o1", title: "Robotics", assignments: [asg("OFFERED")] }), NOW);
    expect(cov.lane).toBe("waiting_instructor");
  });

  it("routes INSTRUCTOR_CONFIRMED (partner missing) to Waiting on partner", () => {
    const cov = deriveUnitCoverage(unit({ offeringId: "o1", title: "Robotics", assignments: [asg("INSTRUCTOR_CONFIRMED")] }), NOW);
    expect(cov.lane).toBe("waiting_partner");
    expect(cov.status).toBe("PARTNER_CONFIRMATION_NEEDED");
  });

  it("routes FULLY_CONFIRMED to Fully covered", () => {
    const cov = deriveUnitCoverage(unit({ offeringId: "o1", title: "Robotics", assignments: [asg("FULLY_CONFIRMED")] }), NOW);
    expect(cov.lane).toBe("fully_covered");
  });

  it("routes NEEDS_TRAINING to Needs training", () => {
    const cov = deriveUnitCoverage(unit({ offeringId: "o1", title: "Robotics", assignments: [asg("NEEDS_TRAINING")] }), NOW);
    expect(cov.lane).toBe("needs_training");
  });

  it("treats a legacy-only lead starting soon as starts_soon (confirm needed)", () => {
    const cov = deriveUnitCoverage(
      unit({ offeringId: "o1", title: "Robotics", legacyLeadId: "i9", legacyLeadName: "Older", startDate: inDays(5) }),
      NOW,
    );
    expect(cov.lane).toBe("starts_soon");
    expect(cov.startsSoon).toBe(true);
  });

  it("treats a legacy-only lead with a distant start as covered (calm)", () => {
    const cov = deriveUnitCoverage(
      unit({ offeringId: "o1", title: "Robotics", legacyLeadId: "i9", legacyLeadName: "Older", startDate: inDays(120) }),
      NOW,
    );
    expect(cov.lane).toBe("fully_covered");
  });

  it("flags a partner with no relationship lead as Needs owner", () => {
    const cov = deriveUnitCoverage(
      unit({ offeringId: "o1", title: "Robotics", partnerId: "p1", partnerName: "Beth El", ownerId: null }),
      NOW,
    );
    expect(cov.lane).toBe("cp_follow_up");
    expect(cov.needsOwner).toBe(true);
  });
});

describe("buildInstructorMatchSuggestions", () => {
  it("ranks a trained, same-subject, same-chapter instructor first", () => {
    const target = { subject: "Robotics", chapterId: "ch1" };
    const strong = candidate({ id: "i1", name: "Ivy", interests: ["Robotics"], chapterId: "ch1", baseReady: true, trained: true, activeLoad: 0 });
    const weak = candidate({ id: "i2", name: "Bo", interests: ["History"], chapterId: "ch2", trained: false, activeLoad: 1 });
    const ranked = buildInstructorMatchSuggestions(target, [weak, strong]);
    expect(ranked[0].instructorId).toBe("i1");
    expect(ranked[0].reasons.join(" ")).toMatch(/Robotics/);
  });

  it("deprioritises an overloaded instructor with a warning", () => {
    const over = candidate({ id: "i1", name: "Ivy", interests: ["Robotics"], baseReady: true, trained: true, activeLoad: 6 });
    const sug = scoreInstructorForUnit({ subject: "Robotics", chapterId: null }, over);
    expect(sug.warnings.join(" ")).toMatch(/Overloaded/);
  });

  it("warns that an untrained instructor needs training before placement", () => {
    const sug = scoreInstructorForUnit({ subject: "Robotics", chapterId: null }, candidate({ id: "i1", name: "Ivy", trained: false }));
    expect(sug.warnings.join(" ")).toMatch(/training/i);
  });
});

describe("buildInstructorPairingCockpit", () => {
  it("places an uncovered class in Needs instructor with a Pair primary action", () => {
    const c = cockpit({ units: [unit({ offeringId: "o1", title: "Robotics" })] });
    const cards = lane(c, "needs_instructor");
    expect(cards).toHaveLength(1);
    expect(cards[0].primaryAction.kind).toBe("pair_instructor");
  });

  it("marks a starts-soon uncovered class urgent (danger accent)", () => {
    const c = cockpit({ units: [unit({ offeringId: "o1", title: "Robotics", startDate: inDays(7) })] });
    const cards = lane(c, "starts_soon");
    expect(cards).toHaveLength(1);
    expect(cards[0].accentTone).toBe("danger");
  });

  it("surfaces an accepted-but-unplaced instructor with a Place action", () => {
    const c = cockpit({
      acceptedUnplaced: [
        { instructorId: "i1", name: "Ari", chapterName: "Scarsdale", readinessLabel: "Accepted applicant", trained: true, waitingDays: 12 },
      ],
    });
    const cards = lane(c, "accepted_unplaced");
    expect(cards).toHaveLength(1);
    expect(cards[0].primaryAction.kind).toBe("place_instructor");
    expect(cards[0].why).toMatch(/hasn't been paired/);
  });

  it("changes lane as confirmation status advances", () => {
    const offered = cockpit({ units: [unit({ offeringId: "o1", title: "X", assignments: [asg("OFFERED")] })] });
    expect(lane(offered, "waiting_instructor")).toHaveLength(1);

    const partner = cockpit({ units: [unit({ offeringId: "o1", title: "X", assignments: [asg("INSTRUCTOR_CONFIRMED")] })] });
    expect(lane(partner, "waiting_partner")).toHaveLength(1);

    const done = cockpit({ units: [unit({ offeringId: "o1", title: "X", assignments: [asg("FULLY_CONFIRMED")] })] });
    expect(lane(done, "fully_covered")).toHaveLength(1);
  });

  it("offers Send offer on a shortlisted (SUGGESTED) assignment", () => {
    const c = cockpit({ units: [unit({ offeringId: "o1", title: "X", assignments: [asg("SUGGESTED", { id: "as1" })] })] });
    const cards = lane(c, "suggested_matches");
    expect(cards).toHaveLength(1);
    expect(cards[0].primaryAction.label).toBe("Send offer");
    expect(cards[0].primaryAction.nextStatus).toBe("OFFERED");
  });

  it("does not duplicate a unit across lanes", () => {
    const c = cockpit({
      units: [unit({ offeringId: "o1", title: "X", assignments: [asg("OFFERED"), asg("SUGGESTED", { id: "as2", instructorId: "i2" })] })],
    });
    const appearances = c.lanes.flatMap((l) => l.cards).filter((card) => card.offeringId === "o1");
    expect(appearances).toHaveLength(1);
    expect(appearances[0].lane).toBe("waiting_instructor");
  });

  it("computes the needs-instructor briefing chip from needs + starts-soon", () => {
    const c = cockpit({
      units: [
        unit({ offeringId: "o1", title: "A" }),
        unit({ offeringId: "o2", title: "B", startDate: inDays(5) }),
      ],
    });
    const chip = c.briefing.find((x) => x.key === "needs_instructor")!;
    expect(chip.count).toBe(2);
  });
});
