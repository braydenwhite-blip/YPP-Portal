import { describe, it, expect } from "vitest";

import {
  chapterPhase,
  expectationStatus,
  expectationStatusLabel,
  expectationTone,
  isMetricRelevant,
  CHAPTER_EXPECTATIONS,
  CHAPTER_METRIC_KEYS,
} from "@/lib/data-360/expectations";

describe("chapterPhase", () => {
  it("maps lifecycle statuses onto operating phases", () => {
    expect(chapterPhase("PROSPECT")).toBe("prelaunch");
    expect(chapterPhase("APPROVED")).toBe("prelaunch");
    expect(chapterPhase("LAUNCHING")).toBe("launching");
    expect(chapterPhase("ACTIVE")).toBe("operating");
    expect(chapterPhase("AT_RISK")).toBe("operating");
    expect(chapterPhase("ALUMNI")).toBe("mature");
    expect(chapterPhase(null)).toBe("operating");
    expect(chapterPhase("SOMETHING_NEW")).toBe("operating");
  });
});

describe("expectationStatus", () => {
  it("grades higher-is-better ranges (partners 8–10)", () => {
    expect(expectationStatus("partners", 9, "operating")).toBe("met");
    expect(expectationStatus("partners", 8, "operating")).toBe("met");
    // 0.7 * 8 = 5.6 -> ceil 6 is the approaching floor
    expect(expectationStatus("partners", 6, "operating")).toBe("approaching");
    expect(expectationStatus("partners", 3, "operating")).toBe("below");
  });

  it("grades at-least targets (applicants 30+)", () => {
    expect(expectationStatus("applicants", 30, "operating")).toBe("met");
    expect(expectationStatus("applicants", 40, "operating")).toBe("met");
    expect(expectationStatus("applicants", 22, "operating")).toBe("approaching");
    expect(expectationStatus("applicants", 5, "operating")).toBe("below");
  });

  it("grades target-zero metrics (blocked/overdue workflows)", () => {
    expect(expectationStatus("blockedWorkflows", 0, "operating")).toBe("met");
    expect(expectationStatus("blockedWorkflows", 1, "operating")).toBe("over");
    expect(expectationStatus("overdueWorkflows", 3, "operating")).toBe("over");
  });

  it("grades lower-is-better ceilings (pending follow-ups ≤ 8)", () => {
    expect(expectationStatus("pendingFollowUps", 4, "operating")).toBe("met");
    expect(expectationStatus("pendingFollowUps", 8, "operating")).toBe("met");
    expect(expectationStatus("pendingFollowUps", 10, "operating")).toBe("approaching");
    expect(expectationStatus("pendingFollowUps", 20, "operating")).toBe("over");
  });

  it("returns 'none' for metrics irrelevant to the chapter phase (gray-out)", () => {
    // students only relevant from launching onward
    expect(expectationStatus("students", 5, "prelaunch")).toBe("none");
    expect(expectationStatus("students", 90, "operating")).toBe("met");
    // attendance only relevant when operating
    expect(expectationStatus("attendance", 90, "prelaunch")).toBe("none");
  });

  it("returns 'none' for a null value on a relevant metric", () => {
    expect(expectationStatus("attendance", null, "operating")).toBe("none");
  });
});

describe("isMetricRelevant", () => {
  it("gates students/sessions/attendance by phase", () => {
    expect(isMetricRelevant("students", "prelaunch")).toBe(false);
    expect(isMetricRelevant("students", "launching")).toBe(true);
    expect(isMetricRelevant("attendance", "launching")).toBe(false);
    expect(isMetricRelevant("attendance", "operating")).toBe(true);
    expect(isMetricRelevant("partners", "prelaunch")).toBe(true);
  });
});

describe("expectationTone / label", () => {
  it("maps statuses to cosmetic tones and human labels", () => {
    expect(expectationTone("met")).toBe("positive");
    expect(expectationTone("approaching")).toBe("warning");
    expect(expectationTone("below")).toBe("danger");
    expect(expectationTone("over")).toBe("danger");
    expect(expectationTone("none")).toBe("muted");
    expect(expectationStatusLabel("met")).toBe("On target");
    expect(expectationStatusLabel("over")).toBe("Over target");
    expect(expectationStatusLabel("none")).toBe("Not yet");
  });
});

describe("expectations registry integrity", () => {
  it("has an entry for every metric key with a benchmark label", () => {
    for (const key of CHAPTER_METRIC_KEYS) {
      const exp = CHAPTER_EXPECTATIONS[key];
      expect(exp).toBeTruthy();
      expect(exp.key).toBe(key);
      expect(exp.expectationLabel.length).toBeGreaterThan(0);
      expect(exp.relevantPhases.length).toBeGreaterThan(0);
    }
  });

  it("blocked and overdue workflows target zero", () => {
    expect(CHAPTER_EXPECTATIONS.blockedWorkflows.direction).toBe("target-zero");
    expect(CHAPTER_EXPECTATIONS.overdueWorkflows.direction).toBe("target-zero");
  });
});
