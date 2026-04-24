import { describe, it, expect } from "vitest";
import {
  computeReadinessBreakdown,
  computePersonalizedTips,
} from "@/lib/training-journey/readiness";
import type {
  ReadinessAttempt,
  ReadinessTipCatalog,
} from "@/lib/training-journey/readiness";
import type { ReadinessModuleBreakdown } from "@/lib/training-journey/types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATALOG: ReadinessTipCatalog = {
  ypp_standard: {
    moduleLabel: "YPP Standard",
    tip: "Review Module 1 on YPP standards and red flags.",
  },
  run_session: {
    moduleLabel: "Running a Session",
    tip: "Review Module 2 on session flow and pacing.",
  },
  student_situations: {
    moduleLabel: "Student Situations",
    tip: "Review Module 3 on handling student situations.",
  },
  communication: {
    moduleLabel: "Communication",
    tip: "Review Module 4 on communication and reliability.",
  },
};

// ---------------------------------------------------------------------------
// computeReadinessBreakdown
// ---------------------------------------------------------------------------

describe("computeReadinessBreakdown", () => {
  it("returns {} for empty input", () => {
    expect(computeReadinessBreakdown([])).toEqual({});
  });

  it("computes a correct fraction for a single domain with a single beat", () => {
    const attempts: ReadinessAttempt[] = [
      { sourceDomain: "ypp_standard", score: 3, maxScore: 4 },
    ];
    const result = computeReadinessBreakdown(attempts);
    expect(result).toEqual({ ypp_standard: 0.75 });
  });

  it("aggregates multiple beats per domain and multiple domains correctly", () => {
    const attempts: ReadinessAttempt[] = [
      { sourceDomain: "ypp_standard", score: 2, maxScore: 4 },
      { sourceDomain: "ypp_standard", score: 3, maxScore: 4 },
      { sourceDomain: "run_session", score: 4, maxScore: 4 },
      { sourceDomain: "run_session", score: 2, maxScore: 4 },
    ];
    const result = computeReadinessBreakdown(attempts);
    // ypp_standard: (2+3) / (4+4) = 5/8 = 0.625
    // run_session:  (4+2) / (4+4) = 6/8 = 0.75
    expect(result.ypp_standard).toBeCloseTo(0.625);
    expect(result.run_session).toBeCloseTo(0.75);
  });

  it("ignores beats with maxScore === 0 (unscored / reflection beats)", () => {
    const attempts: ReadinessAttempt[] = [
      { sourceDomain: "run_session", score: 0, maxScore: 0 },
      { sourceDomain: "run_session", score: 4, maxScore: 4 },
    ];
    const result = computeReadinessBreakdown(attempts);
    // The zero-weight beat must not appear in the denominator.
    expect(result.run_session).toBeCloseTo(1.0);
  });

  it("returns {} when all beats have maxScore === 0", () => {
    const attempts: ReadinessAttempt[] = [
      { sourceDomain: "communication", score: 0, maxScore: 0 },
    ];
    expect(computeReadinessBreakdown(attempts)).toEqual({});
  });

  it("clamps score > maxScore defensively to 1.0 per domain", () => {
    const attempts: ReadinessAttempt[] = [
      // Should not happen in production, but we clamp defensively.
      { sourceDomain: "ypp_standard", score: 5, maxScore: 4 },
    ];
    const result = computeReadinessBreakdown(attempts);
    expect(result.ypp_standard).toBe(1.0);
  });
});

// ---------------------------------------------------------------------------
// computePersonalizedTips
// ---------------------------------------------------------------------------

describe("computePersonalizedTips", () => {
  it("returns [] when all domains are at or above the 0.8 threshold", () => {
    const breakdown: ReadinessModuleBreakdown = {
      ypp_standard: 0.9,
      run_session: 0.85,
      student_situations: 0.95,
      communication: 1.0,
    };
    expect(computePersonalizedTips(breakdown, CATALOG)).toEqual([]);
  });

  it("returns 1 tip when exactly one domain is below threshold", () => {
    const breakdown: ReadinessModuleBreakdown = {
      ypp_standard: 0.9,
      run_session: 0.7, // weak
      student_situations: 0.85,
    };
    const tips = computePersonalizedTips(breakdown, CATALOG);
    expect(tips).toHaveLength(1);
    expect(tips[0]!.module).toBe("Running a Session");
  });

  it("returns tips for all 3 weakest domains in ascending-score order when ≥3 are below threshold", () => {
    const breakdown: ReadinessModuleBreakdown = {
      ypp_standard: 0.5,      // 3rd weakest
      run_session: 0.3,       // weakest
      student_situations: 0.4, // 2nd weakest
      communication: 0.9,     // fine
    };
    const tips = computePersonalizedTips(breakdown, CATALOG);
    expect(tips).toHaveLength(3);
    expect(tips[0]!.module).toBe("Running a Session");        // 0.3
    expect(tips[1]!.module).toBe("Student Situations");       // 0.4
    expect(tips[2]!.module).toBe("YPP Standard");             // 0.5
  });

  it("caps output at maxTips when more than maxTips domains are below threshold", () => {
    const breakdown: ReadinessModuleBreakdown = {
      ypp_standard: 0.5,
      run_session: 0.3,
      student_situations: 0.4,
      communication: 0.6,
    };
    const tips = computePersonalizedTips(breakdown, CATALOG, { maxTips: 2 });
    expect(tips).toHaveLength(2);
    // Lowest two: run_session (0.3), student_situations (0.4)
    expect(tips[0]!.module).toBe("Running a Session");
    expect(tips[1]!.module).toBe("Student Situations");
  });

  it("minTips floor: returns [] when all domains pass (≥0.80), even if lowest < 0.95", () => {
    // Rule: if NO domain is below weaknessThreshold, overall is passing → [].
    // The minTips floor only applies when some domains ARE below threshold.
    const breakdown: ReadinessModuleBreakdown = {
      ypp_standard: 0.85,
      run_session: 0.82, // above 0.80, so no weak domain exists
      communication: 0.90,
    };
    const tips = computePersonalizedTips(breakdown, CATALOG);
    expect(tips).toEqual([]);
  });

  it("minTips floor: with minTips=2 and only 1 weak domain, still emits that 1 tip because it is < 0.95", () => {
    // 1 domain below threshold (0.60), minTips=2 → capped.length=1 < minTips=2
    // floor check: lowest is 0.60 < 0.95 → emit the 1 weak domain anyway
    const breakdown: ReadinessModuleBreakdown = {
      run_session: 0.6,   // below threshold
      ypp_standard: 0.9,  // above threshold
    };
    const tips = computePersonalizedTips(breakdown, CATALOG, { minTips: 2 });
    expect(tips).toHaveLength(1);
    expect(tips[0]!.module).toBe("Running a Session");
  });

  it("returns [] when all domains pass and lowest is ≥ 0.95 (near-perfect, no tips)", () => {
    const breakdown: ReadinessModuleBreakdown = {
      ypp_standard: 0.95,
      run_session: 0.97,
    };
    expect(computePersonalizedTips(breakdown, CATALOG)).toEqual([]);
  });

  it("silently skips domains that are missing from the catalog", () => {
    const breakdown: ReadinessModuleBreakdown = {
      unknown_domain: 0.5, // not in catalog
      run_session: 0.4,
    };
    const tips = computePersonalizedTips(breakdown, CATALOG);
    // unknown_domain is skipped; only run_session produces a tip
    expect(tips).toHaveLength(1);
    expect(tips[0]!.module).toBe("Running a Session");
  });

  it("breaks ties in same-score domains by domain key ascending (stable ordering)", () => {
    // Two domains with identical score below threshold
    const breakdown: ReadinessModuleBreakdown = {
      run_session: 0.6,
      communication: 0.6,
    };
    const tips = computePersonalizedTips(breakdown, CATALOG);
    expect(tips).toHaveLength(2);
    // "communication" < "run_session" alphabetically → communication first
    expect(tips[0]!.module).toBe("Communication");
    expect(tips[1]!.module).toBe("Running a Session");
  });

  it("returns [] when breakdown is empty", () => {
    expect(computePersonalizedTips({}, CATALOG)).toEqual([]);
  });
});
