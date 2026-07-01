import { describe, it, expect } from "vitest";

import { buildChapterMetricCell, type ChapterComparisonRow } from "@/lib/data-360/chapter-metrics";
import {
  CHAPTER_METRIC_KEYS,
  type ChapterMetricKey,
  type ChapterPhase,
} from "@/lib/data-360/expectations";
import { buildWorkflowSuggestions, suggestionsForChapter } from "@/lib/data-360/suggestions";

function mkRow(
  chapterId: string,
  chapterName: string,
  phase: ChapterPhase,
  values: Partial<Record<ChapterMetricKey, number>>
): ChapterComparisonRow {
  const metrics = {} as ChapterComparisonRow["metrics"];
  for (const key of CHAPTER_METRIC_KEYS) {
    metrics[key] = buildChapterMetricCell(key, values[key] ?? 0, phase, chapterId);
  }
  return {
    chapterId,
    chapterName,
    region: null,
    lifecycleStatus: "ACTIVE",
    phase,
    phaseLabel: phase,
    metrics,
  };
}

describe("suggestionsForChapter", () => {
  it("suggests Partner Outreach when partners are below target", () => {
    const row = mkRow("c1", "Alpha", "operating", { partners: 2, instructors: 18, students: 90 });
    const out = suggestionsForChapter(row);
    const partner = out.find((s) => s.metricKey === "partners");
    expect(partner).toBeTruthy();
    expect(partner?.templateKey).toBe("partner-acquisition");
    expect(partner?.templateLabel).toBe("Partner Outreach Sprint");
    expect(partner?.sourceHref).toBe("/partners?chapterId=c1");
    expect(partner?.currentValue).toBe(2);
  });

  it("suggests Workflow Recovery for a non-zero blocked-workflow count", () => {
    const row = mkRow("c1", "Alpha", "operating", {
      partners: 9,
      instructors: 18,
      students: 90,
      blockedWorkflows: 2,
    });
    const out = suggestionsForChapter(row);
    const blocked = out.find((s) => s.metricKey === "blockedWorkflows");
    expect(blocked?.templateKey).toBe("chapter-recovery");
    expect(blocked?.reason).toContain("2");
  });

  it("does not suggest for metrics that are on target", () => {
    const row = mkRow("c1", "Alpha", "operating", {
      partners: 9,
      instructors: 18,
      students: 90,
      blockedWorkflows: 0,
      overdueWorkflows: 0,
    });
    const out = suggestionsForChapter(row);
    expect(out.find((s) => s.metricKey === "partners")).toBeUndefined();
    expect(out.find((s) => s.metricKey === "blockedWorkflows")).toBeUndefined();
  });

  it("does not suggest phase-irrelevant metrics (no student push pre-launch)", () => {
    const row = mkRow("c1", "Alpha", "prelaunch", { partners: 9, instructors: 18, students: 0 });
    const out = suggestionsForChapter(row);
    expect(out.find((s) => s.metricKey === "students")).toBeUndefined();
  });
});

describe("buildWorkflowSuggestions", () => {
  it("ranks target-zero breaches ahead of growth shortfalls", () => {
    const rows = [
      mkRow("c1", "Alpha", "operating", { partners: 2, instructors: 18, students: 90 }),
      mkRow("c2", "Beta", "operating", {
        partners: 9,
        instructors: 18,
        students: 90,
        overdueWorkflows: 3,
      }),
    ];
    const out = buildWorkflowSuggestions(rows);
    expect(out.length).toBeGreaterThanOrEqual(2);
    // the overdue-workflow (target-zero) suggestion should sort first
    expect(out[0].metricKey).toBe("overdueWorkflows");
  });
});
