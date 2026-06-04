import { describe, expect, it } from "vitest";
import {
  classifyLearnerTriage,
  STUCK_AFTER_DAYS,
  TRIAGE_BUCKETS,
  type TriageInput,
} from "@/lib/training-triage";

const NOW = Date.parse("2026-06-04T00:00:00.000Z");
const daysAgo = (n: number) =>
  new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const base: TriageInput = {
  requiredComplete: 0,
  requiredModulesCount: 7,
  lastActivity: null,
  now: NOW,
};

describe("classifyLearnerTriage", () => {
  it("flags PASSED when readiness reports training complete", () => {
    expect(
      classifyLearnerTriage({ ...base, requiredComplete: 7, trainingComplete: true })
    ).toBe("PASSED");
  });

  it("flags PASSED for students (no readiness) once all required modules complete", () => {
    expect(
      classifyLearnerTriage({
        ...base,
        requiredComplete: 7,
        lastActivity: daysAgo(1),
        trainingComplete: undefined,
      })
    ).toBe("PASSED");
  });

  it("does NOT mark an instructor PASSED on modules alone when capstone is unfinished", () => {
    // trainingComplete=false → modules done but Studio capstone not approved.
    expect(
      classifyLearnerTriage({
        ...base,
        requiredComplete: 7,
        lastActivity: daysAgo(1),
        trainingComplete: false,
      })
    ).toBe("IN_PROGRESS");
  });

  it("flags AWAITING_STUDIO when the capstone is submitted but not approved", () => {
    expect(
      classifyLearnerTriage({
        ...base,
        requiredComplete: 7,
        lastActivity: daysAgo(1),
        trainingComplete: false,
        studioCapstoneInReview: true,
      })
    ).toBe("AWAITING_STUDIO");
  });

  it("flags NOT_STARTED when nothing is complete and there is no activity", () => {
    expect(classifyLearnerTriage(base)).toBe("NOT_STARTED");
  });

  it("flags IN_PROGRESS when recently active and partway through", () => {
    expect(
      classifyLearnerTriage({
        ...base,
        requiredComplete: 2,
        lastActivity: daysAgo(2),
      })
    ).toBe("IN_PROGRESS");
  });

  it("flags STUCK when started but stale beyond the window", () => {
    expect(
      classifyLearnerTriage({
        ...base,
        requiredComplete: 2,
        lastActivity: daysAgo(STUCK_AFTER_DAYS + 1),
      })
    ).toBe("STUCK");
  });

  it("flags STUCK when activity exists but no module is complete and it is stale", () => {
    // e.g. attempted beats long ago but never finished a module.
    expect(
      classifyLearnerTriage({
        ...base,
        requiredComplete: 0,
        lastActivity: daysAgo(STUCK_AFTER_DAYS + 5),
      })
    ).toBe("STUCK");
  });

  it("treats the staleness boundary as stuck (inclusive)", () => {
    expect(
      classifyLearnerTriage({
        ...base,
        requiredComplete: 1,
        lastActivity: daysAgo(STUCK_AFTER_DAYS),
      })
    ).toBe("STUCK");
  });

  it("always returns a known bucket", () => {
    const bucket = classifyLearnerTriage({
      ...base,
      requiredComplete: 3,
      lastActivity: daysAgo(1),
    });
    expect(TRIAGE_BUCKETS).toContain(bucket);
  });
});
