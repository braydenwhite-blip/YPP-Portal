import { describe, it, expect } from "vitest";

import {
  buildChapterMetricCell,
  chapterMetricDrilldownHref,
} from "@/lib/data-360/chapter-metrics";

describe("chapterMetricDrilldownHref", () => {
  it("links growth metrics to their filtered list routes", () => {
    expect(chapterMetricDrilldownHref("c1", "partners")).toBe("/partners?chapterId=c1");
    expect(chapterMetricDrilldownHref("c1", "instructors")).toBe("/admin/instructors?chapterId=c1");
    expect(chapterMetricDrilldownHref("c1", "students")).toBe("/admin/students?chapterId=c1");
    expect(chapterMetricDrilldownHref("c1", "meetingsHeld")).toBe(
      "/meetings?chapterId=c1&status=COMPLETED"
    );
    expect(chapterMetricDrilldownHref("c1", "completedActions")).toBe(
      "/actions?chapter=c1&status=COMPLETE"
    );
  });

  it("links workflow metrics into the health-filtered workflow list", () => {
    expect(chapterMetricDrilldownHref("c1", "activeWorkflows")).toBe("/workflows?chapterId=c1");
    expect(chapterMetricDrilldownHref("c1", "blockedWorkflows")).toBe(
      "/workflows?health=BLOCKED&chapterId=c1"
    );
    expect(chapterMetricDrilldownHref("c1", "overdueWorkflows")).toBe(
      "/workflows?health=OVERDUE&chapterId=c1"
    );
  });

  it("returns null for attendance (no master list — honest disabled state)", () => {
    expect(chapterMetricDrilldownHref("c1", "attendance")).toBeNull();
  });
});

describe("buildChapterMetricCell", () => {
  it("grades a below-target partner count as danger with a drilldown", () => {
    const cell = buildChapterMetricCell("partners", 3, "operating", "c1");
    expect(cell.value).toBe(3);
    expect(cell.status).toBe("below");
    expect(cell.tone).toBe("danger");
    expect(cell.href).toBe("/partners?chapterId=c1");
  });

  it("mutes a metric that is not relevant for the phase", () => {
    const cell = buildChapterMetricCell("attendance", 90, "prelaunch", "c1");
    expect(cell.status).toBe("none");
    expect(cell.tone).toBe("muted");
    expect(cell.href).toBeNull();
  });

  it("marks a zero blocked-workflow count as met (positive)", () => {
    const cell = buildChapterMetricCell("blockedWorkflows", 0, "operating", "c1");
    expect(cell.status).toBe("met");
    expect(cell.tone).toBe("positive");
  });
});
