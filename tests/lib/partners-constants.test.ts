import { describe, expect, it } from "vitest";

import {
  partnerStuckReasons,
  summarizePartnerPipeline,
  type PartnerPipelineInput,
} from "@/lib/partners-constants";

const NOW = new Date("2026-06-08T12:00:00Z");

function partner(overrides: Partial<PartnerPipelineInput>): PartnerPipelineInput {
  return {
    stage: "REACHED_OUT",
    priority: "MEDIUM",
    nextFollowUpAt: new Date("2026-07-01T00:00:00Z"),
    relationshipLeadId: "lead",
    ...overrides,
  };
}

describe("partnerStuckReasons", () => {
  it("flags overdue follow-up, missing next step, and no lead on active partners", () => {
    expect(
      partnerStuckReasons(partner({ nextFollowUpAt: new Date("2026-05-01T00:00:00Z") }), NOW)
    ).toContain("Follow-up is overdue");
    expect(partnerStuckReasons(partner({ nextFollowUpAt: null }), NOW)).toContain(
      "No next follow-up scheduled"
    );
    expect(partnerStuckReasons(partner({ relationshipLeadId: null }), NOW)).toContain(
      "No relationship lead"
    );
    expect(partnerStuckReasons(partner({}), NOW)).toEqual([]);
  });

  it("never flags won or parked partners", () => {
    expect(
      partnerStuckReasons(
        partner({ stage: "ACTIVE_PARTNERSHIP", nextFollowUpAt: null, relationshipLeadId: null }),
        NOW
      )
    ).toEqual([]);
    expect(
      partnerStuckReasons(
        partner({ stage: "PAUSED", nextFollowUpAt: null, relationshipLeadId: null }),
        NOW
      )
    ).toEqual([]);
  });
});

describe("summarizePartnerPipeline", () => {
  it("buckets active / won / parked / stuck and tallies by stage + priority", () => {
    const partners = [
      partner({ stage: "REACHED_OUT", priority: "HIGH" }), // active, healthy
      partner({ stage: "RESPONDED", priority: "URGENT", nextFollowUpAt: null }), // active, stuck
      partner({ stage: "ACTIVE_PARTNERSHIP", priority: "LOW" }), // won
      partner({ stage: "COMPLETED", priority: "LOW" }), // won
      partner({ stage: "PAUSED", priority: "MEDIUM" }), // parked
      partner({ stage: "NOT_A_FIT", priority: "MEDIUM" }), // parked
    ];
    const s = summarizePartnerPipeline(partners, NOW);
    expect(s.total).toBe(6);
    expect(s.active).toBe(2);
    expect(s.won).toBe(2);
    expect(s.parked).toBe(2);
    expect(s.stuck).toBe(1);
    expect(s.byStage.REACHED_OUT).toBe(1);
    expect(s.byStage.ACTIVE_PARTNERSHIP).toBe(1);
    expect(s.byPriority.URGENT).toBe(1);
    expect(s.byPriority.LOW).toBe(2);
    expect(s.byPriority.MEDIUM).toBe(2);
  });

  it("coerces unknown stages/priorities to defaults (NOT_STARTED / MEDIUM)", () => {
    const s = summarizePartnerPipeline([partner({ stage: "BOGUS", priority: "BOGUS" })], NOW);
    expect(s.byStage.NOT_STARTED).toBe(1);
    expect(s.byPriority.MEDIUM).toBe(1);
    expect(s.active).toBe(1); // NOT_STARTED is an active stage
  });
});
